import { expect, test } from '@playwright/test';
import type { Page as SavedPage } from '@/lib/pages/types';

test('Docker relay resources render safe names, retain errors and reset across hosts', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Uses isolated installed-instance fixtures.');
  expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'playwright-admin-password' } })).status()).toBe(200);
  const config = await (await page.request.get('/api/config')).json();
  const created = await page.request.post('/api/pages', { data: { action: 'create', template: 'blank', name: 'Docker relay feedback' } });
  expect(created.status()).toBe(201);
  const { page: fixture } = await created.json() as { page: SavedPage };
  const hash = 'b'.repeat(64);
  const used = { id: hash, repoTags: ['renamed-web:1'], size: 100, created: 100, containers: 1 };
  const unused = { id: 'c'.repeat(64), repoTags: [], repoDigests: ['registry.example.test/unused-web@sha256:cccc'], size: 100, created: 100, containers: 0 };
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.route('**/api/config', route => route.request().method() === 'GET' ? route.fulfill({ json: {
    ...config, settings: { ...config.settings, securityMode: 'public', uiLanguage: 'en' }, dockerHosts: [
      { id: 'relay-dockhand', type: 'dockhand', name: 'Dockhand fixture', icon: 'D', url: '', target: '1' },
      { id: 'relay-portainer', type: 'portainer', name: 'Portainer fixture', icon: 'P', url: '', target: '1' },
    ],
  } }) : route.continue());
  await page.route('**/api/docker/**', route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'DELETE') return route.fulfill({ status: 409, json: { error: 'Docker image is in use and cannot be deleted.' } });
    if (url.pathname.endsWith('/images')) return route.fulfill({ json: [used, unused] });
    if (url.pathname.endsWith('/volumes')) return route.fulfill({ json: [{ name: 'fixture-data', driver: 'local', mountpoint: '/data', usageData: { refCount: 1 } }, { name: 'unused-fixture-data', driver: 'local', mountpoint: '/unused', usageData: { refCount: 0 } }] });
    if (url.pathname.endsWith('/containers')) return route.fulfill({ json: [{ id: 'a'.repeat(12), fullId: 'a'.repeat(64), names: ['web'], image: 'web:old', imageId: hash, state: 'running', mounts: [{ type: 'volume', name: 'fixture-data' }] }] });
    return route.fulfill({ status: 502, json: { error: 'Docker API access denied.', code: 'access_denied', category: 'permission', hint: 'docker.failure.access_denied', retryable: false, isOffline: false } });
  });
  try {
    expect((await page.request.put('/api/pages', { data: { page: { ...fixture, widgets: [
      { id: 'relay-hosts', type: 'docker-hosts', x: 0, y: 0, w: 24, h: 20 },
      { id: 'relay-explorer', type: 'docker-explorer', x: 0, y: 20, w: 24, h: 90 },
    ] } } })).status()).toBe(200);
    await page.addInitScript(id => localStorage.setItem('nasdash-active-tab', id), fixture.id);
    await page.goto('/');
    const explorer = page.locator('[data-widget-id="relay-explorer"]');
    await expect(page.getByRole('button', { name: /Dockhand fixture/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(explorer).toContainText('Docker access denied');
    await expect(explorer).toContainText('Check the credentials');
    await explorer.getByRole('tab', { name: /^Images/ }).click();
    const imageRow = explorer.getByRole('row').filter({ hasText: 'renamed-web:1' });
    await expect(imageRow.getByRole('checkbox')).toBeDisabled();
    await expect(explorer.getByText('registry.example.test/unused-web', { exact: true })).toBeVisible();
    await expect(explorer.getByText('Untagged image', { exact: true })).toBeVisible();
    const unusedRow = explorer.getByRole('row').filter({ hasText: 'registry.example.test/unused-web' });
    await unusedRow.getByRole('button', { name: 'Delete', exact: true }).filter({ visible: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Delete image', exact: true });
    await expect(confirmation).toContainText('registry.example.test/unused-web');
    await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(confirmation.getByRole('alert')).toContainText('This resource is in use');
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    await unusedRow.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Portainer fixture/ }).click();
    await expect(explorer.getByRole('checkbox').filter({ has: page.locator(':checked') })).toHaveCount(0);
    await explorer.getByRole('tab', { name: /^Volumes/ }).click();
    await expect(explorer.getByRole('row').filter({ hasText: /^fixture-data/ }).getByRole('checkbox')).toBeDisabled();
    await expect(explorer.getByRole('row').filter({ hasText: 'unused-fixture-data' }).getByRole('checkbox')).toBeEnabled();
    await page.route('**/api/config?type=dockerHost&id=*', route => route.fulfill({ status: 500, json: { error: 'Fictional storage failure' } }));
    await page.getByTitle('Edit mode', { exact: true }).click();
    await page.locator('[data-widget-id="relay-hosts"]').getByRole('button', { name: 'Delete the Docker host', exact: true }).first().click();
    const hostConfirmation = page.getByRole('dialog', { name: 'Delete the Docker host', exact: true });
    await hostConfirmation.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(hostConfirmation.getByRole('alert')).toContainText('Could not remove the Docker host');
    await expect(hostConfirmation).toBeVisible();
    await expect(page.getByRole('button', { name: /Portainer fixture/ })).toHaveAttribute('aria-pressed', 'true');
    await hostConfirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(failures).toEqual([]);
  } finally {
    expect((await page.request.delete(`/api/pages?id=${fixture.id}`)).status()).toBe(200);
  }
});
