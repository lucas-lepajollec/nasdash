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

  const sidebar = dialog.locator('.nd-settings-sidebar');
  await sidebar.getByRole('button', { name: 'Général', exact: true }).click();
  await expect(dialog.getByText('Position du Dock', { exact: true })).toBeVisible();

  await sidebar.getByRole('button', { name: 'Configuration Widgets', exact: true }).click();
  const widgetPages = [
    { navigationName: /Appareils/, title: /Configuration — Appareils/ },
    {
      navigationName: /VPN Tailscale/,
      title: /Configuration — VPN Tailscale/,
      fieldNames: ['Nom du Tailnet', 'OAuth Client ID Tailscale', 'OAuth Client Secret Tailscale'],
    },
    { navigationName: /Horloge/, title: /Configuration — Horloge \/ Date/, selectName: 'Fuseau horaire' },
    { navigationName: /Calendrier/, title: /Configuration — Calendrier/, fieldNames: ['URL du calendrier iCal'] },
    { navigationName: /Météo/, title: /Configuration — Météo/, fieldNames: ['Rechercher une ville'] },
  ];

  for (const widgetPage of widgetPages) {
    await sidebar.getByRole('button', { name: widgetPage.navigationName }).click();
    await expect(dialog.getByRole('heading', { level: 3, name: widgetPage.title })).toBeVisible();
    for (const fieldName of widgetPage.fieldNames || []) {
      await expect(dialog.getByLabel(fieldName)).toBeVisible();
    }
    if (widgetPage.selectName) {
      const select = dialog.getByRole('button', { name: widgetPage.selectName });
      await select.focus();
      await page.keyboard.press('ArrowDown');
      await expect(select).toHaveAttribute('aria-expanded', 'true');
      await expect(dialog.getByRole('listbox', { name: widgetPage.selectName })).toBeVisible();
      await expect(dialog.getByRole('option', { selected: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(select).toHaveAttribute('aria-expanded', 'false');
      await expect(select).toBeFocused();
    }
  }

  await expect(dialog.getByText('Activer le widget Météo', { exact: true })).toBeVisible();

  const lastButton = dialog.locator('button:not([disabled])').last();
  await lastButton.focus();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(settingsButton).toBeFocused();
});

test('network editor dialogs keep keyboard focus without changing topology', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel("Nom d'utilisateur").fill('admin');
  await page.getByLabel('Mot de passe').fill('playwright-admin-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });

  await page.evaluate(() => localStorage.setItem('nasdash-active-tab', 'networks'));
  await page.reload();
  await expect(page.locator('.nd-networks-layout')).toBeVisible({ timeout: 30_000 });

  await page.getByTitle('Mode édition').click();
  await page.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('button', { name: 'Créer un nœud' }).click();

  const dialog = page.getByRole('dialog', { name: 'Ajouter un nœud topologique' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);

  const lastButton = dialog.locator('button:not([disabled])').last();
  await lastButton.focus();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
