import { expect, test } from '@playwright/test';
import type { Page } from '@/lib/pages/types';

// Keep this suite's login attempts out of other suites' rate-limit buckets.
test.use({ extraHTTPHeaders: { 'x-forwarded-for': '198.18.0.2' } });

test('secondary links close after navigation, support keyboard focus and show their own ping', async ({ page, context }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Uses installed-instance fixtures.');
  const primaryUrl = 'https://primary.example.invalid/';
  const secondaryUrl = 'https://secondary.example.invalid/';
  let secondaryPing: { status: string; statusText: string; latency: number; selfSigned?: boolean } | undefined;
  const requestedUrls = new Set<string>();
  await page.route('**/api/ping/batch', route => {
    const { urls } = route.request().postDataJSON() as { urls: string[] };
    urls.forEach(url => requestedUrls.add(url));
    return route.fulfill({ json: {
      [primaryUrl]: { status: 'online', statusText: 'OK', latency: 12 },
      ...(secondaryPing ? { [secondaryUrl]: secondaryPing } : {}),
    } });
  });
  await context.route(secondaryUrl, route => route.fulfill({ contentType: 'text/html', body: '<title>Fictional secondary service</title>' }));
  expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'playwright-admin-password' } })).status()).toBe(200);
  const settings = (showPingDetails: boolean) => page.request.put('/api/config', { data: { type: 'settings', uiLanguage: 'en', securityMode: 'public', showPingDetails } });
  expect((await settings(true)).status()).toBe(200);
  const category = await (await page.request.post('/api/config', { data: { type: 'category', title: 'Secondary links', layout: 'standard' } })).json();
  // Exercise the legacy Tailscale address as well as the current secondary URL.
  const services = [
    { id: 'secondary-current', name: 'Current secondary', logo: '', localUrl: primaryUrl, secondaryUrl },
    { id: 'secondary-legacy', name: 'Legacy secondary', logo: '', localUrl: primaryUrl, tailscaleUrl: secondaryUrl },
  ];
  expect((await page.request.put('/api/config', { data: { type: 'category', id: category.id, services } })).status()).toBe(200);
  const { page: fixture } = await (await page.request.post('/api/pages', { data: { action: 'create', template: 'blank', name: 'Secondary links' } })).json() as { page: Page };
  try {
    expect((await page.request.put('/api/pages', { data: { page: { ...fixture, widgets: [
      { id: 'secondary-links', type: 'service-category', x: 0, y: 0, w: 12, h: 80, settings: { categoryId: category.id } },
    ] } } })).status()).toBe(200);
    await page.addInitScript(id => localStorage.setItem('nasdash-active-tab', id), fixture.id);
    await page.goto('/');
    const card = page.locator('[data-widget-id="secondary-links"] [data-service-id="secondary-current"]');
    const tip = card.locator('.nd-service-tooltip');
    const primary = card.locator('.nd-service-link');
    await card.hover();
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Loading…');
    await expect(primary).toContainText('OK - 12ms');
    await expect.poll(() => requestedUrls.has(secondaryUrl)).toBe(true);

    secondaryPing = { status: 'online', statusText: 'OK', latency: 73, selfSigned: true };
    await page.reload();
    await card.hover();
    await expect(tip).toContainText('OK · self-signed certificate - 73ms');
    await tip.hover();
    await expect.poll(() => tip.evaluate(element => getComputedStyle(element, '::after').borderBottomColor === getComputedStyle(element).borderBottomColor)).toBe(true);
    const popupPromise = page.waitForEvent('popup');
    await tip.click();
    const popup = await popupPromise;
    await expect(popup).toHaveTitle('Fictional secondary service');
    await popup.close();
    await page.bringToFront();
    await page.mouse.move(900, 500);
    await expect(tip).toBeHidden();

    // Mouse focus left by the click must not reopen the bubble. Keyboard focus does.
    await primary.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(primary).toBeFocused();
    await expect(tip).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(tip).toBeHidden();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(primary).toBeFocused();
    await expect(tip).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(tip).toBeFocused();
    await expect(tip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
    await page.keyboard.press('Tab');
    await page.mouse.move(900, 500);

    secondaryPing = { status: 'offline', statusText: 'Timeout', latency: 0 };
    for (const layout of ['compact', 'bento', 'bento-logo-small']) {
      expect((await page.request.put('/api/config', { data: { type: 'category', id: category.id, layout } })).status()).toBe(200);
      await page.reload();
      await card.hover();
      await expect(tip).toContainText('Timeout - 0ms');
      const legacy = page.locator('[data-widget-id="secondary-links"] [data-service-id="secondary-legacy"]');
      await legacy.hover();
      await expect(legacy.locator('.nd-service-tooltip')).toContainText('Timeout - 0ms');
    }
    expect((await settings(false)).status()).toBe(200);
    await page.reload();
    await card.hover();
    await expect(tip.locator('.nd-service-tooltip-host')).toHaveText('secondary.example.invalid');
    await page.getByTitle('Hide info', { exact: true }).filter({ visible: true }).click();
    await card.hover();
    await expect(tip.locator('.nd-service-tooltip-host')).toHaveText('•••');
    await page.evaluate(() => { delete document.body.dataset.design; });
    await page.mouse.move(900, 500);
    await expect(tip).toBeHidden();
    await card.hover();
    await expect(tip).toBeVisible();
    await tip.hover();
    await expect.poll(() => tip.evaluate(element => getComputedStyle(element, '::after').borderBottomColor === getComputedStyle(element).borderBottomColor)).toBe(true);
  } finally {
    expect((await page.request.delete(`/api/pages?id=${fixture.id}`)).status()).toBe(200);
    expect((await page.request.delete(`/api/config?type=category&id=${category.id}`)).status()).toBe(200);
  }
});
