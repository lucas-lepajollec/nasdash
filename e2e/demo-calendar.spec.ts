import { expect, test } from '@playwright/test';

const languages = [
  ['en', 'Explore on my own', 'Edit', 'Edit event', 'Save', 'Delete'],
  ['fr', 'Explorer seul', 'Modifier', 'Modifier l’événement', 'Enregistrer', 'Supprimer'],
  ['es', 'Explorar por mi cuenta', 'Editar', 'Editar evento', 'Guardar', 'Eliminar'],
  ['de', 'Selbst entdecken', 'Bearbeiten', 'Termin bearbeiten', 'Speichern', 'Löschen'],
  ['it', 'Esplora da solo', 'Modifica', 'Modifica evento', 'Salva', 'Elimina'],
];

for (const [language, proceed, edit, editTitle, save, remove] of languages) {
  test(`@demo calendar trial works without shared server state (${language})`, async ({ page }) => {
    test.skip(process.env.NASDASH_DEMO_MODE !== 'true', 'Run with the isolated demo server.');
    const calendarRequests: string[] = [];
    // Separate stateless runtime instances cannot share an in-memory calendar.
    // Reject legacy direct calendar requests: portable browser workspaces use the stateless transport instead.
    await page.route('**/api/config/calendar**', route => {
      calendarRequests.push(route.request().method());
      return route.fulfill({ status: 503, json: { error: 'Synthetic stateless demo' } });
    });
    await page.goto(`/?lang=${language}`);
    await page.getByRole('button', { name: proceed, exact: true }).click();
    const calendar = page.locator('.ndc-calendar:visible').first();
    const originalTitle = await calendar.locator('.ndc-cal-event-title').first().innerText();
    await calendar.locator('.ndc-cal-event').first().click();
    await page.locator('.ndc-dialog').getByRole('button', { name: edit, exact: true }).click();
    let form = page.getByRole('dialog', { name: editTitle, exact: true });
    await form.locator('#event-title').fill(`Demo modified ${language}`);
    await form.getByRole('button', { name: save, exact: true }).click();
    await calendar.locator('.ndc-cal-event').filter({ hasText: `Demo modified ${language}` }).click();
    await page.locator('.ndc-dialog').getByRole('button', { name: remove, exact: true }).click();
    await page.locator('.ndc-confirm').getByRole('button', { name: remove, exact: true }).click();
    await expect(calendar.getByText(`Demo modified ${language}`, { exact: true })).toHaveCount(0);

    await calendar.locator('.ndc-cal-day.is-today').click();
    form = page.locator('.ndc-dialog');
    await form.locator('#event-title').fill(`Demo created ${language}`);
    await form.getByRole('button', { name: save, exact: true }).click();
    await calendar.locator('.ndc-cal-event').filter({ hasText: `Demo created ${language}` }).click();
    await page.locator('.ndc-dialog').getByRole('button', { name: edit, exact: true }).click();
    await page.locator('#event-title').fill(`Demo created then edited ${language}`);
    await page.getByRole('dialog', { name: editTitle, exact: true }).getByRole('button', { name: save, exact: true }).click();
    await calendar.locator('.ndc-cal-event').filter({ hasText: `Demo created then edited ${language}` }).click();
    await page.locator('.ndc-dialog').getByRole('button', { name: remove, exact: true }).click();
    await page.locator('.ndc-confirm').getByRole('button', { name: remove, exact: true }).click();
    await expect(calendar.getByText(`Demo created then edited ${language}`, { exact: true })).toHaveCount(0);
    expect(calendarRequests).toEqual([]);
    await page.reload();
    // Reload retains this visitor's edits; only the explicit Reset action restores fixtures.
    await expect(calendar.locator('.ndc-cal-event-title').filter({ hasText: originalTitle })).toHaveCount(0);
  });
}
