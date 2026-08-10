import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const baseURL = 'http://127.0.0.1:2510';
const projectDirectory = process.cwd();
const dataDirectory = path.join(projectDirectory, '.e2e', 'data');
const productionMode = process.env.NASDASH_E2E_SERVER_MODE === 'production';
const configuredDistDirectory = process.env.NASDASH_NEXT_DIST_DIR?.trim() || '.next';
const serverDirectory = productionMode
  ? path.resolve(projectDirectory, configuredDistDirectory, 'standalone')
  : projectDirectory;
const serverEntryPoint = productionMode
  ? path.join(serverDirectory, 'server.js')
  : path.join(projectDirectory, 'node_modules', 'next', 'dist', 'bin', 'next');
const serverCommand = productionMode
  ? `node "${serverEntryPoint}"`
  : `node "${serverEntryPoint}" dev -H 127.0.0.1 -p 2510`;
const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
);
const externalServer = process.env.NASDASH_E2E_EXTERNAL_SERVER === 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: externalServer ? undefined : {
    command: serverCommand,
    cwd: serverDirectory,
    env: {
      ...inheritedEnvironment,
      NASDASH_DATA_DIR: dataDirectory,
      NASDASH_ADMIN_PASSWORD: 'playwright-admin-password',
      NASDASH_VIEWER_PASSWORD: 'playwright-viewer-password',
      NASDASH_JWT_SECRET: 'playwright-only-secret-never-used-in-production',
      NEXT_TELEMETRY_DISABLED: '1',
      PORT: '2510',
      HOSTNAME: '127.0.0.1',
      ...(productionMode ? {} : { NASDASH_NEXT_DIST_DIR: '.next-e2e' }),
    },
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
