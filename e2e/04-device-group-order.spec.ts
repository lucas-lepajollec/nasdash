import { expect, test } from '@playwright/test';
import type { Page } from '@/lib/pages/types';

// Keep this suite's login attempts out of other suites' rate-limit buckets.
test.use({ extraHTTPHeaders: { 'x-forwarded-for': '198.18.0.4' } });

test('single-machine display groups move independently without converting readings', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Uses installed-instance fixtures.');
  expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'playwright-admin-password' } })).status()).toBe(200);
  expect((await page.request.put('/api/config', { data: { type: 'settings', uiLanguage: 'en', securityMode: 'public' } })).status()).toBe(200);
  const config = await (await page.request.get('/api/config')).json();
  const device = config.devices[0];
  const now = Date.now();
  await page.route('**/api/devices/*/history?*', route => route.fulfill({ json: {
    online: true, updatedAt: now, vitals: { cores: 8, load: [0.2, 0.3, 0.4] },
    metrics: [
      { key: 'cpu.usage', kind: 'cpu', percent: 5, temperatureC: 50 },
      { key: 'memory.usage', kind: 'memory', percent: 45 },
      { key: 'gpu:0', kind: 'gpu', percent: 12 },
      { key: 'disk:/a', name: 'a', kind: 'disk', percent: 33 },
      { key: 'disk:/b', name: 'b', kind: 'disk', percent: 45 },
    ],
    series: Object.fromEntries(['cpu.usage', 'memory.usage', 'gpu:0', 'cpu.usage@temp', 'load.1'].map(key => [key, [[now - 10_000, 10], [now, 20]]])),
  } }));
  const metrics = {
    cpu: { shown: true, display: 'ring' }, memory: { shown: true, display: 'ring' },
    temperature: { shown: true, display: 'value' }, load: { shown: true, display: 'value' },
    disk: { shown: true, display: 'bar' }, gpu: { shown: true, display: 'chart' },
    history: { shown: true, display: 'chart' }, network: { shown: false },
  };
  const { page: fixture } = await (await page.request.post('/api/pages', { data: { action: 'create', template: 'blank', name: 'Device groups' } })).json() as { page: Page };
  try {
    expect((await page.request.put('/api/pages', { data: { page: { ...fixture, widgets: [
      { id: 'device-groups', type: 'device', x: 0, y: 0, w: 24, h: 200, settings: { deviceId: device.id, perMetricDisplay: true, metrics } },
    ] } } })).status()).toBe(200);
    await page.addInitScript(id => localStorage.setItem('nasdash-active-tab', id), fixture.id);
    await page.goto('/');
    const widget = page.locator('[data-widget-id="device-groups"]');
    const groups = widget.locator('.ndc-dev-sections > [data-metric-entry]');
    const groupIds = () => groups.evaluateAll(elements => elements.map(element => element.getAttribute('data-metric-entry')));
    await expect.poll(groupIds).toEqual(['ring', 'value', 'bar', 'chart']);
    await expect(widget.locator('.ndc-group-drag')).toHaveCount(0);
    await page.getByTitle('Edit mode', { exact: true }).filter({ visible: true }).click();
    await expect(widget.locator('.ndc-group-drag')).toHaveCount(4);
    const bar = widget.getByRole('button', { name: 'Move group · Bar', exact: true });
    const ring = widget.getByRole('button', { name: 'Move group · Ring', exact: true });
    await bar.scrollIntoViewIfNeeded();
    const from = await bar.boundingBox();
    const to = await ring.boundingBox();
    expect(from && to).toBeTruthy();
    await page.mouse.move(from!.x + 6, from!.y + 8);
    await page.mouse.down();
    await page.mouse.move(to!.x + 6, to!.y + 8, { steps: 12 });
    await page.mouse.up();
    await expect.poll(groupIds).toEqual(['bar', 'ring', 'value', 'chart']);
    await expect(widget.locator('[data-device-section="ring"] .ndc-m--ring')).toHaveCount(2);
    await expect(widget.locator('[data-device-section="bar"] .ndc-m--bar')).toHaveCount(2);
    await expect(widget.locator('[data-device-section="value"] .ndc-m--value')).toHaveCount(2);
    const chart = widget.getByRole('button', { name: 'Move group · Chart', exact: true });
    await chart.scrollIntoViewIfNeeded();
    await chart.focus();
    await page.keyboard.press('Space');
    await expect(chart).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    await page.keyboard.press('ArrowUp');
    await expect(widget.getByRole('status').filter({ hasText: 'Chart, position 3 of 4' })).toHaveCount(1);
    await page.keyboard.press('Space');
    await expect.poll(groupIds).toEqual(['bar', 'ring', 'chart', 'value']);
    await page.getByRole('toolbar', { name: 'Page editing' }).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('toolbar', { name: 'Page editing' })).toBeHidden();
    await page.reload();
    await expect.poll(groupIds).toEqual(['bar', 'ring', 'chart', 'value']);
    await expect(widget.locator('.ndc-group-drag')).toHaveCount(0);
    const saved = await (await page.request.get('/api/pages')).json();
    const stored = saved.pages.find((item: Page) => item.id === fixture.id).widgets[0];
    expect(stored.settings.metrics).toEqual(metrics);
    expect(stored.settings.deviceGroupOrder).toEqual(['bar', 'ring', 'chart', 'value']);

    // Inner metric sorting still works in the nested drag scope and cancels safely.
    await page.getByTitle('Edit mode', { exact: true }).filter({ visible: true }).click();
    const ringLabels = widget.locator('[data-device-section="ring"] .ndc-m-label');
    const original = await ringLabels.allTextContents();
    const reading = widget.locator('[data-device-section="ring"] .ndc-m-drag').first();
    await reading.scrollIntoViewIfNeeded();
    await reading.focus();
    await page.keyboard.press('Space');
    await expect(reading).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(ringLabels).toHaveText(original);
    await expect.poll(groupIds).toEqual(['bar', 'ring', 'chart', 'value']);
    await page.getByRole('toolbar', { name: 'Page editing' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  } finally {
    expect((await page.request.delete(`/api/pages?id=${fixture.id}`)).status()).toBe(200);
  }
});
