import { expect, test } from '@playwright/test';

test('initial config throttling offers recovery instead of an endless loading screen', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Installed failure case');
  expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'playwright-admin-password' } })).status()).toBe(200);
  let blocked = true;
  await page.route('**/api/config', route => blocked && route.request().method() === 'GET' ? route.fulfill({ status: 429, json: { error: 'Too many requests' } }) : route.continue());
  await page.goto('/');
  await expect(page.getByRole('alert').filter({ hasText: 'The dashboard could not load' })).toBeVisible();
  blocked = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-design', 'calme');
  await expect(page.getByRole('alert').filter({ hasText: 'The dashboard could not load' })).toHaveCount(0);
});

test('external calendar failure is visible while local events remain available', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Installed failure case');
  expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'playwright-admin-password' } })).status()).toBe(200);
  const config = await (await page.request.get('/api/config')).json();
  const response = await page.request.post('/api/pages', { data: { action: 'create', template: 'blank', name: 'Audit calendar failure' } });
  expect(response.status()).toBe(201);
  const { page: fixture } = await response.json();
  const today = new Date().toISOString().slice(0, 10);
  await page.route('**/api/config', route => route.request().method() === 'GET' ? route.fulfill({ json: { ...config, settings: { ...config.settings, uiLanguage: 'en', calendarUrl: 'http://calendar.example.test/feed' }, localEvents: [{ id: 'fictional-local', title: 'Local event preserved', start: today+'T12:00:00Z', isAllDay: false }] } }) : route.continue());
  await page.route('**/api/calendar', route => route.fulfill({ status: 503, json: { error: 'calendar.fetchFailed' } }));
  try {
    expect((await page.request.put('/api/pages', { data: { page: { ...fixture, widgets: [{ id: 'audit-calendar', type: 'calendar', x: 0, y: 0, w: 24, h: 70 }] } } })).status()).toBe(200);
    await page.addInitScript(id => localStorage.setItem('nasdash-active-tab', id), fixture.id);
    await page.goto('/');
    await expect(page.getByRole('alert').filter({ hasText: 'The external calendar is unavailable' })).toBeVisible();
    await expect(page.locator('[data-widget-id="audit-calendar"]')).toContainText('Local event preserved');
  } finally { await page.request.delete(`/api/pages?id=${fixture.id}`); }
});
