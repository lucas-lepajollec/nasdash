import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const image = process.argv[2] || 'nasdash:smoke';
const suffix = `${process.pid}-${Date.now()}`;
const firstContainer = `nasdash-smoke-first-${suffix}`;
const upgradeContainer = `nasdash-smoke-upgrade-${suffix}`;
const volume = `nasdash-smoke-data-${suffix}`;
const createdContainers = new Set();

function docker(args, { allowFailure = false } = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error([
      `docker ${args.join(' ')} failed with status ${result.status}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'));
  }
  return (result.stdout || '').trim();
}

function startContainer(name) {
  docker([
    'run', '--detach',
    '--name', name,
    '--publish', '127.0.0.1::2504',
    '--env', 'NASDASH_ADMIN_PASSWORD=container-smoke-admin-password',
    '--env', 'NASDASH_VIEWER_PASSWORD=container-smoke-viewer-password',
    '--env', 'NASDASH_JWT_SECRET=container-smoke-jwt-secret',
    '--volume', `${volume}:/app/data`,
    image,
  ]);
  createdContainers.add(name);
}

async function waitForHealthy(name) {
  // An emulated platform (arm64 under QEMU in CI) starts more slowly.
  const deadline = Date.now() + (Number(process.env.NASDASH_SMOKE_TIMEOUT_MS) || 90_000);
  while (Date.now() < deadline) {
    const state = docker(['inspect', '--format', '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}', name]);
    if (state === 'running healthy') return;
    if (state.startsWith('exited') || state.endsWith('unhealthy')) {
      throw new Error(`Container ${name} did not become healthy:\n${docker(['logs', name], { allowFailure: true })}`);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${name} to become healthy.`);
}

function getPublishedPort(name) {
  const binding = docker(['port', name, '2504/tcp']);
  const match = binding.match(/:(\d+)$/m);
  if (!match) throw new Error(`Unable to read the published port for ${name}: ${binding}`);
  return Number(match[1]);
}

async function verifyLogin(name) {
  const port = getPublishedPort(name);
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'container-smoke-admin-password' }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Admin login failed with HTTP ${response.status}.`);
  return { base: `http://127.0.0.1:${port}`, cookie: response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') };
}

async function verifyEnglishInstall(session) {
  const get = async route => {
    const response = await fetch(session.base + route, { headers: { cookie: session.cookie }, signal: AbortSignal.timeout(5_000) });
    assert.equal(response.status, 200, `Fresh-install request failed: ${route}`);
    return response.json();
  };
  const config = await get('/api/config');
  assert.equal(config.settings.uiLanguage, 'en');
  assert.deepEqual(config.devices.map(device => device.name), ['Main Server', 'Hypervisor']);
  assert.deepEqual(config.categories.flatMap(category => category.services.map(service => service.name)), ['Example Service 1', 'Example Service 2']);
  const document = await get('/api/pages');
  assert.deepEqual(document.pages.map(page => page.name), ['Home', 'Docker', 'Networks', 'Widgets', 'Calendar']);
}

function customizeAndHash(name) {
  return docker(['exec', name, 'node', '-e', `
    const fs = require('fs'), crypto = require('crypto');
    const change = (name, update) => {
      const file = '/app/data/' + name + '.json';
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      update(value); fs.writeFileSync(file, JSON.stringify(value, null, 2));
    };
    change('config', value => { value.settings.title = 'Le labo de Camille'; value.devices[0].name = 'Serveur personnalisé'; });
    change('services', value => { value[0].services[0].name = 'Mon application'; });
    change('pages', value => { value.pages[0].name = 'Mon tableau'; });
    const hash = crypto.createHash('sha256');
    for (const name of ['config','services','topology','calendar','custom_tabs','pages']) hash.update(fs.readFileSync('/app/data/' + name + '.json'));
    process.stdout.write(hash.digest('hex'));
  `]);
}

function hashPersistedFiles(name) {
  return docker(['exec', name, 'node', '-e', `
    const fs = require('fs'), hash = require('crypto').createHash('sha256');
    for (const name of ['config','services','topology','calendar','custom_tabs','pages']) hash.update(fs.readFileSync('/app/data/' + name + '.json'));
    process.stdout.write(hash.digest('hex'));
  `]);
}

function removeContainer(name) {
  if (!createdContainers.has(name)) return;
  docker(['rm', '--force', name], { allowFailure: true });
  createdContainers.delete(name);
}

try {
  docker(['volume', 'create', volume]);
  startContainer(firstContainer);
  await waitForHealthy(firstContainer);
  await verifyEnglishInstall(await verifyLogin(firstContainer));
  const startup = docker(['logs', firstContainer]);
  assert.ok(startup.includes('Starting the application...'), 'Missing English startup log');
  assert.ok(!/Mise à jour|Démarrage|Créé|existe déjà/.test(startup), 'French startup log remains');
  docker(['exec', firstContainer, 'sh', '-c', '[ "$(id -u):$(id -g)" = "1001:1001" ]']);
  docker(['exec', firstContainer, 'sh', '-c', 'for file in config services topology calendar custom_tabs users; do test -f "/app/data/$file.json" || exit 1; done']);
  docker(['exec', firstContainer, 'sh', '-c', 'printf persisted > /app/data/upgrade-marker']);
  const savedFiles = customizeAndHash(firstContainer);

  removeContainer(firstContainer);
  startContainer(upgradeContainer);
  await waitForHealthy(upgradeContainer);
  await verifyLogin(upgradeContainer);
  docker(['exec', upgradeContainer, 'sh', '-c', 'test "$(cat /app/data/upgrade-marker)" = persisted']);
  assert.equal(hashPersistedFiles(upgradeContainer), savedFiles, 'A restart changed customized configuration or layout files');

  console.log(`[NASDASH] Container smoke test passed for ${image}: English fresh install/logs, login, UID/GID and unchanged customized files after restart.`);
} finally {
  removeContainer(firstContainer);
  removeContainer(upgradeContainer);
  docker(['volume', 'rm', '--force', volume], { allowFailure: true });
}
