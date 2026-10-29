import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const projectDirectory = process.cwd();
const outputDirectory = path.join(projectDirectory, 'docs', 'assets', 'screenshots');
const port = Number.parseInt(process.env.NASDASH_CAPTURE_PORT || '2511', 10);
const baseURL = `http://127.0.0.1:${port}`;
const captureURL = `${baseURL}/?lang=en`;
const fixedTime = '2026-10-10T10:00:00.000Z';
const nextEntryPoint = path.join(projectDirectory, 'node_modules', 'next', 'dist', 'bin', 'next');
const LIGHT_THEMES = new Set([
  'apple-light',
  'github-light',
  'rose-pine-dawn',
  'solarized-light',
  'catppuccin-latte',
  'everforest-light',
  'tokyo-night-day',
  'gruvbox-light',
  'nord-light',
  'light',
]);

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

const stagingDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'nasdash-captures-'));
const shots = [];

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

function installCaptureHooks(page) {
  return page.addInitScript(({ timestamp }) => {
    try {
      sessionStorage.setItem('lh-demo-intro-seen', '1');
    } catch {}
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
  await page.locator('.nd-page-grid--placing').filter({ visible: true }).waitFor({ state: 'hidden', timeout: 30_000 });
  // Images on screen must be loaded; lazy ones further down may never start.
  await page.waitForFunction(() => [...document.images].every(img => img.complete || img.loading === 'lazy'), undefined, { timeout: 15_000 }).catch(() => {});
  const broken = await page.evaluate(() => [...document.images].filter(img => img.complete && img.naturalWidth === 0 && img.getBoundingClientRect().height > 0).map(img => img.src.slice(0, 120)));
  if (broken.length) console.warn('[NASDASH] Broken images on this capture:', broken);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(600);
}

async function dismissDemoChrome(page) {
  const dialog = page.locator('dialog.nd-demo-dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Explore on my own', exact: true }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
  }
  const closeBanner = page.getByRole('button', { name: 'Hide demo banner' });
  if (await closeBanner.isVisible().catch(() => false)) await closeBanner.click();
}

async function assertReadyForCapture(page) {
  if (await page.locator('dialog.nd-demo-dialog[open]').count()) {
    throw new Error('Demo intro dialog is still open.');
  }
  const demo = await page.evaluate(async () => (await (await fetch('/api/config')).json()).demoMode);
  if (demo !== true) throw new Error('Refusing to capture a non-demo configuration.');
  const lang = await page.locator('html').getAttribute('lang');
  if (lang && !lang.toLowerCase().startsWith('en')) {
    throw new Error(`Expected English UI, got html lang=${lang}`);
  }
}

async function waitForHomeData(page) {
  await page.locator('[data-page-id="dashboard"] .nd-page-grid:not(.nd-page-grid--placing)').waitFor({ timeout: 30_000 });
  await page.getByText('Atlas NAS', { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 20_000 });
  await page.waitForFunction(() => /CPU\s+\d+\s?%/.test(document.body.innerText));
  await page.getByText(/Excellent/).filter({ visible: true }).first().waitFor({ timeout: 20_000 });
}

async function waitForDockerDetail(page) {
  const detail = page.locator('.nd-docker-detail').filter({ visible: true });
  if (!(await detail.getByText('jellyfin', { exact: true }).count())) {
    await page.getByText('jellyfin', { exact: true }).filter({ visible: true }).first().click();
  }
  await detail.getByText('Volumes', { exact: true }).waitFor({ timeout: 20_000 });
  await page.getByText(/jellyfin container starting/).waitFor({ timeout: 20_000 });
}

async function capture(page, name, fullPage = name.startsWith('nasdash-demo-home'), { demo = true } = {}) {
  await settle(page);
  if (demo) {
    await dismissDemoChrome(page);
    await assertReadyForCapture(page);
  }
  const destination = path.join(stagingDirectory, `${name}.jpg`);
  await page.screenshot({ path: destination, type: 'jpeg', quality: 88, fullPage });
  const png = await page.screenshot({ type: 'png', fullPage });
  if (name === 'nasdash-demo-home') await fs.writeFile(path.join(stagingDirectory, 'legacy-home.png'), png);
  shots.push({ file: `${name}.jpg`, width: png.readUInt32BE(16), height: png.readUInt32BE(20), viewport: page.viewportSize(), fullPage, sha256: crypto.createHash('sha256').update(await fs.readFile(destination)).digest('hex') });
  console.log(`[NASDASH] Captured ${name}.jpg`);
}

async function selectDesktopTab(page, name) {
  await page.locator('.nd-header-desktop').getByRole('button', { name, exact: true }).click();
}

async function applySettings(page, updates) {
  const result = await page.evaluate(async (body) => {
    const response = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'settings', ...body }),
    });
    return { ok: response.ok, status: response.status, text: await response.text() };
  }, updates);
  if (!result.ok) throw new Error(`Settings update failed (${result.status}): ${result.text}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForHomeData(page);
  await dismissDemoChrome(page);
}

async function applyTheme(page, theme) {
  await applySettings(page, {
    theme,
    mode: LIGHT_THEMES.has(theme) ? 'light' : 'dark',
  });
}

async function openSettings(page) {
  await page.locator('.nd-header-desktop').getByTitle('Global Settings').click();
  await page.getByRole('dialog', { name: 'NasDash Settings' }).waitFor();
}

async function closeSettings(page) {
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'NasDash Settings' }).waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
}

/**
 * A throwaway new installation for the first-start screens. Its setup code is
 * read from the server log and never printed; the data folder is deleted after.
 */
async function startFreshInstall() {
  const freshPort = port + 1;
  const dataDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'nasdash-capture-fresh-'));
  for (const entry of await fs.readdir(path.join(projectDirectory, 'data'))) {
    if (entry.endsWith('.example.json')) await fs.copyFile(path.join(projectDirectory, 'data', entry), path.join(dataDirectory, entry));
  }
  let log = '';
  const child = spawn(process.execPath, [nextEntryPoint, 'dev', '-H', '127.0.0.1', '-p', String(freshPort)], {
    cwd: projectDirectory,
    env: {
      ...process.env,
      NASDASH_DEMO_MODE: 'false',
      NASDASH_DATA_DIR: dataDirectory,
      NASDASH_JWT_SECRET: 'nasdash-screenshot-runtime-only',
      NASDASH_NEXT_DIST_DIR: '.next-capture-fresh',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  const url = `http://127.0.0.1:${freshPort}`;
  const deadline = Date.now() + 120_000;
  let code;
  while (Date.now() < deadline && !code) {
    try { await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1_000) }); } catch {}
    code = log.match(/Setup code: ([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/)?.[1];
    if (!code) await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!code) throw new Error('The new installation did not print its setup code.');
  const stop = async () => {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    await fs.rm(dataDirectory, { recursive: true, force: true });
  };
  return { url, code, stop };
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const desktop = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'Europe/Paris',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  });
  const desktopPage = await desktop.newPage();
  await installCaptureHooks(desktopPage);
  await desktopPage.goto(captureURL);
  await waitForHomeData(desktopPage);
  await dismissDemoChrome(desktopPage);
  await capture(desktopPage, 'nasdash-demo-home');

  // One capture per themed page of the demo.
  await selectDesktopTab(desktopPage, 'Services');
  await capture(desktopPage, 'nasdash-demo-services');

  await selectDesktopTab(desktopPage, 'Machines');
  await desktopPage.getByText('Atlas NAS', { exact: true }).filter({ visible: true }).first().waitFor();
  await capture(desktopPage, 'nasdash-demo-machines');

  await selectDesktopTab(desktopPage, 'Docker');
  await waitForDockerDetail(desktopPage);
  await capture(desktopPage, 'nasdash-demo-docker');

  await selectDesktopTab(desktopPage, 'Network');
  await desktopPage.getByText(/Excellent/).filter({ visible: true }).first().waitFor({ timeout: 20_000 });
  await capture(desktopPage, 'nasdash-demo-networks');

  for (const [tab, filename] of [['Media', 'nasdash-demo-media'], ['Downloads', 'nasdash-demo-downloads'], ['Music', 'nasdash-demo-music'], ['Feeds', 'nasdash-demo-feeds']]) {
    await selectDesktopTab(desktopPage, tab);
    await capture(desktopPage, filename);
  }
  await selectDesktopTab(desktopPage, 'Home');

  await openSettings(desktopPage);
  await capture(desktopPage, 'nasdash-demo-settings');
  await desktopPage.getByRole('button', { name: /All themes/ }).click();
  await desktopPage.getByRole('heading', { name: 'Themes and icons', exact: true }).waitFor({ timeout: 15_000 });
  await capture(desktopPage, 'nasdash-demo-themes');
  await closeSettings(desktopPage);

  await selectDesktopTab(desktopPage, 'Home');
  await desktopPage.locator('.nd-header-desktop').getByTitle('Edit Mode').click();
  await capture(desktopPage, 'nasdash-demo-editor');
  await desktopPage.getByRole('button', { name: 'Add a widget', exact: true }).click();
  await desktopPage.getByRole('dialog', { name: 'Add a widget' }).waitFor();
  await capture(desktopPage, 'nasdash-demo-library');
  await desktopPage.keyboard.press('Escape');
  await desktopPage.getByRole('button', { name: 'Done', exact: true }).click();

  const themeShots = [
    ['github-light', 'nasdash-demo-home-github-light'],
    ['apple-dark', 'nasdash-demo-home-apple-dark'],
    ['dracula', 'nasdash-demo-home-dracula'],
    ['nord', 'nasdash-demo-home-nord'],
    ['cyberpunk', 'nasdash-demo-home-cyberpunk'],
  ];
  for (const [theme, filename] of themeShots) {
    await applyTheme(desktopPage, theme);
    await selectDesktopTab(desktopPage, 'Home');
    await capture(desktopPage, filename);
  }

  await applyTheme(desktopPage, 'nasdash');
  await desktop.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'Europe/Paris',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  await installCaptureHooks(mobilePage);
  await mobilePage.goto(captureURL);
  await waitForHomeData(mobilePage);
  await dismissDemoChrome(mobilePage);
  await capture(mobilePage, 'nasdash-demo-mobile-home');
  await mobilePage.getByRole('button', { name: 'Open menu' }).click();
  await mobilePage.locator('.nd-mobile-menu-content').getByRole('button', { name: 'Docker', exact: true }).click();
  await waitForDockerDetail(mobilePage);
  await capture(mobilePage, 'nasdash-demo-mobile-docker');
  await mobile.close();

  // First start, on a new installation: sign-in with the setup code, the five steps of the guide, the tour.
  await stopServer();
  const install = await startFreshInstall();
  try {
    const first = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: 'dark', locale: 'en-US', timezoneId: 'Europe/Paris', reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const firstPage = await first.newPage();
    await installCaptureHooks(firstPage);
    await firstPage.goto(`${install.url}/login?lang=en`);
    await firstPage.getByLabel('Setup code').waitFor();
    await capture(firstPage, 'nasdash-first-start-code', false, { demo: false });
    await firstPage.getByLabel('Setup code').fill(install.code);
    await firstPage.getByRole('button', { name: 'Continue', exact: true }).click();
    await firstPage.getByLabel('New password').waitFor({ timeout: 30_000 });
    await capture(firstPage, 'nasdash-guide-account', false, { demo: false });
    const password = crypto.randomBytes(18).toString('base64url');
    await firstPage.getByLabel('New password').fill(password);
    await firstPage.getByLabel('Confirm').fill(password);
    for (const step of ['nasdash-guide-appearance', 'nasdash-guide-integrations', 'nasdash-guide-widgets', 'nasdash-guide-access']) {
      await firstPage.getByRole('button', { name: 'Continue', exact: true }).click();
      await firstPage.waitForTimeout(1_200);
      await capture(firstPage, step, false, { demo: false });
    }
    await firstPage.getByRole('button', { name: 'Open the dashboard', exact: true }).click();
    const bubble = firstPage.locator('.nd-tour-bubble');
    await bubble.waitFor({ timeout: 30_000 });
    await firstPage.keyboard.press('ArrowRight');
    await firstPage.waitForTimeout(600);
    await capture(firstPage, 'nasdash-tour', false, { demo: false });
    await first.close();
  } finally {
    await install.stop();
  }

  const manifest = {
    productVersion: JSON.parse(await fs.readFile(path.join(projectDirectory, 'package.json'), 'utf8')).version,
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectDirectory, encoding: 'utf8' }).trim(),
    capturedAt: new Date().toISOString(),
    demoReferenceTime: fixedTime,
    language: 'en',
    shots,
  };
  await fs.mkdir(outputDirectory, { recursive: true });
  for (const shot of shots) await fs.copyFile(path.join(stagingDirectory, shot.file), path.join(outputDirectory, shot.file));
  await fs.copyFile(path.join(stagingDirectory, 'legacy-home.png'), path.join(projectDirectory, 'public', 'nasdash.png'));
  await fs.writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[NASDASH] Published complete set of ${shots.length} captures.`);
} finally {
  await browser?.close();
  await stopServer();
  await fs.rm(stagingDirectory, { recursive: true, force: true });
}
