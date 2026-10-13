import { expect, test } from '@playwright/test';

test.use({ extraHTTPHeaders: { 'x-forwarded-for': '198.18.0.9' } });
test('explicit None exposes neither pages nor service addresses while legacy public viewers retain access', async ({ page, browser }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Installed account permissions');
  expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'playwright-admin-password' } })).status()).toBe(200);
  const original = await (await page.request.get('/api/config')).json();
  const username = 'playwright-no-access';
  expect((await page.request.post('/api/auth/users', { data: { username, password: 'playwright-audit-none-password', role: 'viewer', allowedTabs: ['__nasdash_none__'], allowedWidgets: ['__nasdash_none__'] } })).status()).toBe(200);
  const viewer = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': '198.18.0.90' } });
  try {
    expect((await page.request.put('/api/config', { data: { type: 'settings', securityMode: 'private' } })).status()).toBe(200);
    expect((await viewer.request.post('/api/auth/login', { data: { username, password: 'playwright-audit-none-password' } })).status()).toBe(200);
    const bootstrap = await (await viewer.request.get('/api/config')).json();
    expect(bootstrap.categories).toEqual([]);
    expect(bootstrap.devices).toEqual([]);
    expect(bootstrap.dockerHosts).toEqual([]);
    expect((await (await viewer.request.get('/api/pages')).json()).pages).toEqual([]);
    expect((await viewer.request.get('/api/calendar')).status()).toBe(403);
    if (original.devices[0]) expect((await viewer.request.get(`/api/devices/${original.devices[0].id}/history`)).status()).toBe(403);
  } finally {
    await viewer.close();
    expect((await page.request.delete(`/api/auth/users?username=${username}`)).status()).toBe(200);
    expect((await page.request.put('/api/config', { data: { type: 'settings', securityMode: original.settings.securityMode } })).status()).toBe(200);
  }
});
