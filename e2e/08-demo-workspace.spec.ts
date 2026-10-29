import { expect, test } from '@playwright/test';

test('@demo edits survive reloads and alternating workers while reset restores the fixture', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE !== 'true', 'Requires an isolated demo');
  let requests = 0;
  const secondWorker = process.env.NASDASH_DEMO_SECOND_WORKER;
  if (secondWorker) await page.route('**/api/demo/workspace', async route => {
    const response = await route.fetch({ url: `${++requests % 2 ? secondWorker : process.env.FIX_BASE_URL}/api/demo/workspace` });
    await route.fulfill({ response });
  });
  await page.goto('/?lang=en');
  await page.getByRole('button', { name: 'Explore on my own', exact: true }).click();
  const calendar = page.locator('.ndc-calendar:visible').first();
  await calendar.locator('.ndc-cal-event').first().click();
  await page.locator('.ndc-dialog').getByRole('button', { name: 'Edit', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit event', exact: true });
  await edit.locator('#event-title').fill('Portable demo event');
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(calendar).toContainText('Portable demo event');
  await page.reload();
  await expect(calendar).toContainText('Portable demo event');
  if (secondWorker) expect(requests).toBeGreaterThan(2);
  await page.getByRole('button', { name: 'Reset the demo', exact: true }).click();
  await page.getByRole('button', { name: 'Explore on my own', exact: true }).click();
  await expect(calendar).not.toContainText('Portable demo event');
});
