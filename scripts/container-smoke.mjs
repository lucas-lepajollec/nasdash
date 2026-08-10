import { spawnSync } from 'node:child_process';

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
  const deadline = Date.now() + 90_000;
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
  await verifyLogin(firstContainer);
  docker(['exec', firstContainer, 'sh', '-c', '[ "$(id -u):$(id -g)" = "1001:1001" ]']);
  docker(['exec', firstContainer, 'sh', '-c', 'for file in config services topology calendar custom_tabs users; do test -f "/app/data/$file.json" || exit 1; done']);
  docker(['exec', firstContainer, 'sh', '-c', 'printf persisted > /app/data/upgrade-marker']);

  removeContainer(firstContainer);
  startContainer(upgradeContainer);
  await waitForHealthy(upgradeContainer);
  await verifyLogin(upgradeContainer);
  docker(['exec', upgradeContainer, 'sh', '-c', 'test "$(cat /app/data/upgrade-marker)" = persisted']);

  console.log(`[NASDASH] Container smoke test passed for ${image}: fresh install, login, UID/GID and volume reuse.`);
} finally {
  removeContainer(firstContainer);
  removeContainer(upgradeContainer);
  docker(['volume', 'rm', '--force', volume], { allowFailure: true });
}
