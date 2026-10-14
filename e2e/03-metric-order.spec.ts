import { expect, test, type Locator } from '@playwright/test';
import type { Page } from '@/lib/pages/types';

// Keep this suite's login attempts out of other suites' rate-limit buckets.
test.use({ extraHTTPHeaders: { 'x-forwarded-for': '198.18.0.3' } });

test('metric dragging stays in its widget and persists through displays and Storage sort modes', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Uses installed-instance fixtures.');
  expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'playwright-admin-password' } })).status()).toBe(200);
  expect((await page.request.put('/api/config', { data: { type: 'settings', uiLanguage: 'en', securityMode: 'public' } })).status()).toBe(200);
  const config = await (await page.request.get('/api/config')).json();
  const [first, second] = config.devices;
  const now = Date.now();
  let hottestGpu = false;
  await page.route('**/api/devices/*/history?*', route => {
    const isFirst = route.request().url().includes(`/devices/${first.id}/`);
    const metrics = [
      { key: 'cpu.usage', kind: 'cpu', percent: 5, temperatureC: 50 },
      { key: 'memory.usage', kind: 'memory', percent: 45, totalBytes: 1024 ** 3 },
      { key: 'gpu:0', kind: 'gpu', percent: 12, temperatureC: hottestGpu ? 80 : 40 },
      ...(isFirst ? [
        { key: 'disk:/volume10', name: 'volume10', kind: 'disk', percent: 66 },
        { key: 'disk:/volume2', name: 'volume2', kind: 'disk', percent: 31 },
      ] : [{ key: 'disk:/', name: '/', kind: 'disk', percent: 58 }]),
    ];
    return route.fulfill({ json: {
      online: true, updatedAt: now, vitals: { cores: 8, load: [0.2, 0.3, 0.4], netRxBps: 1024, netTxBps: 512 }, metrics,
      series: Object.fromEntries([...metrics.map(metric => metric.key), 'cpu.usage@temp', 'net.rx', 'net.tx', 'load.1'].map(key => [key, [[now - 10_000, 10], [now, 20]]])),
    } });
  });
  const kinds = ['metric-cpu', 'metric-memory', 'metric-gpu', 'metric-temperature', 'metric-load', 'metric-network'];
  const { page: fixture } = await (await page.request.post('/api/pages', { data: { action: 'create', template: 'blank', name: 'Metric order' } })).json() as { page: Page };
  const widgets = [
    { id: 'order-storage', type: 'storage', x: 0, y: 0, w: 24, h: 80, settings: {} },
    ...kinds.map((type, index) => ({ id: `order-${type}`, type, x: 0, y: (index + 1) * 80, w: 24, h: 80, settings: { display: 'value' } })),
    { id: 'order-device', type: 'device', x: 0, y: 560, w: 24, h: 120, settings: { deviceId: first.id, display: 'bar', perMetricDisplay: false } },
  ];
  // The sortable sensor measures its rectangles on the next animation frame.
  const measuredFrame = () => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  const keyboardMove = async (widget: Locator, direction: string) => {
    const handle = widget.locator('.ndc-m-drag').first();
    await handle.scrollIntoViewIfNeeded();
    await measuredFrame();
    await handle.focus();
    await expect(handle).toBeFocused();
    await page.keyboard.press('Space');
    await expect(handle).toHaveAttribute('aria-pressed', 'true');
    await measuredFrame();
    await page.keyboard.press(direction);
    await expect(widget.getByRole('status').filter({ hasText: 'position 2 of' })).toHaveCount(1);
    await page.keyboard.press('Space');
    await expect(widget.locator('.is-dragging')).toHaveCount(0);
    await measuredFrame();
  };
  try {
    expect((await page.request.put('/api/pages', { data: { page: { ...fixture, widgets } } })).status()).toBe(200);
    await page.addInitScript(id => localStorage.setItem('nasdash-active-tab', id), fixture.id);
    await page.goto('/');
    await page.getByTitle('Edit mode', { exact: true }).click();
    const storage = page.locator('[data-widget-id="order-storage"]');
    const labels = storage.locator('.ndc-m-label');
    const hostOrder = [`volume2 · ${first.name}`, `volume10 · ${first.name}`, `${second.name}`];
    await expect(labels).toHaveText(hostOrder);
    await expect(storage.locator('.ndc-m-drag')).toHaveCount(0);
    const settingsButton = storage.getByRole('button', { name: 'Storage settings', exact: true });
    const dialog = page.getByRole('dialog', { name: 'Storage settings', exact: true });
    await settingsButton.click();
    await dialog.getByRole('radio', { name: 'Manual', exact: true }).click();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(storage.locator('.ndc-m-drag')).toHaveCount(0);
    await settingsButton.click();
    await dialog.getByRole('radio', { name: 'Manual', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(storage.locator('.ndc-m-drag')).toHaveCount(3);
    await expect(dialog).toBeHidden();
    await keyboardMove(storage, 'ArrowDown');
    const manualOrder = [hostOrder[1], hostOrder[0], hostOrder[2]];
    await expect(labels).toHaveText(manualOrder);
    await settingsButton.click();
    await dialog.getByRole('radio', { name: 'By usage', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(labels).toHaveText([hostOrder[1], hostOrder[2], hostOrder[0]]);
    await expect(storage.locator('.ndc-m-drag')).toHaveCount(0);
    await settingsButton.click();
    await dialog.getByRole('radio', { name: 'Manual', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(labels).toHaveText(manualOrder);

    for (const kind of kinds) {
      const widget = page.locator(`[data-widget-id="order-${kind}"]`);
      await expect(widget.locator('.ndc-m-drag')).toHaveCount(2);
      const before = await widget.locator('.ndc-m-label').allTextContents();
      await keyboardMove(widget, 'ArrowRight');
      await expect(widget.locator('.ndc-m-label')).toHaveText([before[1], before[0]]);
    }
    // A mouse gesture moves a metric, leaving the outer widget's grid placement intact.
    const cpu = page.locator('[data-widget-id="order-metric-cpu"]');
    await cpu.locator('.ndc-m-drag').first().scrollIntoViewIfNeeded();
    const start = await cpu.locator('.ndc-m-drag').first().boundingBox();
    const end = await cpu.locator('.ndc-m-drag').last().boundingBox();
    expect(start && end).toBeTruthy();
    await page.mouse.move(start!.x + 5, start!.y + 5);
    await page.mouse.down();
    await page.mouse.move(end!.x + 5, end!.y + 5, { steps: 10 });
    await page.mouse.up();
    await expect(cpu.locator('.ndc-m-label')).toHaveText([first.name, second.name]);
    // dnd-kit keeps its document click shield for 50 ms after a pointer drop.
    // Let that intentional shield expire before clicking an unrelated control.
    await page.waitForTimeout(60);
    await page.getByRole('toolbar', { name: 'Page editing' }).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('toolbar', { name: 'Page editing' })).toBeHidden();
    hottestGpu = true;
    await page.reload();
    await expect(labels).toHaveText(manualOrder);
    await expect(storage.locator('.ndc-m-drag')).toHaveCount(0);
    const saved = await (await page.request.get('/api/pages')).json();
    const stored = saved.pages.find((item: Page) => item.id === fixture.id) as Page;
    expect(stored.widgets.map(({ id, x, y, w }) => ({ id, x, y, w }))).toEqual(widgets.map(({ id, x, y, w }) => ({ id, x, y, w })));
    expect(stored.widgets.find(item => item.id === 'order-storage')?.settings.storageOrder).toBe('manual');
    expect(stored.widgets.find(item => item.id === 'order-storage')?.settings.metricOrder).toHaveLength(3);
    for (const kind of kinds.slice(1)) await expect(page.locator(`[data-widget-id="order-${kind}"] .ndc-m-label`)).toHaveText([second.name, first.name]);

    await page.getByTitle('Edit mode', { exact: true }).click();
    for (const mode of ['Ring', 'Figure', 'Chart']) {
      await settingsButton.click();
      await dialog.getByRole('radio', { name: mode, exact: true }).click();
      await expect.poll(() => dialog.locator('.ndc-dlg-stack > .ndc-check-row').last().evaluate(element => getComputedStyle(element).borderBottomWidth)).toBe('0px');
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      if (mode === 'Chart') await expect(storage.locator('.ndc-m-drag')).toHaveCount(0);
      else {
        await expect(labels).toHaveText(manualOrder);
        await expect(storage.locator('.ndc-m-drag')).toHaveCount(3);
      }
    }
    const device = page.locator('[data-widget-id="order-device"]');
    expect(await device.locator('.ndc-m-drag').count()).toBeGreaterThan(1);
    const deviceLabels = device.locator('.ndc-dev-group--bar .ndc-m-label');
    const before = await deviceLabels.allTextContents();
    await keyboardMove(device, 'ArrowDown');
    await expect(deviceLabels).toHaveText([before[1], before[0], ...before.slice(2)]);
    await page.getByRole('toolbar', { name: 'Page editing' }).getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(page.getByRole('toolbar', { name: 'Page editing' })).toBeHidden();
    await expect(labels).toHaveText(manualOrder);
    await expect(deviceLabels).toHaveText(before);
  } finally {
    expect((await page.request.delete(`/api/pages?id=${fixture.id}`)).status()).toBe(200);
  }
});
