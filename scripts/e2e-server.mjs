import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectDirectory = process.cwd();
const e2eDirectory = path.resolve(projectDirectory, '.e2e');
const dataDirectory = path.join(e2eDirectory, 'data');
const sourceDataDirectory = path.join(projectDirectory, 'data');

if (path.dirname(dataDirectory) !== e2eDirectory) {
  throw new Error('Refusing to prepare an E2E data directory outside .e2e.');
}

fs.rmSync(dataDirectory, { recursive: true, force: true });
fs.mkdirSync(path.join(dataDirectory, 'logos'), { recursive: true });

for (const entry of fs.readdirSync(sourceDataDirectory, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.example.json')) {
    fs.copyFileSync(
      path.join(sourceDataDirectory, entry.name),
      path.join(dataDirectory, entry.name),
    );
  }
}

const productionMode = process.env.NASDASH_E2E_SERVER_MODE === 'production';
const nextArguments = [
  path.join(projectDirectory, 'node_modules', 'next', 'dist', 'bin', 'next'),
  productionMode ? 'start' : 'dev',
  '-H',
  '127.0.0.1',
  '-p',
  '2510',
];

const child = spawn(process.execPath, nextArguments, {
  cwd: projectDirectory,
  env: {
    ...process.env,
    NASDASH_DATA_DIR: dataDirectory,
    NASDASH_ADMIN_PASSWORD: 'playwright-admin-password',
    NASDASH_VIEWER_PASSWORD: 'playwright-viewer-password',
    NASDASH_JWT_SECRET: 'playwright-only-secret-never-used-in-production',
    NEXT_TELEMETRY_DISABLED: '1',
    ...(productionMode ? {} : { NASDASH_NEXT_DIST_DIR: '.next-e2e' }),
  },
  stdio: 'inherit',
});

const forwardSignal = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('error', error => {
  console.error('Unable to start the isolated E2E server:', error);
  process.exitCode = 1;
});

child.on('exit', code => {
  process.exit(code ?? 1);
});
