import { afterEach, describe, expect, it, vi } from 'vitest';
import { DockerInvalidResponseError, classifyDockerError, fetchDockerApi, requireDockerArray, validateDockerSocketPath } from './dockerClient';
import { dockerActionError, dockerJsonFetcher } from './dockerErrorContract';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('Docker failure regressions', () => {
  it('diagnoses socket permission and absent mounts instead of retrying an offline host', () => {
    expect(classifyDockerError(Object.assign(new Error('permission'), { code: 'EACCES' }))).toMatchObject({ code: 'access_denied', category: 'permission', isOffline: false, retryable: false });
    expect(classifyDockerError(Object.assign(new Error('missing'), { code: 'ENOENT' }))).toMatchObject({ code: 'socket_missing', category: 'configuration', retryable: false });
    let error: unknown; try { validateDockerSocketPath('relative.sock'); } catch (cause) { error = cause; }
    expect(classifyDockerError(error)).toMatchObject({ code: 'invalid_socket', hint: 'docker.failure.invalid_socket' });
  });
  it.each([new Response('<html>login</html>'), Response.json({ login: true }), Response.json(null)])('rejects success responses which are not a resource list', async response => {
    vi.stubGlobal('fetch', vi.fn(async () => response));
    await expect(dockerJsonFetcher('/api/docker/host/images')).rejects.toMatchObject({ code: 'invalid_response', isOffline: false });
  });
  it('rejects missing IDs and non-lists before resource normalisation', () => {
    for (const bad of [{ error: 'login' }, [null], [{}], [{ Id: 42 }]]) expect(() => requireDockerArray(bad, 'Id')).toThrow(DockerInvalidResponseError);
    expect(requireDockerArray([], 'Id')).toEqual([]);
  });
  it('preserves conflict reason in translated deletion feedback', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Docker image is in use and cannot be deleted.' }, { status: 409 })));
    try { await dockerJsonFetcher('/api/docker/host/images'); } catch (error) { expect(dockerActionError(error, key => `translated:${key}`)).toBe('translated:docker.failure.resource_in_use'); }
  });
  it('relays Portainer resources with explicit environment and API key', async () => {
    const network = vi.fn(async () => Response.json([])); vi.stubGlobal('fetch', network);
    await fetchDockerApi({ type: 'portainer', url: 'https://relay.example.test', target: '3', token: 'fictional-key' }, '/images/json');
    expect(network).toHaveBeenCalledWith('https://relay.example.test/api/endpoints/3/docker/images/json', expect.objectContaining({ headers: { 'X-API-Key': 'fictional-key' } }));
  });
});
