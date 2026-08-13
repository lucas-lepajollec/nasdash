import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const projectDirectory = process.cwd();
const outputDirectory = path.join(projectDirectory, 'docs', 'assets', 'screenshots');
const port = Number.parseInt(process.env.NASDASH_CAPTURE_PORT || '2511', 10);
const baseURL = `http://127.0.0.1:${port}`;
const fixedTime = '2026-08-12T10:00:00.000Z';
const nextEntryPoint = path.join(projectDirectory, 'node_modules', 'next', 'dist', 'bin', 'next');

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid capture port: ${process.env.NASDASH_CAPTURE_PORT}`);
}

async function isPortAvailable() {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(true));
  });
}

if (!(await isPortAvailable())) {
  throw new Error(`Refusing to capture: ${baseURL} is already in use.`);
}

await fs.mkdir(outputDirectory, { recursive: true });

const server = spawn(process.execPath, [nextEntryPoint, 'dev', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: projectDirectory,
  env: {
    ...process.env,
    NASDASH_DEMO_MODE: 'true',
    NASDASH_DEMO_REFERENCE_TIME: fixedTime,
    NASDASH_JWT_SECRET: 'nasdash-screenshot-runtime-only',
    NASDASH_NEXT_DIST_DIR: '.next-capture',
    NEXT_TELEMETRY_DISABLED: '1',
  },
  stdio: 'inherit',
  windowsHide: true,
  detached: process.platform !== 'win32',
});

let serverExited = false;
server.once('exit', () => {
  serverExited = true;
});

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (serverExited) throw new Error('The demo server exited before becoming ready.');
    try {
      const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for the demo capture server.');
}

async function stopServer() {
  if (serverExited || !server.pid) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/pid', String(server.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    await new Promise(resolve => killer.once('exit', resolve));
    return;
  }
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {}
}

function installFixedClock(page) {
  return page.addInitScript(({ timestamp }) => {
    const NativeDate = Date;
    const fixedTimestamp = new NativeDate(timestamp).getTime();
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(...(args.length === 0 ? [fixedTimestamp] : args));
      }
      static now() {
        return fixedTimestamp;
      }
    }
    globalThis.Date = FixedDate;
  }, { timestamp: fixedTime });
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !document.fonts || document.fonts.status === 'loaded');
  await page.addStyleTag({ content: `
    nextjs-portal {
      display: none !important;
    }
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      caret-color: transparent !important;
    }
  ` });
  await page.waitForTimeout(500);
}

async function waitForHomeData(page) {
  await page.getByText('25%', { exact: true }).first().waitFor({ timeout: 20_000 });
  await page.getByText(/Excellent/).filter({ visible: true }).first().waitFor({ timeout: 20_000 });
}

async function waitForDockerDetail(page) {
  await page.locator('.nd-docker-detail').getByText('Volumes', { exact: true }).waitFor({ timeout: 20_000 });
  await page.getByText(/jellyfin container starting/).waitFor({ timeout: 20_000 });
}

async function capture(page, name, fullPage = false) {
  await settle(page);
  const destination = path.join(outputDirectory, `${name}.jpg`);
  await page.screenshot({ path: destination, type: 'jpeg', quality: 88, fullPage });
  console.log(`[NASDASH] Captured ${path.relative(projectDirectory, destination)}`);
}

async function selectDesktopTab(page, name) {
  await page.locator('.nd-header-desktop').getByRole('button', { name, exact: true }).click();
}

async function hideDemoBanner(page) {
  const closeButton = page.getByRole('button', { name: 'Masquer le bandeau de démonstration' });
  if (await closeButton.isVisible().catch(() => false)) await closeButton.click();
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const desktop = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  });
  const desktopPage = await desktop.newPage();
  await installFixedClock(desktopPage);
  await desktopPage.goto(baseURL);
  await waitForHomeData(desktopPage);
  await capture(desktopPage, 'nasdash-demo-home');
  await hideDemoBanner(desktopPage);

  await selectDesktopTab(desktopPage, 'Docker');
  await waitForDockerDetail(desktopPage);
  await capture(desktopPage, 'nasdash-demo-docker');

  await selectDesktopTab(desktopPage, 'Réseaux');
  await desktopPage.getByText(/Excellent/).filter({ visible: true }).first().waitFor({ timeout: 20_000 });
  await capture(desktopPage, 'nasdash-demo-networks');

  await selectDesktopTab(desktopPage, 'Widgets');
  await capture(desktopPage, 'nasdash-demo-widgets');

  await desktopPage.locator('.nd-header-desktop').getByTitle('Paramètres globaux').click();
  await desktopPage.getByRole('dialog', { name: 'Paramètres NasDash' }).waitFor();
  await capture(desktopPage, 'nasdash-demo-settings');
  await desktop.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  await installFixedClock(mobilePage);
  await mobilePage.goto(baseURL);
  await waitForHomeData(mobilePage);
  await capture(mobilePage, 'nasdash-demo-mobile-home');
  await hideDemoBanner(mobilePage);
  await mobilePage.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await mobilePage.locator('.nd-mobile-menu-content').getByRole('button', { name: 'Docker', exact: true }).click();
  await waitForDockerDetail(mobilePage);
  await capture(mobilePage, 'nasdash-demo-mobile-docker');
  await mobile.close();
} finally {
  await browser?.close();
  await stopServer();
}
