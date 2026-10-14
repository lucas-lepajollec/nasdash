import { expect, test } from '@playwright/test';
import type { Page } from '@/lib/pages/types';

test('Storage groups hosts, saves its sort mode and keeps chart colours stable', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Uses the isolated installed-instance fixtures.');
  expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'playwright-admin-password' } })).status()).toBe(200);
  expect((await page.request.put('/api/config', { data: { type: 'settings', uiLanguage: 'en', securityMode: 'public' } })).status()).toBe(200);
  const config = await (await page.request.get('/api/config')).json();
  const [first, second] = config.devices;
  const now = Date.now();
  await page.route('**/api/devices/*/history?*', route => {
    const isFirst = route.request().url().includes(`/devices/${first.id}/`);
    const disks = isFirst
      ? [{ key: 'disk:/volume10', name: 'volume10', percent: 66 }, { key: 'disk:/volume2', name: 'volume2', percent: 31 }]
      : [{ key: 'disk:/', name: '/', percent: 58 }];
    return route.fulfill({ json: {
      online: true, updatedAt: now, vitals: {},
      metrics: [{ key: 'cpu.usage', kind: 'cpu', percent: 5, temperatureC: 50 }, ...disks.map(disk => ({ ...disk, kind: 'disk', totalBytes: 1024 ** 4 }))],
      series: Object.fromEntries(disks.map(disk => [disk.key, [[now - 10_000, disk.percent - 1], [now, disk.percent]]])),
    } });
  });
  const created = await page.request.post('/api/pages', { data: { action: 'create', template: 'blank', name: 'Storage feedback' } });
  expect(created.status()).toBe(201);
  const { page: fixture } = await created.json() as { page: Page };
  try {
    expect((await page.request.put('/api/pages', { data: { page: { ...fixture, widgets: [
      { id: 'storage-feedback', type: 'storage', x: 0, y: 0, w: 12, h: 100, settings: { deviceIds: [first.id, second.id] } },
      { id: 'temperature-feedback', type: 'metric-temperature', x: 12, y: 0, w: 12, h: 60, settings: { deviceIds: [first.id] } },
    ] } } })).status()).toBe(200);
    await page.addInitScript(id => localStorage.setItem('nasdash-active-tab', id), fixture.id);
    await page.goto('/');
    const storage = page.locator('[data-widget-id="storage-feedback"]');
    const hostOrder = [`volume2 · ${first.name}`, `volume10 · ${first.name}`, `${second.name}`];
    const usageOrder = [`volume10 · ${first.name}`, `${second.name}`, `volume2 · ${first.name}`];
    await expect(storage.locator('.ndc-m-label')).toHaveText(hostOrder);
    await expect(page.locator('[data-widget-id="temperature-feedback"]')).toContainText('50 °C');
    await page.getByTitle('Edit mode', { exact: true }).click();
    const openSettings = () => storage.getByRole('button', { name: 'Storage settings', exact: true }).click({ timeout: 5000 });
    const dialog = page.getByRole('dialog', { name: 'Storage settings', exact: true });
    await openSettings();
    await expect(dialog.getByRole('radio', { name: 'By host', exact: true })).toHaveAttribute('aria-checked', 'true');
    await dialog.getByRole('radio', { name: 'By usage', exact: true }).click();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(storage.locator('.ndc-m-label')).toHaveText(hostOrder);
    await openSettings();
    await dialog.getByRole('radio', { name: 'By usage', exact: true }).click();
    await dialog.getByRole('radio', { name: 'Ring', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(storage.locator('.ndc-m-label')).toHaveText(usageOrder);
    await expect(storage.locator('.ndc-m--ring')).toHaveCount(3);
    await page.getByRole('toolbar', { name: 'Page editing' }).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('toolbar', { name: 'Page editing' })).toBeHidden();
    await page.reload();
    await expect(storage.locator('.ndc-m-label')).toHaveText(usageOrder);
    const saved = await (await page.request.get('/api/pages')).json();
    expect(saved.pages.find((item: Page) => item.id === fixture.id).widgets[0].settings.storageOrder).toBe('usage');
    await page.getByTitle('Edit mode', { exact: true }).click();
    await openSettings();
    await dialog.getByRole('radio', { name: 'By host', exact: true }).click();
    await dialog.getByRole('radio', { name: 'Figure', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(storage.locator('.ndc-m-label')).toHaveText(hostOrder);
    await expect(storage.locator('.ndc-m--value')).toHaveCount(3);
    await openSettings();
    await dialog.getByRole('radio', { name: 'Chart', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    const legend = storage.locator('.ndc-legend-item');
    await expect(legend).toHaveText(hostOrder);
    const colours = () => legend.evaluateAll(items => Object.fromEntries(items.map(item => [item.textContent, (item.querySelector('.ndc-legend-mark') as HTMLElement).style.background])));
    const groupedColours = await colours();
    await openSettings();
    await dialog.getByRole('radio', { name: 'By usage', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(legend).toHaveText(usageOrder);
    expect(await colours()).toEqual(groupedColours);
  } finally {
    expect((await page.request.delete(`/api/pages?id=${fixture.id}`)).status()).toBe(200);
  }
});
