import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import { httpGet, httpRequest } from './http';

const listen = (server: http.Server | https.Server) => new Promise<string>(resolve => server.listen(0, '127.0.0.1', () => resolve(`${server instanceof https.Server ? 'https' : 'http'}://127.0.0.1:${(server.address() as AddressInfo).port}`)));
const close = (server: http.Server | https.Server) => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); });

describe('collector redirects with certificate opt-in', () => {
  let root: string, secureRoot: string, targetRoot: string, directory: string;
  let server: http.Server, secure: https.Server, target: http.Server;
  let received: { authorization?: string; cookie?: string; method?: string; body?: string };
  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-http-cert-'));
    const made = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1', '-keyout', path.join(directory, 'key.pem'), '-out', path.join(directory, 'cert.pem')], { stdio: 'ignore' });
    if (made.status !== 0) throw new Error('openssl is required for TLS regression tests');
    target = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => { received = { authorization: req.headers.authorization, cookie: req.headers.cookie, method: req.method, body }; res.end('target'); });
    });
    targetRoot = await listen(target);
    secure = https.createServer({ key: fs.readFileSync(path.join(directory, 'key.pem')), cert: fs.readFileSync(path.join(directory, 'cert.pem')) }, (req, res) => {
      if (req.url === '/downgrade') { res.writeHead(302, { Location: `${targetRoot}/` }); res.end(); }
      else res.end('secure');
    });
    secureRoot = await listen(secure);
    server = http.createServer((req, res) => {
      if (req.url === '/upgrade') { res.writeHead(302, { Location: `${secureRoot}/` }); res.end(); }
      else if (req.url === '/cross') { res.writeHead(302, { Location: `${targetRoot}/` }); res.end(); }
      else if (req.url === '/cross-post') { res.writeHead(307, { Location: `${targetRoot}/` }); res.end(); }
      else if (req.url === '/preserve') { res.writeHead(307, { Location: '/echo' }); res.end(); }
      else if (req.url === '/echo') {
        let body = ''; req.on('data', chunk => { body += chunk; });
        req.on('end', () => { received = { authorization: req.headers.authorization, method: req.method, body }; res.end('echo'); });
      } else if (req.url === '/loop') { res.writeHead(302, { Location: '/loop' }); res.end(); }
      else if (req.url === '/large') res.end('x'.repeat(2 * 1024 * 1024 + 1));
      else if (req.url === '/slow') { res.writeHead(200); res.write('waiting'); }
      else res.end('ok');
    });
    root = await listen(server);
  });
  afterAll(async () => { await Promise.all([close(server), close(secure), close(target)]); fs.rmSync(directory, { recursive: true, force: true }); });
  it('accepts a same-host HTTP-to-HTTPS redirect only with explicit certificate opt-in', async () => {
    await expect(httpGet(`${root}/upgrade`)).rejects.toThrow();
    expect(await (await httpGet(`${root}/upgrade`, { allowSelfSigned: true })).text()).toBe('secure');
  });
  it('strips credentials across origins and retains them for same-origin 307 POST', async () => {
    await httpGet(`${root}/cross`, { allowSelfSigned: true, headers: { Authorization: 'synthetic', Cookie: 'fictional' } });
    expect(received).toMatchObject({ authorization: undefined, cookie: undefined, method: 'GET' });
    await httpRequest(`${root}/preserve`, { allowSelfSigned: true, method: 'POST', json: { test: true }, headers: { Authorization: 'synthetic' } });
    expect(received).toMatchObject({ authorization: 'synthetic', method: 'POST', body: '{"test":true}' });
  });
  it.each([false, true])('never exports a credential-bearing POST body to a redirected origin (certificate opt-in %s)', async allowSelfSigned => {
    await expect(httpRequest(`${root}/cross-post`, { allowSelfSigned, method: 'POST', json: { password: 'fictional' } })).rejects.toThrow('request-body redirect rejected');
  });
  it('rejects HTTPS downgrade and redirect loops', async () => {
    await expect(httpGet(`${secureRoot}/downgrade`, { allowSelfSigned: true })).rejects.toThrow('downgrade');
    await expect(httpGet(`${root}/loop`, { allowSelfSigned: true })).rejects.toThrow('Too many redirects');
  });
  it('bounds the total timeout and response bytes', async () => {
    await expect(httpGet(`${root}/slow`, { allowSelfSigned: true, timeoutMs: 40 })).rejects.toThrow('Timeout');
    await expect(httpGet(`${root}/large`, { allowSelfSigned: true })).rejects.toThrow('2 MiB');
    await expect(httpGet(`${root}/large`)).rejects.toThrow('2 MiB');
  });
});
