import { expect, test } from '@playwright/test';

test.setTimeout(90_000);

async function prepare(page: import('@playwright/test').Page) {
  expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'playwright-admin-password' } })).status()).toBe(200);
  expect((await page.request.put('/api/config', { data: { type: 'settings', uiLanguage: 'en', securityMode: 'public', calendarUrl: '' } })).status()).toBe(200);
}

function futureDate(days = 2) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

test('calendar agenda supports dated creation, editing, failures and confirmed deletion', async ({ page }) => {
  await prepare(page);
  await page.goto('/');
  const calendar = page.locator('.ndc-calendar:visible').first();
  await expect(calendar).toBeVisible();
  await calendar.locator('.ndc-cal-day.is-today').click();
  let form = page.getByRole('dialog', { name: 'Add an event', exact: true });
  await form.getByLabel('Event Title', { exact: true }).fill('Calendar feedback event');
  await form.getByLabel('Date', { exact: true }).fill(futureDate());
  await form.getByLabel('Time', { exact: true }).fill('14:30');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form).toHaveCount(0);
  await calendar.locator('.ndc-cal-event').filter({ hasText: 'Calendar feedback event' }).click();
  const details = page.getByRole('dialog', { name: 'Calendar feedback event', exact: true });
  await details.getByRole('button', { name: 'Edit', exact: true }).click();
  form = page.getByRole('dialog', { name: 'Edit event', exact: true });
  await expect(form.getByLabel('Event Title', { exact: true })).toHaveValue('Calendar feedback event');
  await expect(form.getByLabel('Date', { exact: true })).toHaveValue(futureDate());
  await expect(form.getByLabel('Time', { exact: true })).toHaveValue('14:30');
  await form.getByLabel('Event Title', { exact: true }).fill('Calendar feedback edited');
  await form.getByLabel('Date', { exact: true }).fill(futureDate(3));
  await form.getByLabel('Time', { exact: true }).fill('15:45');
  await page.route('**/api/config/calendar', route => route.request().method() === 'PUT' ? route.fulfill({ status: 500, json: { error: 'Synthetic write failure' } }) : route.continue());
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form.getByRole('alert')).toHaveText('Could not save the event. Please try again.');
  await expect(form.getByLabel('Event Title', { exact: true })).toHaveValue('Calendar feedback edited');
  await page.unroute('**/api/config/calendar');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(calendar.getByText('Calendar feedback event', { exact: true })).toHaveCount(0);
  await page.reload();
  await page.locator('.nd-header-desktop').getByRole('button', { name: 'Calendar', exact: true }).click();
  await calendar.locator('.ndc-cal-event').filter({ hasText: 'Calendar feedback edited' }).click();
  const edited = page.getByRole('dialog', { name: 'Calendar feedback edited', exact: true });
  await edited.getByRole('button', { name: 'Delete', exact: true }).click();
  let confirmation = page.getByRole('dialog', { name: 'Delete the event', exact: true });
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(edited).toBeVisible();
  await edited.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.route('**/api/config/calendar?*', route => route.fulfill({ status: 500, json: { error: 'Synthetic delete failure' } }));
  await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(edited.getByRole('alert')).toHaveText('Could not delete the event. Please try again.');
  await page.unroute('**/api/config/calendar?*');
  await edited.getByRole('button', { name: 'Delete', exact: true }).click();
  confirmation = page.getByRole('dialog', { name: 'Delete the event', exact: true });
  await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(edited).toHaveCount(0);
  await expect(calendar.getByText('Calendar feedback edited', { exact: true })).toHaveCount(0);
  await calendar.locator('.ndc-cal-day.is-today').click();
  await expect(page.getByLabel('Event Title', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('calendar imports and anonymous viewers stay read-only', async ({ page, browser }) => {
  await prepare(page);
  const created = await page.request.post('/api/config/calendar', { data: { title: 'Read-only visitor event', start: `${futureDate()}T12:00:00.000Z` } });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const context = await browser.newContext();
  try {
    const visitor = await context.newPage();
    await visitor.goto('/');
    await visitor.locator('.ndc-cal-event').filter({ hasText: 'Read-only visitor event' }).first().click();
    const details = visitor.getByRole('dialog', { name: 'Read-only visitor event', exact: true });
    await expect(details).toBeVisible();
    await expect(details.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
    await expect(details.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
    expect((await visitor.request.put('/api/config/calendar', { data: { id, title: 'Forbidden' } })).status()).toBe(401);
    expect((await visitor.request.delete(`/api/config/calendar?id=${id}`)).status()).toBe(401);
  } finally { await context.close(); }
  await page.request.put('/api/config', { data: { type: 'settings', calendarUrl: 'https://calendar.example.invalid/events.ics' } });
  await page.route('**/api/calendar?*', route => route.fulfill({ json: { events: [{ id: 'imported-feedback-event', title: 'Read-only ICS event', start: `${futureDate()}T13:00:00.000Z`, end: null }] } }));
  await page.goto('/');
  await page.locator('.ndc-cal-event').filter({ hasText: 'Read-only ICS event' }).first().click();
  const imported = page.getByRole('dialog', { name: 'Read-only ICS event', exact: true });
  await expect(imported).toBeVisible();
  await expect(imported.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(imported.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await page.request.put('/api/config', { data: { type: 'settings', calendarUrl: '' } });
  await page.request.delete(`/api/config/calendar?id=${id}`);
});

test('uploaded wallpaper delete confirmation follows all five interface languages', async ({ page }) => {
  await prepare(page);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=', 'base64');
  const upload = await page.request.post('/api/upload', { multipart: { type: 'background', file: { name: 'feedback-wallpaper.png', mimeType: 'image/png', buffer: png } } });
  expect(upload.status()).toBe(200);
  const uploaded = await upload.json();
  try {
    for (const [language, media, deletion, cancel] of [
      ['en', 'Media', 'Delete', 'Cancel'], ['fr', 'Médias', 'Supprimer', 'Annuler'],
      ['es', 'Multimedia', 'Eliminar', 'Cancelar'], ['de', 'Medien', 'Löschen', 'Abbrechen'], ['it', 'Media', 'Elimina', 'Annulla'],
    ]) {
      await page.request.put('/api/config', { data: { type: 'settings', uiLanguage: language } });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await page.locator('.nd-header-desktop [data-settings-trigger="true"]').click();
      await page.locator('.nd-settings-sidebar').getByRole('button', { name: media, exact: true }).click();
      await page.locator('.ndc-wallpaper').first().hover();
      await page.locator('.ndc-wallpaper-remove').first().click();
      const confirmation = page.locator('.ndc-confirm');
      await expect(confirmation.getByRole('button', { name: deletion, exact: true })).toBeVisible();
      if (language !== 'fr') await expect(confirmation.getByRole('button', { name: 'Supprimer', exact: true })).toHaveCount(0);
      await confirmation.getByRole('button', { name: cancel, exact: true }).click();
    }
  } finally {
    await page.request.put('/api/config', { data: { type: 'settings', uiLanguage: 'en' } });
    if (uploaded.url) await page.request.delete(uploaded.url);
  }
});
