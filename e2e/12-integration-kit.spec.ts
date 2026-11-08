import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * The integration kit end to end, against local fake services built from the
 * collectors' samples: a connection saved from Settings → Integrations, the
 * connection test, the three kit widgets on a page, an administrator's
 * actions (a speed test, a container update after its confirmation) and what
 * a viewer may not see. Everything created is removed afterwards.
 */
test.use({ extraHTTPHeaders: { 'x-forwarded-for': '198.18.0.12' } });

const sample = (id: string, name: string) => JSON.parse(readFileSync(join(process.cwd(), 'src', 'integrations', id, 'samples', `${name}.json`), 'utf8'));
const send = (res: http.ServerResponse, status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };

function fakeServices() {
  const syncthing = sample('syncthing', 'service');
  const results = sample('speedtest', 'results');
  // The latest result is recent, so the widget is not told about a test from long ago.
  const now = new Date(Date.now() - 5 * 60_000).toISOString().replace('T', ' ').slice(0, 19);
  results.data = results.data.map((result: Record<string, unknown>, index: number) => index === 1 ? { ...result, created_at: now } : result).filter((_: unknown, index: number) => index !== 0);
  const containers = sample('wud', 'containers').map((container: Record<string, unknown>) => ({ ...container }));
  const calls: string[] = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://fake');
    calls.push(`${req.method} ${url.pathname}`);
    if (url.pathname.startsWith('/rest/')) {
      if (req.headers['x-api-key'] !== 'kit-syncthing-key') return send(res, 403, {});
      if (url.pathname === '/rest/db/status') return send(res, 200, syncthing.folderStatus[url.searchParams.get('folder') ?? ''] ?? {});
      const routes: Record<string, unknown> = { '/rest/system/status': syncthing.status, '/rest/system/version': syncthing.version, '/rest/config/folders': syncthing.folders, '/rest/config/devices': syncthing.devices, '/rest/system/connections': syncthing.connections };
      return url.pathname in routes ? send(res, 200, routes[url.pathname]) : send(res, 404, {});
    }
    if (url.pathname.startsWith('/api/v1/')) {
      if (req.headers.authorization !== 'Bearer kit-speedtest-token') return send(res, 401, { message: 'Unauthenticated.' });
      if (url.pathname === '/api/v1/results') return send(res, 200, results);
      if (url.pathname === '/api/v1/speedtests/run' && req.method === 'POST') return send(res, 201, { data: { id: 99, status: 'waiting' } });
      return send(res, 404, {});
    }
    if (url.pathname === '/api/containers') return send(res, 200, containers);
    const match = /^\/api\/containers\/([^/]+)\/(triggers|watch)(?:\/(docker)\/(local))?$/.exec(url.pathname);
    const container = match && containers.find((item: Record<string, unknown>) => item.id === match[1]);
    if (!container) return send(res, 404, {});
    if (match[2] === 'watch') return send(res, 200, container);
    if (req.method === 'GET') return send(res, 200, [{ id: 'docker.local', type: 'docker', name: 'local' }, { id: 'smtp.mail', type: 'smtp', name: 'mail' }]);
    setTimeout(() => { Object.assign(container, { updateAvailable: false }); send(res, 200, {}); }, 1500);
  });
  return { server, calls };
}

async function removeKit(request: APIRequestContext, original: unknown) {
  const config = await (await request.get('/api/config')).json();
  for (const instance of config.integrations ?? []) {
    if (['syncthing', 'speedtest', 'wud'].includes(instance.type)) await request.delete(`/api/config?type=integration&id=${encodeURIComponent(instance.id)}`);
  }
  if (original) {
    const current = (await (await request.get('/api/pages')).json()).pages.find((page: { id: string }) => page.id === (original as { id: string }).id);
    await request.put('/api/pages', { data: { page: { ...(original as object), revision: current.revision } } });
  }
}

test('kit integrations connect from the settings, show their widgets and run their actions', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Uses installed-instance fixtures.');
  test.setTimeout(90_000);
  const { server, calls } = fakeServices();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'playwright-admin-password' } })).status()).toBe(200);
  const pages = (await (await page.request.get('/api/pages')).json()).pages;
  const home = pages[0];
  try {
    // Syncthing through the dialog, as an administrator does it.
    await page.goto('/?lang=en');
    await page.getByRole('button', { name: 'Global Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'NasDash Settings' });
    await settings.locator('.nd-settings-sidebar').getByRole('button', { name: 'Integrations', exact: true }).click();
    const section = settings.locator('#settings-integrations-sync');
    await expect(section).toContainText('File sync');
    await section.locator('.ndc-int-tile', { hasText: 'Syncthing' }).click();
    const dialog = page.getByRole('dialog', { name: /Syncthing/ });
    await dialog.locator('#service-url').fill(base);
    await dialog.locator('#service-apiKey').fill('kit-syncthing-key');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(section.locator('.ndc-int-state.is-ok')).toHaveCount(1);
    await expect(settings.locator('#settings-integrations-speedtest')).toContainText('Speedtest Tracker');
    await expect(settings.locator('#settings-integrations-updates')).toContainText("What's Up Docker");
    await page.keyboard.press('Escape');

    // The two others with the API the dialog uses; a wrong token fails the test with an authentication error.
    const save = async (integration: Record<string, unknown>) => {
      const response = await page.request.put('/api/config', { data: { type: 'integration', integration } });
      expect(response.status()).toBe(200);
      return (await response.json()).id as string;
    };
    const speedtest = await save({ type: 'speedtest', name: 'Fibre', settings: { url: base }, secrets: { token: 'kit-speedtest-token' } });
    const wud = await save({ type: 'wud', name: 'WUD', settings: { url: base, auth: 'none' }, secrets: {} });
    const wrong = await (await page.request.post('/api/integrations/test', { data: { type: 'speedtest', settings: { url: base }, secrets: { token: 'nope' } } })).json();
    expect(wrong).toMatchObject({ ok: false, message: 'integrations.error.authentication' });
    expect(await (await page.request.post('/api/integrations/test', { data: { id: wud } })).json()).toMatchObject({ ok: true });

    // The three widgets on Home.
    const config = await (await page.request.get('/api/config')).json();
    const syncthing = config.integrations.find((instance: { type: string }) => instance.type === 'syncthing').id;
    const widgets = [
      { id: 'kit-syncthing', type: 'syncthing', settings: { integrationId: syncthing }, x: 0, y: 400, w: 8, h: 60 },
      { id: 'kit-speedtest', type: 'speedtest', settings: { integrationId: speedtest, jitter: true, plan: 1000 }, x: 8, y: 400, w: 8, h: 60 },
      { id: 'kit-updates', type: 'container-updates', settings: { integrationId: wud, icons: false }, x: 16, y: 400, w: 8, h: 60 },
    ];
    expect((await page.request.put('/api/pages', { data: { page: { ...home, widgets: [...home.widgets, ...widgets] } } })).status()).toBe(200);
    await page.goto('/?lang=en');

    const sync = page.locator('.ndc-widget', { has: page.locator('.ndw-kit') }).filter({ hasText: 'Documents' });
    await expect(sync).toContainText('Photos');
    await expect(sync).toContainText('2 failed');
    await expect(sync).toContainText('laptop');
    const speed = page.locator('.ndw-speed');
    await expect(speed).toContainText('880');
    await expect(speed).toContainText('Jitter');
    await expect(speed).toContainText('88% of your 1 Gbit/s');
    const updates = page.locator('.ndw-upd');
    await expect(updates).toContainText('postgres');
    await expect(updates.locator('.ndw-upd-number')).toHaveText('3');

    // Actions: a speed test, then one container updated after the confirmation.
    await speed.getByRole('button', { name: 'Run a speed test' }).click();
    await expect.poll(() => calls.includes('POST /api/v1/speedtests/run')).toBe(true);
    await updates.getByRole('button', { name: 'Update jellyfin' }).click();
    const confirm = page.getByRole('dialog', { name: 'Update jellyfin?' });
    await expect(confirm).toContainText('10.11.0');
    await confirm.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(updates).toContainText('Updating…');
    await expect.poll(() => calls.includes('POST /api/containers/a1/triggers/docker/local')).toBe(true);
    await expect(updates).toContainText('Updated', { timeout: 20_000 });
    expect(calls).toContain('POST /api/containers/a1/watch');
    // postgres has the same trigger here: the update button is offered; a made-up id is refused by the server.
    expect((await page.request.post('/api/widgets/kit', { data: { widget: 'container-updates', widgetId: 'kit-updates', action: 'update', target: 'not-listed' } })).status()).toBe(409);
    expect(calls.filter(call => call.includes('not-listed'))).toEqual([]);

    // A viewer: the addresses of the connections stay on the server, and no action runs.
    await page.request.post('/api/auth/logout');
    expect((await page.request.post('/api/auth/login', { data: { username: 'viewer', password: 'playwright-viewer-password' } })).status()).toBe(200);
    const visible = await (await page.request.get('/api/config')).json();
    for (const instance of (visible.integrations ?? []).filter((item: { type: string }) => ['syncthing', 'speedtest', 'wud'].includes(item.type))) {
      expect(instance.settings?.url).toBeUndefined();
      expect(instance.secrets).toBeUndefined();
    }
    expect((await page.request.post('/api/widgets/kit', { data: { widget: 'speedtest', widgetId: 'kit-speedtest', action: 'run' } })).status()).toBe(403);
    await page.request.post('/api/auth/logout');
    expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'playwright-admin-password' } })).status()).toBe(200);
    expect(failures).toEqual([]);
  } finally {
    await removeKit(page.request, home);
    await new Promise(resolve => server.close(resolve));
  }
});
