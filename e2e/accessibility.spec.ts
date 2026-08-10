import { expect, test } from '@playwright/test';

test('core dashboard and settings stay keyboard accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'Rechercher dans le tableau de bord' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mois précédent' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mois suivant' })).toBeVisible();

  await page.goto('/login');
  await page.getByLabel("Nom d'utilisateur").fill('admin');
  await page.getByLabel('Mot de passe').fill('playwright-admin-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  const settingsButton = page.getByRole('button', { name: 'Paramètres globaux' });
  await settingsButton.click();

  const dialog = page.getByRole('dialog', { name: 'Paramètres NasDash' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);

  const lastButton = dialog.locator('button:not([disabled])').last();
  await lastButton.focus();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(settingsButton).toBeFocused();
});
