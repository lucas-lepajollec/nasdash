import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { pingUrl } from './ping';

const listen = (server: http.Server | https.Server) => new Promise<number>(resolve => server.listen(0, '127.0.0.1', () => resolve((server.address() as { port: number }).port)));

describe('service ping', () => {
  it('reports a running HTTPS service with a self-signed certificate as online', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-ping-'));
    const made = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1',
      '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem')], { stdio: 'ignore' });
    if (made.status !== 0) return; // openssl not installed
    const server = https.createServer({ key: fs.readFileSync(path.join(dir, 'key.pem')), cert: fs.readFileSync(path.join(dir, 'cert.pem')) }, (_req, res) => { res.statusCode = 401; res.end(); });
    const port = await listen(server);
    // An http:// address redirecting to that HTTPS service (how Proxmox is often saved).
    const redirect = http.createServer((_req, res) => { res.writeHead(301, { Location: `https://127.0.0.1:${port}/` }); res.end(); });
    const redirectPort = await listen(redirect);
    try {
      expect(await pingUrl(`https://127.0.0.1:${port}/`)).toMatchObject({ status: 'online', selfSigned: true });
      expect(await pingUrl(`http://127.0.0.1:${redirectPort}/`)).toMatchObject({ status: 'online', selfSigned: true });
    } finally {
      server.close();
      redirect.close();
    }
  });

  it('keeps plain HTTP and refused connections as before', async () => {
    const server = http.createServer((_req, res) => res.end('ok'));
    const port = await listen(server);
    try {
      const up = await pingUrl(`http://127.0.0.1:${port}/`);
      expect(up).toMatchObject({ status: 'online', statusText: 'OK' });
      expect(up.selfSigned).toBeUndefined();
    } finally {
      server.close();
    }
    // The same port once closed: nothing listens any more.
    expect(await pingUrl(`http://127.0.0.1:${port}/`)).toMatchObject({ status: 'offline', statusText: 'Refusé' });
  });
});
