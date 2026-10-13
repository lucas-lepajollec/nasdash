import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { DockerHostConfigurationError, fetchDockerApi, readDockerJson } from './dockerClient';

describe('Docker opt-in TLS redirects', () => {
  it('follows a same-host HTTP to self-signed HTTPS upgrade only with opt-in and retains relay credentials', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nasdash-fictional-docker-tls-'));
    const key = join(dir, 'key.pem'), cert = join(dir, 'cert.pem');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
    const seen: { path: string; token: string | undefined }[] = [];
    const secure = https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) => {
      if (req.url === '/downgrade') { res.writeHead(302, { location: 'http://127.0.0.1/insecure' }); res.end(); return; }
      seen.push({ path: req.url!, token: req.headers['x-api-key'] as string | undefined });
      res.setHeader('content-type', 'application/json'); res.end('[]');
    });
    const redirect = http.createServer((req, res) => {
      res.writeHead(302, { location: req.url === '/other-host' ? 'https://other.example.test/nope' : `https://127.0.0.1:${(secure.address() as { port: number }).port}${req.url}` }); res.end();
    });
    await new Promise<void>(resolve => secure.listen(0, '127.0.0.1', resolve));
    await new Promise<void>(resolve => redirect.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(redirect.address() as { port: number }).port}`;
    try {
      const host = { type: 'portainer' as const, url, target: '1', token: 'fictional-relay-key', allowSelfSigned: true };
      expect(await readDockerJson(await fetchDockerApi(host, '/images/json'))).toEqual([]);
      expect(seen).toEqual([{ path: '/api/endpoints/1/docker/images/json', token: 'fictional-relay-key' }]);
      await expect(fetchDockerApi({ ...host, allowSelfSigned: false }, '/images/json')).rejects.toThrow();
      await expect(fetchDockerApi({ type: 'tcp', url, allowSelfSigned: true }, '/other-host')).rejects.toBeInstanceOf(DockerHostConfigurationError);
      await expect(fetchDockerApi({ type: 'tcp', url: `https://127.0.0.1:${(secure.address() as { port: number }).port}`, allowSelfSigned: true }, '/downgrade')).rejects.toBeInstanceOf(DockerHostConfigurationError);
    } finally {
      await Promise.all([new Promise<void>(resolve => redirect.close(() => resolve())), new Promise<void>(resolve => secure.close(() => resolve()))]);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
