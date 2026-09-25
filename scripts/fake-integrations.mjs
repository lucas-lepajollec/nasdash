#!/usr/bin/env node
/**
 * Fake monitoring servers for trying integrations without installing them.
 * Each one answers like the real API, from the sample files in
 * `src/integrations/<id>/samples/`, with values that move a little on every
 * request so graphs are alive. Local only (127.0.0.1), fictional data.
 *
 *   npm run fake:integrations
 *
 * Then add a device in NasDash with IP 127.0.0.1 and one of the ports below.
 */
import http from 'node:http';
import https from 'node:https';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', 'src', 'integrations');
const sample = (id, name) => JSON.parse(readFileSync(join(root, id, 'samples', `${name}.json`), 'utf8'));
const wobble = (value, spread = 6) => Math.max(0, Math.min(100, value + (Math.random() - 0.5) * spread));

/** Glances: newest API first, like a real Glances 4 (`/api/5` answers 404). */
function glances(data) {
  return (req, res) => {
    if (req.url !== '/api/4/all') return send(res, 404, 'Not found', 'text/plain');
    const live = structuredClone(data);
    live.cpu.total = wobble(live.cpu.total);
    live.mem.percent = wobble(live.mem.percent, 1);
    send(res, 200, JSON.stringify(live));
  };
}

/** Libre Hardware Monitor web server: one JSON tree at `/data.json`. */
function lhm(data) {
  return (req, res) => req.url === '/data.json' ? send(res, 200, JSON.stringify(data)) : send(res, 404, 'Not found', 'text/plain');
}

/**
 * Docker Engine API (enough for the container list, images and volumes).
 * Podman's Docker-compatible API answers the same way.
 */
function docker(containers) {
  return (req, res) => {
    const path = (req.url ?? '').split('?')[0];
    if (path === '/containers/json') return send(res, 200, JSON.stringify(containers));
    if (path === '/images/json') return send(res, 200, '[]');
    if (path === '/volumes') return send(res, 200, JSON.stringify({ Volumes: [], Warnings: null }));
    send(res, 404, JSON.stringify({ message: 'page not found' }));
  };
}

/** Netdata Agent: every chart at once. */
function netdata(data) {
  return (req, res) => {
    if (!(req.url ?? '').startsWith('/api/v1/allmetrics')) return send(res, 404, 'Not found', 'text/plain');
    const live = structuredClone(data);
    live['system.cpu'].dimensions.user.value = wobble(live['system.cpu'].dimensions.user.value);
    send(res, 200, JSON.stringify(live));
  };
}

/** Beszel hub: login with nasdash@example.com / fake-password, then the systems list. */
function beszel(data) {
  const token = 'fake-beszel-token';
  return (req, res) => {
    const path = (req.url ?? '').split('?')[0];
    if (req.method === 'POST' && path.endsWith('/auth-with-password')) {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const { identity, password } = JSON.parse(body || '{}');
        if (identity === 'nasdash@example.com' && password === 'fake-password') send(res, 200, JSON.stringify({ token, record: { id: 'u1' } }));
        else send(res, 400, JSON.stringify({ message: 'Failed to authenticate.' }));
      });
      return;
    }
    if (path === '/api/collections/systems/records') {
      if (req.headers.authorization !== token) return send(res, 401, JSON.stringify({ message: 'Unauthorized' }));
      const live = structuredClone(data);
      live.items[0].info.cpu = wobble(live.items[0].info.cpu);
      return send(res, 200, JSON.stringify(live));
    }
    send(res, 404, JSON.stringify({ message: 'Not found' }));
  };
}

/** Prometheus: answers each node_exporter query of the collector (instance 192.0.2.10:9100). */
function prometheus(data) {
  // Most specific needles first (the cores query also names node_cpu_seconds_total).
  const byQuery = [
    ['count(node_cpu_seconds_total', 'cores'], ['node_network_receive', 'netRx'], ['node_network_transmit', 'netTx'],
    ['node_load15', 'load15'], ['node_load5', 'load5'], ['node_load1', 'load1'], ['node_boot_time_seconds', 'uptime'],
    ['node_cpu_seconds_total', 'cpu'], ['MemTotal', 'memoryTotal'], ['MemAvailable', 'memoryAvailable'],
    ['node_filesystem_size_bytes', 'fsSize'], ['node_filesystem_avail_bytes', 'fsAvail'], ['node_hwmon_temp_celsius', 'temperature'],
  ];
  return (req, res) => {
    const url = new URL(req.url ?? '/', 'http://fake');
    if (url.pathname !== '/api/v1/query') return send(res, 404, 'Not found', 'text/plain');
    const query = url.searchParams.get('query') ?? '';
    const known = query.includes('instance="192.0.2.10:9100"');
    const name = byQuery.find(([needle]) => query.includes(needle))?.[1];
    const result = known && name ? structuredClone(data[name]) : [];
    if (name === 'cpu' && result[0]) result[0].value[1] = String(wobble(Number(result[0].value[1])));
    send(res, 200, JSON.stringify({ status: 'success', data: { resultType: 'vector', result } }));
  };
}

/** Headscale: node list with the API key "fake-headscale-key". */
function headscale(data) {
  return (req, res) => {
    if ((req.url ?? '').split('?')[0] !== '/api/v1/node') return send(res, 404, JSON.stringify({ message: 'Not Found' }));
    if (req.headers.authorization !== 'Bearer fake-headscale-key') return send(res, 401, 'Unauthorized', 'text/plain');
    send(res, 200, JSON.stringify(data));
  };
}

/** Portainer: relays the Docker API of environment 1 (API key "fake-portainer-key"). */
function portainer(containers) {
  const engine = docker(containers);
  return (req, res) => {
    if (req.headers['x-api-key'] !== 'fake-portainer-key') return send(res, 401, JSON.stringify({ message: 'Unauthorized' }));
    const prefix = '/api/endpoints/1/docker';
    if (!(req.url ?? '').startsWith(prefix)) return send(res, 404, JSON.stringify({ message: 'Environment not found' }));
    req.url = req.url.slice(prefix.length) || '/';
    engine(req, res);
  };
}

/** Dockhand: its own API, environment 1, token "dh_fake-dockhand-token". */
function dockhand(containers) {
  return (req, res) => {
    if (req.headers.authorization !== 'Bearer dh_fake-dockhand-token') return send(res, 401, JSON.stringify({ error: 'Unauthorized' }));
    const url = new URL(req.url ?? '/', 'http://fake');
    if (url.searchParams.get('env') !== '1') return send(res, 404, JSON.stringify({ error: 'Environment not found' }));
    if (url.pathname === '/api/containers') return send(res, 200, JSON.stringify(containers));
    if (url.pathname === '/api/images') return send(res, 200, '[]');
    if (url.pathname === '/api/volumes') return send(res, 200, '[]');
    send(res, 404, JSON.stringify({ error: 'Not found' }));
  };
}

/** A server that answers HTML instead of JSON (wrong port, login page…). */
const html = (_req, res) => send(res, 200, '<html><body>Login</body></html>', 'text/html');

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

const servers = [
  { port: 2611, name: 'Glances — healthy NAS', handler: glances(sample('glances', 'nas')) },
  { port: 2612, name: 'Libre Hardware Monitor — gaming PC', handler: lhm(sample('lhm', 'gaming-pc')) },
  { port: 2614, name: 'Docker Engine — 2 containers (host "127.0.0.1", port 2614)', handler: docker(sample('docker', 'containers').concat()) },
  { port: 2615, name: 'Netdata — server', handler: netdata(sample('netdata', 'server')) },
  { port: 2616, name: 'Beszel — system "nas" (nasdash@example.com / fake-password)', handler: beszel(sample('beszel', 'systems')) },
  { port: 2617, name: 'Prometheus — instance "192.0.2.10:9100"', handler: prometheus(sample('prometheus', 'node')) },
  { port: 2620, name: 'Headscale — API key "fake-headscale-key" (Tailscale widget settings)', handler: headscale(sample('headscale', 'nodes')) },
  { port: 2621, name: 'Portainer — environment 1, API key "fake-portainer-key"', handler: portainer(sample('docker', 'containers')) },
  { port: 2622, name: 'Dockhand — environment 1, token "dh_fake-dockhand-token"', handler: dockhand(sample('docker', 'dockhand-containers')) },
  { port: 2619, name: 'Error case — HTML instead of JSON (use with Glances)', handler: html },
];

/** The same fake Docker engine on a Unix socket ("Unix socket" connection). */
const socketDir = mkdtempSync(join(tmpdir(), 'nasdash-docker-'));
const socketPath = join(socketDir, 'docker.sock');
http.createServer(docker(sample('docker', 'containers'))).listen(socketPath, () => console.log(`  ${socketPath}  Docker Engine on a Unix socket`));

for (const { port, name, handler } of servers) {
  http.createServer(handler).listen(port, '127.0.0.1', () => console.log(`  127.0.0.1:${port}  ${name}`));
}

/**
 * Glances over HTTPS with a throwaway self-signed certificate (created with
 * openssl in a temp folder at each start): works only with "Accept a
 * self-signed certificate" enabled on the device, like a default Proxmox.
 */
const certDir = mkdtempSync(join(tmpdir(), 'nasdash-fake-'));
const openssl = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1',
  '-keyout', join(certDir, 'key.pem'), '-out', join(certDir, 'cert.pem')], { stdio: 'ignore' });
if (openssl.status === 0) {
  https.createServer({ key: readFileSync(join(certDir, 'key.pem')), cert: readFileSync(join(certDir, 'cert.pem')) }, glances(sample('glances', 'nas')))
    .listen(2613, '127.0.0.1', () => console.log('  https://127.0.0.1:2613  Glances over HTTPS, self-signed certificate'));
} else {
  console.log('  (openssl not found: the self-signed HTTPS case on 2613 is skipped)');
}
console.log('Fake integrations (fictional data). Nothing listening on 2618 = "unreachable" case. Ctrl+C to stop.');
