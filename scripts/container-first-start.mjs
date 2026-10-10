import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const image = process.argv[2] || 'nasdash:smoke';
const prefix = `nasdash-first-start-${process.pid}-${Date.now()}`;
const containers = new Set(), volumes = new Set();
const docker = (args, input) => {
  const result = spawnSync('docker', args, { encoding: 'utf8', input });
  // Logs can include test-only initial passwords: never dump them on failure.
  assert.equal(result.status, 0, `Docker ${args[0]} failed (output withheld).`);
  return result.stdout + result.stderr;
};
const volume = label => {
  const name = `${prefix}-${label}`; docker(['volume', 'create', name]); volumes.add(name); return name;
};
const start = (label, store, options = [], readOnly = false, target = "/app/data") => {
  const name = `${prefix}-${label}`;
  containers.add(name);
  docker(['run', '-d', '--name', name, '-p', '127.0.0.1::2504', '--health-interval', '1s', '--health-start-period', '2s', '-v', `${store}:${target}${readOnly ? ":ro" : ""}`, ...options, image]);
  return name;
};
const stop = name => { docker(['rm', '-f', name]); containers.delete(name); };
const wait = async (name, healthy = true) => {
  const deadline = Date.now() + (Number(process.env.NASDASH_SMOKE_TIMEOUT_MS) || 90_000);
  while (Date.now() < deadline) {
    const state = docker(['inspect', '--format', '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}', name]).trim();
    if (healthy && state === 'running healthy') return;
    if (!healthy && state.startsWith('exited')) {
      assert.equal(docker(['inspect', '--format', '{{.State.ExitCode}}', name]).trim(), '1'); return;
    }
    assert.ok(!healthy || !state.startsWith('exited'), `Container ${name} exited unexpectedly (logs withheld).`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.fail('Startup did not reach the expected state (logs withheld).');
};
let previousCookie;
const login = async (name, password, capture = false) => {
  const base = 'http://' + docker(['port', name, '2504/tcp']).trim();
  const result = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password }), signal: AbortSignal.timeout(10_000),
  });
  if (capture) previousCookie = result.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  return result.status;
};
const accountState = name => docker(['exec', name, 'node', '-e', `
  const fs=require('fs'),crypto=require('crypto');
  for(const name of ['users.json','jwt.secret']) {
    process.stdout.write(crypto.createHash('sha256').update(fs.readFileSync('/app/data/'+name)).digest('hex')+'\\n');
  }
`]);

try {
  const data = volume('generated');
  const first = start('first', data);
  await wait(first);
  const initial = docker(['logs', first]);
  const admin = initial.match(/Initial password generated for admin: ([A-Za-z0-9_-]+)/)?.[1];
  assert.ok(admin, 'Admin password missing before the first HTTP/login request.');
  assert.equal((initial.match(/Initial password generated for/g) || []).length, 2);
  assert.equal(await login(first, admin, true), 200);
  const state = accountState(first);
  stop(first);
  const next = start('restart', data, ['-e', 'NASDASH_ADMIN_PASSWORD=ignored-existing-account-password']);
  await wait(next);
  assert.equal(accountState(next), state, 'Restart changed accounts or the signing key.');
  assert.ok(!docker(['logs', next]).includes('Initial password generated for'));
  assert.equal(await login(next, admin), 200);
  stop(next);

  const replacement = 'synthetic-offline-recovery-password';
  docker(['run', '--rm', '-i', '-v', `${data}:/app/data`, '--entrypoint', 'node', image, 'scripts/reset-password.mjs', 'admin'], replacement + '\n');
  const recovered = start('recovered', data);
  await wait(recovered);
  assert.equal(await login(recovered, replacement), 200);
  assert.equal(await login(recovered, admin), 401);
  assert.equal(accountState(recovered).trim().split('\n')[1], state.trim().split('\n')[1], 'Recovery rotated the signing key.');
  const recoveredBase = 'http://' + docker(['port', recovered, '2504/tcp']).trim();
  const revoked = await fetch(recoveredBase + '/api/auth/users', { headers: { cookie: previousCookie }, signal: AbortSignal.timeout(10_000) });
  assert.equal(revoked.status, 401, 'Recovery did not revoke the previous administrator session.');
  stop(recovered);

  const customData = volume('custom-user');
  docker(['run', '--rm', '--user', '0:0', '-v', `${customData}:/fixture`, '--entrypoint', 'sh', image, '-c', 'mkdir -p /fixture/logos && chown -R 1026:100 /fixture && chmod 700 /fixture']);
  const custom = start('custom', customData, ['--user', '1026:100', '-e', 'NASDASH_ADMIN_PASSWORD=synthetic-custom-user-password', '-e', 'NASDASH_DATA_DIR=/custom-data'], false, '/custom-data');
  await wait(custom);
  assert.equal(await login(custom, 'synthetic-custom-user-password'), 200);
  assert.ok(docker(['logs', custom]).includes('runtime UID:GID 1026:100'));
  stop(custom);

  for (const [label, setup, options] of [
    ['denied-directory', 'printf synthetic > /fixture/marker && chown 0:0 /fixture && chmod 700 /fixture', []],
    ['denied-logos', 'chown 1001:1001 /fixture && mkdir -p /fixture/logos && chown 0:0 /fixture/logos && chmod 700 /fixture/logos', []],
    ['denied-secret', 'chown 1001:1001 /fixture && printf synthetic > /fixture/jwt.secret && chmod 600 /fixture/jwt.secret', []],
    ['read-only', 'chown 1001:1001 /fixture', []],
  ]) {
    const deniedData = volume(label);
    docker(['run', '--rm', '--user', '0:0', '-v', `${deniedData}:/fixture`, '--entrypoint', 'sh', image, '-c', setup]);
    const denied = start(label, deniedData, options, label === 'read-only');
    await wait(denied, false);
    const logs = docker(['logs', denied]);
    assert.ok(logs.includes('Data permission check failed'));
    assert.ok(logs.includes('runtime UID:GID 1001:1001'));
    assert.ok(!logs.includes('Starting the application'));
    assert.ok(!logs.includes('Initial password generated for'));
    stop(denied);
  }
  console.info(`[NASDASH] First-start container checks passed for ${image}: generated credentials before HTTP, restart preservation, offline recovery, custom UID/GID and permission failures.`);
} finally {
  for (const name of containers) spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' });
  for (const name of volumes) spawnSync('docker', ['volume', 'rm', name], { encoding: 'utf8' });
}
