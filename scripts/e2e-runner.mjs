import { spawn } from 'node:child_process';
import path from 'node:path';

await import('./e2e-prepare.mjs');

const projectDirectory = process.cwd();
const productionMode = process.env.NASDASH_E2E_SERVER_MODE === 'production';
const configuredDistDirectory = process.env.NASDASH_NEXT_DIST_DIR?.trim() || '.next';
const distDirectory = path.resolve(projectDirectory, configuredDistDirectory);
const serverDirectory = productionMode
  ? path.join(distDirectory, 'standalone')
  : projectDirectory;
const serverEntryPoint = productionMode
  ? path.join(serverDirectory, 'server.js')
  : path.join(projectDirectory, 'node_modules', 'next', 'dist', 'bin', 'next');
const serverArguments = productionMode
  ? [serverEntryPoint]
  : [serverEntryPoint, 'dev', '-H', '127.0.0.1', '-p', '2510'];
const playwrightEntryPoint = path.join(projectDirectory, 'node_modules', '@playwright', 'test', 'cli.js');
const baseURL = 'http://127.0.0.1:2510';

const serverEnvironment = {
  ...process.env,
  NASDASH_DATA_DIR: path.join(projectDirectory, '.e2e', 'data'),
  NASDASH_ADMIN_PASSWORD: 'playwright-admin-password',
  NASDASH_VIEWER_PASSWORD: 'playwright-viewer-password',
  NASDASH_JWT_SECRET: 'playwright-only-secret-never-used-in-production',
  NEXT_TELEMETRY_DISABLED: '1',
  PORT: '2510',
  HOSTNAME: '127.0.0.1',
  ...(productionMode ? {} : { NASDASH_NEXT_DIST_DIR: '.next-e2e' }),
};

async function isServerAvailable() {
  try {
    const response = await fetch(`${baseURL}/api/health`, {
      signal: AbortSignal.timeout(1_000),
    });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

if (await isServerAvailable()) {
  throw new Error(`Refusing to start E2E: ${baseURL} is already in use.`);
}

const server = spawn(process.execPath, serverArguments, {
  cwd: serverDirectory,
  env: serverEnvironment,
  stdio: 'inherit',
  windowsHide: true,
  detached: process.platform !== 'win32',
});

let serverExited = false;
const serverExit = new Promise(resolve => {
  server.once('exit', () => {
    serverExited = true;
    resolve();
  });
});

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (serverExited) throw new Error('The isolated E2E server exited before becoming ready.');
    if (await isServerAvailable()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for the isolated E2E server.');
}

async function stopServer() {
  if (serverExited || !server.pid) return;

  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/pid', String(server.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    await Promise.race([
      new Promise(resolve => killer.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 5_000)),
    ]);
    await Promise.race([
      serverExit,
      new Promise(resolve => setTimeout(resolve, 2_000)),
    ]);
    return;
  }

  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {}
  await Promise.race([
    serverExit,
    new Promise(resolve => setTimeout(resolve, 5_000)),
  ]);
  if (!serverExited) {
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch {}
    await Promise.race([
      serverExit,
      new Promise(resolve => setTimeout(resolve, 2_000)),
    ]);
  }
}

let interrupted = false;
const interrupt = () => {
  if (interrupted) return;
  interrupted = true;
  void stopServer().finally(() => process.exit(130));
};
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);

let testExitCode = 1;
try {
  await waitForServer();
  const tests = spawn(process.execPath, [playwrightEntryPoint, 'test', ...process.argv.slice(2)], {
    cwd: projectDirectory,
    env: { ...process.env, NASDASH_E2E_EXTERNAL_SERVER: 'true' },
    stdio: 'inherit',
    windowsHide: true,
  });
  testExitCode = await new Promise((resolve, reject) => {
    tests.once('error', reject);
    tests.once('exit', code => resolve(code ?? 1));
  });
} finally {
  await stopServer();
}

process.exit(testExitCode);
