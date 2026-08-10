import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/config', () => ({ readConfig: vi.fn() }));
vi.mock('@/lib/access', () => ({
  READ_ACCESS: { dockerContainers: 'dockerContainers' },
  checkReadAccess: vi.fn(() => ({ session: null })),
}));

import { readConfig } from '@/lib/config';
import { GET } from './route';

const mockedReadConfig = vi.mocked(readConfig);

function routeRequest(hostId: string) {
  return GET(
    new Request(`http://localhost/api/docker/${hostId}/containers?all=true`),
    { params: Promise.resolve({ hostId }) },
  );
}

describe('Docker container diagnostics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports an invalid persisted URL as configuration instead of offline', async () => {
    mockedReadConfig.mockReturnValue({
      version: 1,
      categories: [],
      settings: { title: 'NasDash', showMonitor: true, securityMode: 'public' },
      dockerHosts: [{ id: 'bad-url', name: 'Bad', icon: 'D', type: 'tcp', url: '' }],
    });
    const network = vi.fn();
    vi.stubGlobal('fetch', network);

    const response = await routeRequest('bad-url');
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ category: 'configuration', code: 'invalid_url' });
    expect(network).not.toHaveBeenCalled();
  });

  it('reports a refused connection as a retryable host outage', async () => {
    mockedReadConfig.mockReturnValue({
      version: 1,
      categories: [],
      settings: { title: 'NasDash', showMonitor: true, securityMode: 'public' },
      dockerHosts: [{ id: 'offline-host', name: 'Offline', icon: 'D', type: 'tcp', url: 'http://127.0.0.1:2375' }],
    });
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    }));

    const response = await routeRequest('offline-host');
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      category: 'unavailable',
      code: 'host_unreachable',
      retryable: true,
      isOffline: true,
    });
  });

  it('keeps Docker permission failures distinct from connectivity failures', async () => {
    mockedReadConfig.mockReturnValue({
      version: 1,
      categories: [],
      settings: { title: 'NasDash', showMonitor: true, securityMode: 'public' },
      dockerHosts: [{ id: 'denied-host', name: 'Denied', icon: 'D', type: 'tcp', url: 'http://127.0.0.1:2375' }],
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })));

    const response = await routeRequest('denied-host');
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ category: 'permission', code: 'access_denied' });
  });
});
