import { expect, request as playwrightRequest, test, type APIRequestContext } from '@playwright/test';

const ADMIN_PASSWORD = 'playwright-admin-password';
const VIEWER_PASSWORD = 'playwright-viewer-password';

async function isolatedRequest(ipSuffix: number): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL: 'http://127.0.0.1:2510',
    extraHTTPHeaders: { 'x-forwarded-for': `10.250.0.${ipSuffix}` },
  });
}

async function login(api: APIRequestContext, username: string, password: string) {
  const response = await api.post('/api/auth/login', {
    data: { username, password },
  });
  expect(response.status()).toBe(200);
}

test.describe.serial('critical self-hosted paths', () => {
  test('public mode renders for an anonymous viewer and blocks writes', async ({ page }) => {
    const anonymous = await isolatedRequest(10);
    const me = await anonymous.get('/api/auth/me');
    expect(me.status()).toBe(200);
    expect(await me.json()).toMatchObject({
      user: { role: 'viewer', isAnonymous: true },
    });

    const configResponse = await anonymous.get('/api/config');
    expect(configResponse.status()).toBe(200);
    const config = await configResponse.json();
    expect(config.settings.securityMode).toBe('public');
    expect(config.devices[0]?.api?.token).toBeUndefined();
    // Monitoring connections reach visitors without their address or secrets.
    const monitoring = (config.integrations ?? []).filter((instance: { type: string }) => ['glances', 'netdata', 'beszel', 'prometheus', 'proxmox', 'lhm'].includes(instance.type));
    for (const instance of monitoring) {
      expect(instance.secrets).toBeUndefined();
      expect(instance.settings).toEqual({});
    }
    expect(config.dockerHosts[0]?.url).toBe('');

    const forbiddenWrite = await anonymous.put('/api/config', {
      data: { type: 'settings', title: 'anonymous-write-must-fail' },
    });
    expect(forbiddenWrite.status()).toBe(401);
    await anonymous.dispose();

    const dockerRequests: string[] = [];
    page.on('request', request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith('/api/docker/')) dockerRequests.push(pathname);
    });

    await page.goto('/');
    await expect(page.locator('.nd-shell')).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/$/);
    await page.waitForTimeout(750);
    expect(dockerRequests).toEqual([]);

    const visibleDockerRequest = page.waitForRequest(request => (
      new URL(request.url()).pathname.startsWith('/api/docker/')
    ));
    await page.evaluate(() => localStorage.setItem('nasdash-active-tab', 'docker'));
    await page.reload();
    await visibleDockerRequest;
  });

  test('admin login through the UI persists a normal settings update', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page.locator('.nd-shell')).toBeVisible({ timeout: 30_000 });

    await page.waitForTimeout(1_100);
    const update = await page.request.put('/api/config', {
      data: {
        type: 'settings',
        title: 'NASDASH E2E',
        mode: 'light',
        headerLayoutMobile: { left: 'title', center: 'search' },
        tabs: { widgets: { hideClock: false } },
        weatherLocations: [{ id: 'e2e-paris', lat: 48.8566, lon: 2.3522, name: 'Paris' }],
        activeWeatherLocationId: 'e2e-paris',
      },
    });
    expect(update.status()).toBe(200);

    const persisted = await page.request.get('/api/config');
    expect(persisted.status()).toBe(200);
    expect((await persisted.json()).settings).toMatchObject({
      title: 'NASDASH E2E',
      mode: 'light',
      headerLayoutMobile: { left: 'title', center: 'search' },
      tabs: { widgets: { hideClock: false } },
      weatherLocations: [{ id: 'e2e-paris', lat: 48.8566, lon: 2.3522, name: 'Paris' }],
      activeWeatherLocationId: 'e2e-paris',
    });
  });

  test('admin can create, edit and persist a page through its real API contract', async () => {
    const admin = await isolatedRequest(20);
    await login(admin, 'admin', ADMIN_PASSWORD);

    const create = await admin.post('/api/pages', {
      data: { action: 'create', name: 'E2E Page', icon: 'lucide:LayoutDashboard', template: 'blank' },
    });
    expect(create.status()).toBe(201);
    const { page } = await create.json();

    // Pages are a free grid: each widget has its place (columns out of 24, rows of 4 px).
    const edited = {
      ...page,
      widgets: [...page.widgets, { id: 'e2e-clock', type: 'clock', settings: {}, x: 0, y: 0, w: 6, h: 40 }],
    };
    const save = await admin.put('/api/pages', { data: { page: edited } });
    expect(save.status()).toBe(200);
    expect((await save.json()).page.revision).toBe(page.revision + 1);

    // A second writer holding the old revision is refused instead of overwriting.
    const stale = await admin.put('/api/pages', { data: { page: edited } });
    expect(stale.status()).toBe(409);

    const saved = await admin.get('/api/pages');
    expect(saved.status()).toBe(200);
    const stored = (await saved.json()).pages.find((candidate: { id: string }) => candidate.id === page.id);
    expect(stored.widgets.find((widget: { id: string }) => widget.id === 'e2e-clock')).toMatchObject({ type: 'clock', x: 0, w: 6 });
    await admin.dispose();
  });

  test('admin can create and edit a category with a service using UI payloads', async () => {
    const admin = await isolatedRequest(25);
    await login(admin, 'admin', ADMIN_PASSWORD);

    const createCategory = await admin.post('/api/config', {
      data: {
        type: 'category',
        title: 'E2E Applications',
        emoji: '🚀',
        isSecret: false,
        layout: 'bento-logo-medium',
      },
    });
    expect(createCategory.status()).toBe(201);
    const category = await createCategory.json();

    const createService = await admin.post('/api/config', {
      data: {
        type: 'service',
        categoryId: category.id,
        name: 'E2E Service',
        logo: '',
        localUrl: 'http://127.0.0.1:65534',
        secondaryUrl: 'https://service.example.test',
        secondaryLogo: '',
      },
    });
    expect(createService.status()).toBe(201);

    const configResponse = await admin.get('/api/config');
    expect(configResponse.status()).toBe(200);
    const config = await configResponse.json();
    const persistedCategory = config.categories.find((item: { id: string }) => item.id === category.id);
    expect(persistedCategory.services).toHaveLength(1);

    const updateCategory = await admin.put('/api/config', {
      data: {
        type: 'category',
        id: category.id,
        title: 'E2E Applications updated',
        emoji: '🚀',
        isSecret: false,
        layout: 'compact',
        services: persistedCategory.services,
      },
    });
    expect(updateCategory.status()).toBe(200);

    const reloaded = await admin.get('/api/config');
    const updatedConfig = await reloaded.json();
    const updatedCategory = updatedConfig.categories.find((item: { id: string }) => item.id === category.id);
    expect(updatedCategory).toMatchObject({
      title: 'E2E Applications updated',
      layout: 'compact',
    });
    expect(updatedCategory.services[0]).toMatchObject({
      name: 'E2E Service',
      secondaryUrl: 'https://service.example.test',
    });
    await admin.dispose();
  });

  test('Docker tab actions remain independent from widget button visibility', async () => {
    const admin = await isolatedRequest(27);
    await login(admin, 'admin', ADMIN_PASSWORD);

    const configResponse = await admin.get('/api/config');
    expect(configResponse.status()).toBe(200);
    expect((await configResponse.json()).settings.allowDockerActions).toBe(false);

    const createHost = await admin.post('/api/config', {
      data: {
        type: 'dockerHost',
        name: 'E2E Mock Docker',
        icon: '🐳',
        url: 'mock',
      },
    });
    expect(createHost.status()).toBe(201);
    const host = await createHost.json();

    const action = await admin.post(`/api/docker/${host.id}/containers/mock11111111?action=restart`);
    expect(action.status()).toBe(200);
    expect(await action.json()).toMatchObject({ ok: true, action: 'restart' });

    const unboundedLogs = await admin.get(`/api/docker/${host.id}/containers/mock11111111/logs?tail=all`);
    expect(unboundedLogs.status()).toBe(400);

    const viewer = await isolatedRequest(28);
    await login(viewer, 'viewer', VIEWER_PASSWORD);
    const forbiddenAction = await viewer.post(`/api/docker/${host.id}/containers/mock11111111?action=restart`);
    expect(forbiddenAction.status()).toBe(401);
    await viewer.dispose();

    const cleanup = await admin.delete(`/api/config?type=dockerHost&id=${encodeURIComponent(host.id)}`);
    expect(cleanup.status()).toBe(200);
    await admin.dispose();
  });

  test('viewer can read but cannot mutate configuration', async () => {
    const viewer = await isolatedRequest(30);
    await login(viewer, 'viewer', VIEWER_PASSWORD);

    expect((await viewer.get('/api/config')).status()).toBe(200);
    const forbiddenWrite = await viewer.put('/api/config', {
      data: { type: 'settings', title: 'viewer-write-must-fail' },
    });
    expect(forbiddenWrite.status()).toBe(401);
    await viewer.dispose();
  });

  test('custom CSS safe mode keeps recovery controls reachable', async ({ browser }) => {
    const admin = await isolatedRequest(35);
    await login(admin, 'admin', ADMIN_PASSWORD);

    try {
      const hideInterface = await admin.put('/api/config', {
        data: { type: 'settings', customCss: 'body { display: none !important; }' },
      });
      expect(hideInterface.status()).toBe(200);

      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto('/?safe-css=1');
      await expect(page.locator('.nd-shell')).toBeVisible({ timeout: 30_000 });
      await context.close();
    } finally {
      const reset = await admin.put('/api/config', {
        data: { type: 'settings', customCss: '' },
      });
      expect(reset.status()).toBe(200);
      await admin.dispose();
    }
  });

  test('admin logout clears the session and reloads the login page', async ({ page }) => {
    await page.addInitScript(() => {
      const originalClose = EventSource.prototype.close;
      EventSource.prototype.close = function close() {
        const closeCount = Number(sessionStorage.getItem('nasdash-e2e-event-source-close-count') || '0');
        sessionStorage.setItem('nasdash-e2e-event-source-close-count', String(closeCount + 1));
        return originalClose.call(this);
      };
    });

    await page.goto('/login');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    const systemResponse = page.waitForResponse(response => response.url().endsWith('/api/system'));
    const initialDashboardResponses = Promise.all([
      // The Calme device widgets read the history route (Classic reads /api/devices/<id>).
      page.waitForResponse(response => /\/api\/devices\/demo-device-1(\/history|$|\?)/.test(response.url())),
      page.waitForResponse(response => /\/api\/devices\/demo-device-2(\/history|$|\?)/.test(response.url())),
      page.waitForResponse(response => response.url().endsWith('/api/ping/batch')),
    ]);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await Promise.all([systemResponse, initialDashboardResponses]);
    await page.evaluate(() => sessionStorage.setItem('nasdash-e2e-event-source-close-count', '0'));

    await page.getByTitle('Log out').click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
    expect(await page.evaluate(() => Number(sessionStorage.getItem('nasdash-e2e-event-source-close-count')))).toBe(1);

    const session = await page.request.get('/api/auth/me');
    expect(session.status()).toBe(200);
    expect(await session.json()).toMatchObject({
      user: { role: 'viewer', isAnonymous: true },
    });
  });

  test('private mode rejects anonymous access and redirects the browser to login', async ({ browser }) => {
    const admin = await isolatedRequest(40);
    await login(admin, 'admin', ADMIN_PASSWORD);
    const makePrivate = await admin.put('/api/config', {
      data: { type: 'settings', securityMode: 'private' },
    });
    expect(makePrivate.status()).toBe(200);

    const anonymous = await isolatedRequest(41);
    expect((await anonymous.get('/api/config')).status()).toBe(401);
    expect((await anonymous.get('/api/logos')).status()).toBe(401);
    expect((await anonymous.get('/api/logos/logo.png')).status()).toBe(401);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    await context.close();
    await anonymous.dispose();

    const restorePublic = await admin.put('/api/config', {
      data: { type: 'settings', securityMode: 'public' },
    });
    expect(restorePublic.status()).toBe(200);
    await admin.dispose();
  });

  test('changing the current admin password redirects clearly to a fresh login', async ({ page }) => {
    const replacementPassword = 'playwright-admin-password-updated';

    await page.goto('/login');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });

    await page.getByTitle('Global Settings').click();
    const settingsDialog = page.getByRole('dialog', { name: 'NasDash Settings' });
    // Users are listed straight on the "Users and access" page.
    await settingsDialog.locator('.nd-settings-sidebar').getByRole('button', { name: 'Users and access', exact: true }).click();
    await settingsDialog.getByTitle('Edit user admin / permissions').click();
    await settingsDialog.getByLabel('Password', { exact: true }).fill(replacementPassword);
    await settingsDialog.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL(/\/login\?reason=password-changed$/, { timeout: 30_000 });
    await expect(page.getByRole('status')).toHaveText(
      'Your password has been changed. Sign in again with your new password.',
    );

    const expiredSession = await page.request.get('/api/auth/me');
    expect(expiredSession.status()).toBe(200);
    expect(await expiredSession.json()).toMatchObject({
      user: { role: 'viewer', isAnonymous: true },
    });

    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill(replacementPassword);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  });
});
