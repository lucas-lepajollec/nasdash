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
    await page.getByLabel("Nom d'utilisateur").fill('admin');
    await page.getByLabel('Mot de passe').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();

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

  test('admin can persist a custom-tab layout through its real API contract', async () => {
    const admin = await isolatedRequest(20);
    await login(admin, 'admin', ADMIN_PASSWORD);

    const create = await admin.post('/api/custom-tabs', {
      data: {
        type: 'createTab',
        name: 'E2E Tab',
        icon: 'lucide:LayoutDashboard',
        description: 'Isolated browser test',
      },
    });
    expect(create.status()).toBe(201);
    const created = await create.json();

    const layout = {
      rows: [{
        id: 'e2e-row',
        type: '1-col',
        columns: [{
          id: 'e2e-column',
          width: '100%',
          content: null,
          widgets: [{ type: 'clock' }],
        }],
      }],
    };
    const saveLayout = await admin.put('/api/custom-tabs', {
      data: { id: created.tab.id, layoutUpdates: layout },
    });
    expect(saveLayout.status()).toBe(200);

    const saved = await admin.get('/api/custom-tabs');
    expect(saved.status()).toBe(200);
    expect((await saved.json()).layouts[created.tab.id].rows).toEqual(layout.rows);
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

  test('admin logout clears the session and reloads the login page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel("Nom d'utilisateur").fill('admin');
    await page.getByLabel('Mot de passe').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });

    await page.getByTitle('Se déconnecter').click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });

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

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
    await context.close();
    await anonymous.dispose();

    const restorePublic = await admin.put('/api/config', {
      data: { type: 'settings', securityMode: 'public' },
    });
    expect(restorePublic.status()).toBe(200);
    await admin.dispose();
  });
});
