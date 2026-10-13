import { expect, test, type Page as BrowserPage } from '@playwright/test';
import type { Page as SavedPage } from '@/lib/pages/types';

test.use({ extraHTTPHeaders: { 'x-forwarded-for': '198.18.0.10' } });

async function resourceFixture(page: BrowserPage) {
  expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'playwright-admin-password' } })).status()).toBe(200);
  const config = await (await page.request.get('/api/config')).json();
  const created = await page.request.post('/api/pages', { data: { action: 'create', template: 'blank', name: 'Resource browser fixture' } });
  expect(created.status()).toBe(201);
  const { page: fixture } = await created.json() as { page: SavedPage };
  const images = Array.from({ length: 27 }, (_, index) => ({
    id: index.toString(16).padStart(64, '0'), repoTags: index === 26 ? [] : [`registry.example.test/very-long-project-name/image-${String(index).padStart(2, '0')}:release`, ...(index === 2 ? ['extra-tag:stable'] : [])],
    repoDigests: index === 26 ? ['registry.example.test/zz-maintenance-tools@sha256:fictional'] : [], size: index * 100_000, created: 1_780_517_682 - index * 86_400, containers: [0, 14].includes(index) ? 1 : 0,
  }));
  const volumes = Array.from({ length: 27 }, (_, index) => ({ name: `resource-data-${String(index).padStart(2, '0')}-with-a-long-configuration-name`, driver: 'local', mountpoint: `/var/lib/docker/volumes/resource-data-${index}/_data`, createdAt: '2026-01-01T00:00:00Z', usageData: { refCount: index === 0 ? 1 : 0, size: -1 } }));
  const removed = new Set<string>();
  const calls: string[] = [];
  let failOnce = true;
  await page.route('**/api/config', route => route.request().method() === 'GET' ? route.fulfill({ json: { ...config, settings: { ...config.settings, securityMode: 'public', uiLanguage: 'en' }, dockerHosts: [{ id: 'resources', type: 'dockhand', name: 'Resource fixture', icon: 'D', url: '', target: '1' }] } }) : route.continue());
  await page.route('**/api/docker/**', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'DELETE') {
      const target = url.searchParams.get('id') ?? url.searchParams.get('name')!;
      calls.push(target);
      await new Promise(resolve => setTimeout(resolve, 40));
      if (target === images[12].id && failOnce) { failOnce = false; return route.fulfill({ status: 409, json: { error: 'Docker image is in use and cannot be deleted.' } }); }
      removed.add(target);
      return route.fulfill({ json: { success: true } });
    }
    if (url.pathname.endsWith('/images')) return route.fulfill({ json: images.filter(image => !removed.has(image.id)) });
    if (url.pathname.endsWith('/volumes')) return route.fulfill({ json: volumes.filter(volume => !removed.has(volume.name)) });
    if (url.pathname.endsWith('/containers')) return route.fulfill({ json: [{ id: 'stopped', fullId: 'stopped-container', names: ['stopped-web'], imageId: images[0].id, state: 'exited', mounts: [{ name: volumes[0].name }] }] });
    return route.fulfill({ json: {} });
  });
  expect((await page.request.put('/api/pages', { data: { page: { ...fixture, widgets: [{ id: 'resource-explorer', type: 'docker-explorer', x: 0, y: 0, w: 24, h: 150 }] } } })).status()).toBe(200);
  await page.addInitScript(value => localStorage.setItem('nasdash-active-tab', value), fixture.id);
  await page.goto('/');
  const explorer = page.locator('[data-widget-id="resource-explorer"]');
  await explorer.getByRole('tab', { name: /^Images/ }).click();
  await expect(explorer.locator('.nd-docker-resource-row')).toHaveCount(10);
  return { explorer, images, volumes, calls, cleanup: async () => expect((await page.request.delete(`/api/pages?id=${fixture.id}`)).status()).toBe(200) };
}

test('resource pagination keeps page selections explicit and retries only failed deletions', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Uses isolated installed-instance fixtures.');
  const { explorer, images, calls, cleanup } = await resourceFixture(page);
  try {
    const selectPage = explorer.getByRole('checkbox', { name: 'Select unused resources on this page', exact: true });
    await expect(explorer.locator(`[data-resource-id="${images[0].id}"]`).getByRole('checkbox')).toBeDisabled();
    await selectPage.check();
    await expect(explorer).toContainText('9 selected');
    await explorer.getByRole('button', { name: 'Next page', exact: true }).click();
    await selectPage.check();
    await expect(explorer).toContainText('18 selected');
    await explorer.getByRole('button', { name: 'Delete selection', exact: true }).click();
    const dialog = page.locator('.nd-docker-resource-confirm');
    await expect(dialog).toHaveAttribute('aria-label', 'Delete images');
    await expect(dialog.locator('.nd-docker-resource-targets li')).toHaveCount(18);
    const deleteButton = dialog.getByRole('button', { name: 'Delete', exact: true });
    await deleteButton.click();
    await expect(deleteButton).toBeDisabled();
    await expect(dialog.getByRole('alert')).toContainText('Only failed deletions remain');
    await expect(dialog.locator('.nd-docker-resource-targets li')).toHaveCount(1);
    expect(calls).toHaveLength(18);
    expect(calls).not.toContain(images[0].id);
    expect(calls).not.toContain(images[14].id);
    await deleteButton.click();
    await expect(dialog).not.toBeVisible();
    expect(calls).toHaveLength(19);
    expect(calls[18]).toBe(images[12].id);
    await expect(explorer.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
  } finally { await cleanup(); }
});

test('resource search finds extra tags and details; filters clear hidden selections and volumes stay readable', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Uses isolated installed-instance fixtures.');
  const { explorer, images, cleanup } = await resourceFixture(page);
  try {
    const search = explorer.getByRole('searchbox');
    await search.fill('extra-tag');
    await expect(explorer.locator('.nd-docker-resource-row')).toHaveCount(1);
    await explorer.getByRole('button', { name: `Details for ${images[2].repoTags[0]}`, exact: true }).click();
    await expect(explorer.locator('.nd-docker-resource-details')).toContainText('extra-tag:stable');
    await explorer.getByRole('checkbox', { name: 'Select unused resources on this page', exact: true }).check();
    await search.fill('nothing-matches');
    await expect(explorer).toContainText('No matching resources');
    await expect(explorer.locator('.nd-docker-resource-selection')).toHaveCount(0);
    await explorer.getByRole('button', { name: 'Reset filters', exact: true }).click();
    await explorer.getByRole('combobox', { name: 'Status', exact: true }).selectOption('untagged');
    await expect(explorer).toContainText('registry.example.test/zz-maintenance-tools');
    await explorer.getByRole('tab', { name: /^Volumes/ }).click();
    await expect(explorer.locator('.nd-docker-resource-row')).toHaveCount(10);
    await explorer.getByRole('button', { name: /^Details for resource-data-00/ }).click();
    await expect(explorer.locator('.nd-docker-resource-details')).toContainText('stopped-web');
    await expect(explorer.locator('.nd-docker-resource-details')).toContainText('Not reported');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => explorer.locator('.nd-docker-resources').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await expect(explorer.getByRole('button', { name: /^Details for resource-data-00/ })).toBeVisible();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await explorer.evaluate(element => { element.style.maxWidth = '400px'; });
    await expect.poll(() => explorer.locator('.nd-docker-resources').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await expect(explorer.locator('.nd-docker-resource-actions').first()).toBeVisible();
  } finally { await cleanup(); }
});

test('refresh discards newly used selections and prevents stale confirmation targets', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Uses isolated installed-instance fixtures.');
  const { explorer, images, calls, cleanup } = await resourceFixture(page);
  try {
    const row = explorer.locator(`[data-resource-id="${images[1].id}"]`);
    await row.getByRole('checkbox').check();
    images[1].containers = 1;
    await explorer.locator('.nd-docker-resources').getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(row.getByRole('checkbox')).toBeDisabled();
    await expect(row.getByRole('checkbox')).not.toBeChecked();
    await expect(explorer.locator('.nd-docker-resource-selection')).toHaveCount(0);
    const other = explorer.locator(`[data-resource-id="${images[2].id}"]`);
    await other.getByRole('button', { name: 'Delete', exact: true }).click();
    images[2].containers = 1;
    // Simulate a background refresh while a confirmation is open.
    await explorer.locator('.nd-docker-resources').getByRole('button', { name: 'Refresh', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
    const dialog = page.locator('.nd-docker-resource-confirm');
    await expect(dialog.getByRole('alert')).toContainText('The resource list changed');
    await expect(dialog.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(calls).toEqual([]);
  } finally { await cleanup(); }
});

test('resource API failures remain distinct from an empty list and can be retried', async ({ page }) => {
  test.skip(process.env.NASDASH_DEMO_MODE === 'true', 'Uses isolated installed-instance fixtures.');
  const { explorer, cleanup } = await resourceFixture(page);
  let fail = true;
  await page.route('**/api/docker/resources/images', route => fail
    ? route.fulfill({ status: 403, json: { error: 'Docker API access denied.', code: 'access_denied', category: 'permission', hint: 'docker.failure.access_denied', retryable: false, isOffline: false } })
    : route.fulfill({ json: [] }));
  try {
    await explorer.locator('.nd-docker-resources').getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(explorer).toContainText('Docker access denied');
    await expect(explorer.getByText('No images', { exact: true })).toHaveCount(0);
    fail = false;
    await explorer.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(explorer).toContainText('No images');
    await expect(explorer.locator('.nd-docker-resource-pagination')).toContainText('0–0 of 0');
    await expect(explorer.getByRole('checkbox', { name: 'Select unused resources on this page', exact: true })).toBeDisabled();
  } finally { await cleanup(); }
});
