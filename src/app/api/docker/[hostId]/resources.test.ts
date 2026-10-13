import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/config', () => ({ readConfig: vi.fn() }));
vi.mock('@/lib/access', () => ({ READ_ACCESS: { dockerContainers: 'dockerContainers', dockerDetails: 'dockerDetails' }, checkReadAccess: () => ({ session: null }) }));
vi.mock('@/lib/auth', () => ({ checkAdmin: () => null, isAdmin: () => true }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => false }));
import { readConfig } from '@/lib/config';
import { GET as listImages, DELETE as deleteImages } from './images/route';
import { GET as listVolumes, DELETE as deleteVolumes } from './volumes/route';
import { GET as listContainers } from './containers/route';
import { GET as inspect, POST as action } from './containers/[id]/route';
const id = 'a'.repeat(64), imageId = 'b'.repeat(64);
const params = { params: Promise.resolve({ hostId: 'test-host', id }) };
const host = (type: 'tcp' | 'dockhand' | 'portainer', url = 'http://relay.example.test') => vi.mocked(readConfig).mockReturnValue({ version: 1, categories: [], settings: { title: 'NasDash', showMonitor: true }, dockerHosts: [{ id: 'test-host', name: 'Fictional', icon: 'D', type, url, target: '3', token: 'fictional' }] });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); host('tcp'); });
describe('Docker resource relay regressions', () => {
  it.each(['tcp', 'portainer', 'dockhand'] as const)('preserves full image identity and retagged-image usage through %s', async type => {
    host(type);
    const network = vi.fn(async (url: string) => {
      if (url.includes('images')) return Response.json(type === 'dockhand' ? [{ id: `sha256:${imageId}`, repoTags: ['web:renamed'], containers: 1, size: 100 }] : [{ Id: `sha256:${imageId}`, RepoTags: ['web:renamed'], Containers: 1, Size: 100 }]);
      return Response.json(type === 'dockhand' ? [{ id, name: 'web', image: 'web:old', imageId: `sha256:${imageId}`, state: 'running' }] : [{ Id: id, Names: ['/web'], Image: 'web:old', ImageID: `sha256:${imageId}`, State: 'running' }]);
    });
    vi.stubGlobal('fetch', network);
    const images = await (await listImages(new Request('http://localhost/api/docker/test-host/images'), params)).json();
    const containers = await (await listContainers(new Request('http://localhost/api/docker/test-host/containers'), params)).json();
    expect(images[0]).toMatchObject({ id: imageId, repoTags: ['web:renamed'], containers: 1 });
    expect(containers[0].imageId).toBe(images[0].id);
    expect(containers[0].fullId).toBe(id);
    if (type === 'portainer') expect(network.mock.calls[0][0]).toContain('/api/endpoints/3/docker/images/json');
    if (type === 'dockhand') expect(network.mock.calls[0][0]).toContain('/api/images?env=3');
  });
  it('normalises Dockhand volumes and their in-use references', async () => {
    host('dockhand'); vi.stubGlobal('fetch', vi.fn(async () => Response.json([{ name: 'data', driver: 'local', mountpoint: '/data', usedBy: [{ containerId: id }] }])));
    const volumes = await (await listVolumes(new Request('http://localhost/api/docker/test-host/volumes'), params)).json();
    expect(volumes).toEqual([expect.objectContaining({ name: 'data', driver: 'local', usageData: { refCount: 1 } })]);
  });
  it.each([listImages, listContainers, listVolumes])('classifies an object instead of a list as invalid rather than offline or empty', async route => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ login: true })));
    const response = await route(new Request('http://localhost/api/docker/test-host/resource'), params);
    expect(response.status).toBe(502); expect(await response.json()).toMatchObject({ code: 'invalid_response', isOffline: false });
  });
  it.each([
    { Id: id, Names: 'web' }, { Id: id, Names: [null] }, { Id: id, Mounts: [null] },
  ])('rejects malformed nested container fields rather than reporting an offline host', async upstream => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([upstream])));
    const response = await listContainers(new Request('http://localhost/api/docker/test-host/containers'), params);
    expect(await response.json()).toMatchObject({ code: 'invalid_response', isOffline: false });
  });
  it('preserves valid inspect details while marking refused statistics unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/stats') ? Response.json({ error: 'denied' }, { status: 403 }) : Response.json({ Id: id, Name: '/web', State: { Status: 'running' }, Config: { Image: 'web:1' } })));
    const response = await inspect(new Request(`http://localhost/api/docker/test-host/containers/${id}`), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: 'web', stats: null, statsAvailable: false, statsError: { code: 'access_denied' } });
  });
  it('does not fabricate a Docker demo because a real URL contains mock', async () => {
    host('tcp', 'http://mock-engine.example.test/mock-audit');
    const network = vi.fn(async () => Response.json([{ Id: id, Names: ['/real-fixture'] }])); vi.stubGlobal('fetch', network);
    const response = await listContainers(new Request('http://localhost/api/docker/test-host/containers'), params);
    expect(await response.json()).toEqual([expect.objectContaining({ names: ['real-fixture'] })]); expect(network).toHaveBeenCalledOnce();
    network.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await action(new Request(`http://localhost/api/docker/test-host/containers/${id}?action=start`, { method: 'POST' }), params);
    expect(await result.json()).toEqual({ ok: true, action: 'start' }); expect(network).toHaveBeenCalledTimes(2);
  });
  it.each(['dockhand', 'portainer'] as const)('supports image and volume removal through %s without forcing conflicts', async type => {
    host(type); const network = vi.fn(async () => Response.json({ error: 'in use' }, { status: 409 })); vi.stubGlobal('fetch', network);
    expect((await deleteImages(new Request(`http://localhost/api/docker/test-host/images?id=${imageId}`, { method: 'DELETE' }), params)).status).toBe(409);
    expect((await deleteVolumes(new Request('http://localhost/api/docker/test-host/volumes?name=data', { method: 'DELETE' }), params)).status).toBe(409);
    for (const [url, options] of network.mock.calls as unknown as Array<[string, RequestInit]>) { expect(options.method).toBe('DELETE'); expect(url).not.toContain('force=true'); }
  });
});
