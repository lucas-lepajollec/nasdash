import { expect, test } from '@playwright/test';

const languages = [
  ['en', 'Continue', 'Edit', 'Edit event', 'Save', 'Delete'],
  ['fr', 'Continuer', 'Modifier', 'Modifier l’événement', 'Enregistrer', 'Supprimer'],
  ['es', 'Continuar', 'Editar', 'Editar evento', 'Guardar', 'Eliminar'],
  ['de', 'Weiter', 'Bearbeiten', 'Termin bearbeiten', 'Speichern', 'Löschen'],
  ['it', 'Continua', 'Modifica', 'Modifica evento', 'Salva', 'Elimina'],
];

for (const [language, proceed, edit, editTitle, save, remove] of languages) {
  test(`@demo calendar trial works without shared server state (${language})`, async ({ page }) => {
    test.skip(process.env.NASDASH_DEMO_MODE !== 'true', 'Run with the isolated demo server.');
    const calendarRequests: string[] = [];
    // Separate stateless runtime instances cannot share an in-memory calendar.
    // Reject every calendar API request to exercise that hosted boundary.
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
    await expect(calendar.locator('.ndc-cal-event-title').filter({ hasText: originalTitle }).first()).toBeVisible();
  });
}
