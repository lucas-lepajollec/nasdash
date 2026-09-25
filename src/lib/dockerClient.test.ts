import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DockerApiHttpError,
  classifyDockerError,
  dockerFailureStatus,
  fetchDockerApi,
  reportDockerFailure,
  reportDockerSuccess,
  validateDockerHostUrl,
} from './dockerClient';

describe('Docker failure classification', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects incomplete host URLs without contacting the network', () => {
    expect(() => validateDockerHostUrl('192.168.1.20:2375')).toThrow();
    expect(() => validateDockerHostUrl('')).toThrow();
    expect(() => validateDockerHostUrl('http://192.168.1.20:2375')).not.toThrow();
    expect(() => validateDockerHostUrl('https://docker.example.test')).not.toThrow();
    expect(() => validateDockerHostUrl('mock-large')).not.toThrow();
  });

  it('distinguishes an offline host from invalid configuration and denied access', () => {
    const offline = classifyDockerError(Object.assign(new TypeError('fetch failed'), {
      cause: { code: 'ECONNREFUSED' },
    }));
    expect(offline).toMatchObject({ category: 'unavailable', code: 'host_unreachable', retryable: true });
    expect(dockerFailureStatus(offline)).toBe(503);

    let invalidError: unknown;
    try {
      validateDockerHostUrl('192.168.1.20:2375');
    } catch (error) {
      invalidError = error;
    }
    expect(classifyDockerError(invalidError)).toMatchObject({ category: 'configuration', code: 'invalid_url' });

    const denied = classifyDockerError(new DockerApiHttpError(403));
    expect(denied).toMatchObject({ category: 'permission', code: 'access_denied', retryable: false });
    expect(dockerFailureStatus(denied)).toBe(502);
  });

  it('keeps DNS resolution failures retryable without claiming the saved URL is invalid', () => {
    const dnsFailure = classifyDockerError(Object.assign(new TypeError('fetch failed'), {
      cause: { code: 'ENOTFOUND' },
    }));

    expect(dnsFailure).toMatchObject({
      category: 'unavailable',
      code: 'name_resolution',
      retryable: true,
      isOffline: true,
    });
    expect(dockerFailureStatus(dnsFailure)).toBe(503);
  });

  it('preserves Docker action methods and explicitly accepted non-2xx statuses', async () => {
    const network = vi.fn(async () => new Response('', { status: 409 }));
    vi.stubGlobal('fetch', network);

    const response = await fetchDockerApi(
      'http://docker-proxy:2375',
      '/images/image-id',
      { method: 'DELETE' },
      5_000,
      [409],
    );

    expect(response.status).toBe(409);
    expect(network).toHaveBeenCalledWith(
      'http://docker-proxy:2375/images/image-id',
      expect.objectContaining({ method: 'DELETE', signal: expect.any(AbortSignal) }),
    );
  });

  it('deduplicates repeated offline warnings and announces recovery', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const hostId = `test-offline-${Date.now()}`;
    const offline = classifyDockerError(new Error('fetch failed'));

    reportDockerFailure(hostId, offline);
    reportDockerFailure(hostId, offline);
    expect(warn).toHaveBeenCalledOnce();

    reportDockerSuccess(hostId);
    expect(info).toHaveBeenCalledOnce();
  });
});

describe('docker transports', () => {
  it('reads the API through a mounted Unix socket', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const http = await import('node:http');
    const { fetchDockerApi, readDockerJson, DockerApiHttpError } = await import('./dockerClient');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-sock-'));
    const socketPath = path.join(dir, 'docker.sock');
    const containers = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/integrations/docker/samples/containers.json'), 'utf8'));
    const server = http.createServer((req, res) => {
      if (req.url?.startsWith('/containers/json')) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(containers)); return; }
      res.statusCode = 404; res.end('{"message":"page not found"}');
    });
    await new Promise<void>(resolve => server.listen(socketPath, resolve));
    try {
      const host = { type: 'socket' as const, url: '', socketPath };
      const list = await readDockerJson(await fetchDockerApi(host, '/containers/json?all=true')) as { Names: string[] }[];
      expect(list.map(container => container.Names[0])).toEqual(['/jellyfin', '/forgejo']);
      await expect(fetchDockerApi(host, '/nope')).rejects.toBeInstanceOf(DockerApiHttpError);
      // Only absolute `.sock` paths, no traversal.
      await expect(fetchDockerApi({ type: 'socket', url: '', socketPath: 'relative.sock' }, '/containers/json')).rejects.toThrow();
      await expect(fetchDockerApi({ type: 'socket', url: '', socketPath: '/etc/../etc/passwd' }, '/containers/json')).rejects.toThrow();
    } finally {
      server.close();
    }
  });
});
