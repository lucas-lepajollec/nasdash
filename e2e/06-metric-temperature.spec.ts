import { expect, test, type Locator, type Page as BrowserPage } from '@playwright/test';
import type { Page as SavedPage } from '@/lib/pages/types';

// Fictional browser-only monitoring data; no source is saved or contacted.
test.use({ extraHTTPHeaders: { 'x-forwarded-for': '198.18.0.6' } });

async function temperatureFixture(page: BrowserPage) {
  expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'playwright-admin-password' } })).status()).toBe(200);
  const config = await (await page.request.get('/api/config')).json();
  const gpuId = 'temperature-fictional-gpu';
  const cpuId = 'temperature-fictional-cpu';
  const now = Date.now();
  await page.route('**/api/config', route => route.request().method() === 'GET' ? route.fulfill({ json: {
    ...config,
    settings: { ...config.settings, uiLanguage: 'en', securityMode: 'public' },
    integrations: [{ id: 'temperature-fictional-source', type: 'glances', name: 'Fictional monitoring source', settings: { ip: 'http://monitor.example.test', port: '61208' } }],
    devices: [
      { id: gpuId, name: 'GPU fixture', host: 'fictional-gpu.example.test', icon: '💻', source: { integrationId: 'temperature-fictional-source' } },
      { id: cpuId, name: 'CPU fixture', host: 'fictional-cpu.example.test', icon: '💻', source: { integrationId: 'temperature-fictional-source' } },
    ],
  } }) : route.continue());
  await page.route('**/api/devices/*/history?*', route => {
    const gpu = route.request().url().includes(`/devices/${gpuId}/`);
    const metrics = [
      { key: 'cpu.usage', kind: 'cpu', percent: 10, temperatureC: gpu ? 45 : 60 },
      ...(gpu ? [
        { key: 'gpu:a', kind: 'gpu', name: 'Graphics A', percent: 20, temperatureC: 85 },
        { key: 'gpu:b', kind: 'gpu', name: 'Graphics B', percent: 30, temperatureC: 70 },
      ] : []),
    ];
    return route.fulfill({ json: {
      online: true, updatedAt: now, metrics, vitals: {},
      series: Object.fromEntries(metrics.flatMap(metric => [[metric.key, [[now - 10_000, metric.percent], [now, metric.percent]]], [`${metric.key}@temp`, [[now - 10_000, metric.temperatureC - 1], [now, metric.temperatureC]]]])),
    } });
  });
  const created = await page.request.post('/api/pages', { data: { action: 'create', template: 'blank', name: 'Temperature regression' } });
  expect(created.status()).toBe(201);
  const { page: fixture } = await created.json() as { page: SavedPage };
  const metrics = {
    cpu: { shown: false }, memory: { shown: false }, gpu: { shown: false },
    temperature: { shown: true }, gpuTemperature: { shown: true },
    network: { shown: false }, load: { shown: false }, disk: { shown: false }, history: { shown: false },
  };
  expect((await page.request.put('/api/pages', { data: { page: { ...fixture, widgets: [
    { id: 'temperature-device-bars', type: 'device', x: 0, y: 0, w: 8, h: 90, settings: { deviceId: gpuId, display: 'bar', perMetricDisplay: false, metrics } },
    { id: 'temperature-device-values', type: 'device', x: 8, y: 0, w: 8, h: 90, settings: { deviceId: gpuId, display: 'value', perMetricDisplay: false, metrics } },
    { id: 'temperature-metric', type: 'metric-temperature', x: 16, y: 0, w: 8, h: 90, settings: { deviceIds: [gpuId], display: 'value' } },
    { id: 'temperature-no-gpu', type: 'metric-temperature', x: 0, y: 90, w: 8, h: 60, settings: { deviceIds: [cpuId], display: 'value' } },
  ] } } })).status()).toBe(200);
  await page.addInitScript(id => localStorage.setItem('nasdash-active-tab', id), fixture.id);
  return { fixture, gpuId };
}

const widget = (page: BrowserPage, id: string) => page.locator(`[data-widget-id="${id}"]`);
const settings = (scope: Locator) => scope.locator('button[aria-label$=" settings"]');

test('CPU and each GPU temperature stay separate, configurable and independently ordered', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Uses installed-instance fixtures.');
  const { fixture, gpuId } = await temperatureFixture(page);
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  try {
    await page.goto('/?lang=en');
    const bars = widget(page, 'temperature-device-bars');
    const metric = widget(page, 'temperature-metric');
    await expect(bars.locator('.ndc-m-value')).toHaveText(['45 °C', '85 °C', '70 °C']);
    await expect(metric.locator('.ndc-m-big')).toHaveText(['45 °C']);
    await expect(bars.locator('.ndc-m-label')).toHaveText(['CPU temperature', 'GPU temperature · Graphics A', 'GPU temperature · Graphics B']);
    await expect(bars.locator('.ndc-m-detail')).toHaveCount(0);
    await page.getByTitle('Edit mode', { exact: true }).click();
    await settings(bars).click();
    let dialog = page.getByRole('dialog', { name: 'Device settings', exact: true });
    const cpu = dialog.getByRole('checkbox', { name: 'CPU temperature', exact: true });
    const gpu = dialog.getByRole('checkbox', { name: 'GPU temperature', exact: true });
    await expect(cpu).toHaveAttribute('aria-checked', 'true');
    await expect(gpu).toHaveAttribute('aria-checked', 'true');
    await gpu.click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(bars.locator('.ndc-m-value')).toHaveText(['45 °C']);
    await settings(bars).click();
    await gpu.click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(bars.locator('.ndc-m-value')).toHaveText(['45 °C', '85 °C', '70 °C']);

    await settings(metric).click();
    dialog = page.getByRole('dialog', { name: 'CPU temperature settings', exact: true });
    await expect(dialog.getByRole('checkbox', { name: 'GPU model', exact: true })).toHaveCount(0);
    const source = dialog.getByRole('radiogroup', { name: 'Temperature sensor', exact: true });
    await source.getByRole('radio', { name: 'GPU temperature', exact: true }).click();
    await expect(dialog.getByRole('checkbox', { name: 'GPU model', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(metric.locator('.ndc-m-big')).toHaveText(['85 °C', '70 °C']);
    const labels = ['Graphics A · GPU fixture', 'Graphics B · GPU fixture'];
    await expect(metric.locator('.ndc-m-label')).toHaveText(labels);
    const handles = metric.locator('.ndc-m-drag');
    await expect(handles).toHaveCount(2);
    const identities = await metric.locator('[data-metric-entry]').evaluateAll(elements => elements.map(element => element.getAttribute('data-metric-entry')));
    expect(identities).toEqual([JSON.stringify([gpuId, 'gpu:a@temp']), JSON.stringify([gpuId, 'gpu:b@temp'])]);
    await handles.first().scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    await handles.first().focus();
    await page.keyboard.press('Space');
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    await page.keyboard.press('ArrowRight');
    await expect(metric.getByRole('status').filter({ hasText: 'position 2 of 2' })).toHaveCount(1);
    await page.keyboard.press('Space');
    await expect(metric.locator('.ndc-m-label')).toHaveText([labels[1], labels[0]]);
    await page.getByRole('toolbar', { name: 'Page editing' }).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('toolbar', { name: 'Page editing' })).toBeHidden();
    await page.reload();
    await expect(metric.locator('.ndc-m-big')).toHaveText(['70 °C', '85 °C']);
    const saved = await (await page.request.get('/api/pages')).json();
    const stored = saved.pages.find((item: SavedPage) => item.id === fixture.id) as SavedPage;
    expect(stored.widgets.find(item => item.id === 'temperature-metric')?.settings.temperaturePart).toBe('gpu');
    expect(stored.widgets.find(item => item.id === 'temperature-metric')?.settings.metricOrder).toEqual([identities[1], identities[0]]);

    await page.getByTitle('Edit mode', { exact: true }).click();
    await settings(widget(page, 'temperature-no-gpu')).click();
    dialog = page.getByRole('dialog', { name: 'CPU temperature settings', exact: true });
    await expect(dialog.getByRole('radiogroup', { name: 'Temperature sensor' }).getByRole('radio', { name: 'GPU temperature', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(failures).toEqual([]);
  } finally {
    expect((await page.request.delete(`/api/pages?id=${fixture.id}`)).status()).toBe(200);
  }
});

test('temperature labels remain readable in narrow figures and bars in five languages', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Uses installed-instance fixtures.');
  const { fixture } = await temperatureFixture(page);
  const languages = [
    ['en', 'CPU temperature', 'GPU temperature'],
    ['fr', 'Température CPU', 'Température GPU'],
    ['es', 'Temperatura de CPU', 'Temperatura de GPU'],
    ['de', 'CPU-Temperatur', 'GPU-Temperatur'],
    ['it', 'Temperatura CPU', 'Temperatura GPU'],
  ];
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [language, cpu, gpu] of languages) {
      await page.goto(`/?lang=${language}`);
      for (const id of ['temperature-device-bars', 'temperature-device-values']) {
        const scope = widget(page, id);
        await scope.scrollIntoViewIfNeeded();
        await expect(scope.locator('.ndc-m-label')).toHaveText([cpu, `${gpu} · Graphics A`, `${gpu} · Graphics B`]);
        const measurements = await scope.locator('.ndc-m-label').evaluateAll(elements => elements.map(element => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const card = element.closest('.ndc-m')!.getBoundingClientRect();
          return { whiteSpace: style.whiteSpace, overflow: style.overflow, textOverflow: style.textOverflow, height: element.clientHeight, scrollHeight: element.scrollHeight, width: element.clientWidth, scrollWidth: element.scrollWidth, right: rect.right, cardRight: card.right };
        }));
        for (const measurement of measurements) {
          expect(measurement.whiteSpace).not.toBe('nowrap');
          expect(measurement.textOverflow).not.toBe('ellipsis');
          expect(measurement.overflow).toBe('visible');
          expect(measurement.scrollHeight).toBeLessThanOrEqual(measurement.height + 1);
          expect(measurement.scrollWidth).toBeLessThanOrEqual(measurement.width + 1);
          expect(measurement.right).toBeLessThanOrEqual(measurement.cardRight + 1);
        }
        if (id === 'temperature-device-bars') {
          const head = scope.locator('.ndc-m-head').first();
          await head.evaluate(element => { element.style.width = '90px'; });
          // Reserve a readable caption width before wrapping the value below it.
          await expect.poll(() => head.evaluate(element => {
            const label = element.querySelector('.ndc-m-label')!.getBoundingClientRect();
            const value = element.querySelector('.ndc-m-value')!.getBoundingClientRect();
            return label.width >= 89 && value.top >= label.bottom;
          })).toBe(true);
          await head.evaluate(element => { element.style.removeProperty('width'); });
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  } finally {
    expect((await page.request.delete(`/api/pages?id=${fixture.id}`)).status()).toBe(200);
  }
});


test('device and storage bar details use available space and wrap only when needed', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Uses installed-instance fixtures.');
  const { fixture, gpuId } = await temperatureFixture(page);
  const now = Date.now();
  await page.route('**/api/devices/*/history?*', route => route.fulfill({ json: {
    online: true, updatedAt: now, vitals: { cores: 16, load: [2.4, 2, 1] },
    metrics: [{ key: 'disk:system', kind: 'disk', name: 'System', percent: 28, totalBytes: 128 * 1024 ** 3 }], series: {},
  } }));
  try {
    const pages = await (await page.request.get('/api/pages')).json();
    const current = pages.pages.find((saved: SavedPage) => saved.id === fixture.id) as SavedPage;
    expect((await page.request.put('/api/pages', { data: { page: { ...current, widgets: [
    { id: 'inline-device', type: 'device', x: 0, y: 0, w: 12, h: 90, settings: { deviceId: gpuId, display: 'bar', perMetricDisplay: false, metrics: {
      cpu: { shown: false }, memory: { shown: false }, gpu: { shown: false }, temperature: { shown: false }, gpuTemperature: { shown: false },
      network: { shown: false }, load: { shown: true }, disk: { shown: false }, history: { shown: false },
    } } },
    { id: 'inline-storage', type: 'storage', x: 12, y: 0, w: 12, h: 90, settings: { deviceIds: [gpuId], display: 'bar' } },
  ] } } })).status()).toBe(200);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const language of ['en', 'fr', 'es', 'de', 'it']) {
      await page.goto(`/?lang=${language}`);
      for (const id of ['inline-device', 'inline-storage']) {
        const scope = widget(page, id);
        const head = scope.locator('.ndc-m-head').first();
        await expect(head.locator('.ndc-m-detail')).toBeVisible();
        const measure = () => head.evaluate(element => {
          const label = element.querySelector('.ndc-m-label')!.getBoundingClientRect();
          const detail = element.querySelector('.ndc-m-detail')!.getBoundingClientRect();
          const value = element.querySelector('.ndc-m-value')!.getBoundingClientRect();
          const bounds = element.getBoundingClientRect();
          const stats = element.querySelector('.ndc-m-stats')!.getBoundingClientRect();
          return { sameLine: detail.top < label.bottom && label.top < detail.bottom,
            fits: value.right <= bounds.right + 1 && detail.right <= bounds.right + 1 && label.right <= bounds.right + 1,
            statsRight: Math.abs(stats.right - bounds.right) < 1,
            detailBelow: detail.top >= label.bottom };
        });
        await expect.poll(async () => (await measure()).sameLine).toBe(true);
        expect((await measure()).statsRight).toBe(true);
        await scope.evaluate(element => { element.style.width = '160px'; });
        await expect.poll(async () => (await measure()).detailBelow).toBe(true);
        expect((await measure()).fits).toBe(true);
        expect((await measure()).statsRight).toBe(true);
        await scope.evaluate(element => { element.style.width = '600px'; });
        await expect.poll(async () => (await measure()).sameLine).toBe(true);
        expect((await measure()).fits).toBe(true);
        expect((await measure()).statsRight).toBe(true);
      }
    }
  } finally { expect((await page.request.delete(`/api/pages?id=${fixture.id}`)).status()).toBe(200); }
});
