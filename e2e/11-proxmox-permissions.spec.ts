import { expect, test } from '@playwright/test';

test.use({ extraHTTPHeaders: { 'x-forwarded-for': '198.18.0.11' } });

test('Proxmox discovery and selected-machine metric permissions are tested separately', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Uses installed-instance fixtures.');
  expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'playwright-admin-password' } })).status()).toBe(200);
  const config = await (await page.request.get('/api/config')).json();
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.route('**/api/config', route => route.request().method() === 'GET' ? route.fulfill({ json: {
    ...config, settings: { ...config.settings, uiLanguage: 'en', securityMode: 'public' },
    integrations: [{ id: 'fictional-pve', type: 'proxmox', name: 'Fictional Proxmox', settings: {} }],
    devices: [{ id: 'fictional-node', name: 'Orion', host: '', icon: '🖥️', source: { integrationId: 'fictional-pve', values: { nodeName: 'orion' } } }],
  } }) : route.continue());
  const tests: Record<string, unknown>[] = [];
  await page.route('**/api/integrations/test', route => {
    const body = route.request().postDataJSON();
    tests.push(body);
    const data = !body.values ? { ok: true, message: 'integrations.test.machines', count: 2, targets: [
      { values: { nodeName: 'orion' }, label: 'orion', detail: 'online' },
      { values: { nodeName: 'orion', vmid: '101', vmType: 'lxc' }, label: 'Test container', detail: 'running' },
    ] } : { ok: false, message: body.values.vmid ? 'integrations.proxmox.guestPermission' : 'integrations.proxmox.nodePermission' };
    return route.fulfill({ json: data });
  });
  await page.goto('/?lang=en');
  await page.getByRole('button', { name: 'Global Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'NasDash Settings' });
  await settings.locator('.nd-settings-sidebar').getByRole('button', { name: 'Widgets', exact: true }).click();
  await settings.getByRole('button', { name: /^\W*Devices\b/u }).first().click();
  await settings.getByRole('button', { name: 'Edit connection information' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit device', exact: true });
  await expect(editor.getByRole('button', { name: 'Machine on Proxmox VE', exact: true })).toContainText('orion — online');
  await editor.getByRole('button', { name: 'Test metrics', exact: true }).click();
  await expect(editor.getByRole('status')).toContainText('Sys.Audit');
  await expect(editor.getByRole('status')).toContainText('Privilege Separation');
  expect(tests.at(-1)).toEqual({ type: 'proxmox', id: 'fictional-pve', values: { nodeName: 'orion' } });
  await editor.getByRole('button', { name: 'Machine on Proxmox VE', exact: true }).click();
  await page.getByRole('option', { name: 'Test container — running' }).click();
  await expect(editor.getByRole('status')).toHaveCount(0);
  await editor.getByRole('button', { name: 'Test metrics', exact: true }).click();
  await expect(editor.getByRole('status')).toContainText('VM.Audit');
  expect(tests.at(-1)).toEqual({ type: 'proxmox', id: 'fictional-pve', values: { nodeName: 'orion', vmid: '101', vmType: 'lxc' } });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(editor.getByRole('status')).toBeVisible();
  expect(await editor.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect.poll(() => editor.evaluate(element => {
    let opacity = 1;
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) opacity *= Number(getComputedStyle(ancestor).opacity);
    return opacity;
  })).toBe(1);
  await page.screenshot({ path: '.project-local/proxmox-142-mobile.png', animations: 'disabled' });
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(failures).toEqual([]);
});
