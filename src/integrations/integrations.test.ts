import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '@/lib/types';
import { DEVICE_COLLECTORS } from './collectors';
import { beszelMetrics, beszelVitals } from './beszel/collect';
import beszelSystems from './beszel/samples/systems.json';
import { glancesMetrics, glancesVitals, parseUptime } from './glances/collect';
import { netdataMetrics, netdataVitals } from './netdata/collect';
import netdataServer from './netdata/samples/server.json';
import { prometheusMetrics, prometheusQueries, prometheusVitals } from './prometheus/collect';
import prometheusNode from './prometheus/samples/node.json';
import glancesNas from './glances/samples/nas.json';
import lhmGamingPc from './lhm/samples/gaming-pc.json';
import { lhmMetrics, lhmVitals } from './lhm/collect';
import { percentText, temperatureText, toReadings } from '@/components/widgets/deviceReadings';
import type { Metric } from './types';
import { proxmoxMetrics, proxmoxVitals } from './proxmox/collect';
import { DEVICE_INTEGRATION_IDS, DEVICE_INTEGRATIONS, getDeviceIntegration, selectableDeviceIntegrations } from './registry';
import { pollDevice } from './runtime';

vi.mock('@/lib/config', () => ({ readConfig: () => ({ devices: [] }) }));

const GIB = 1024 ** 3;

/** What the devices card shows for each metric, in French: [id, name, percent, temperature, capacity]. */
const shown = (metrics: Metric[]) => toReadings(metrics, 'fr').map(reading => [reading.id, reading.name, percentText(reading), temperatureText(reading), reading.capacity]);

describe('integration registry', () => {
  it('offers the monitoring catalogue, each with a collector', () => {
    expect(selectableDeviceIntegrations().map(integration => integration.id)).toEqual(['glances', 'netdata', 'beszel', 'prometheus', 'proxmox', 'lhm']);
    for (const integration of selectableDeviceIntegrations()) expect(DEVICE_COLLECTORS[integration.id], integration.id).toBeTypeOf('function');
    expect(Object.keys(DEVICE_COLLECTORS).every(id => DEVICE_INTEGRATION_IDS.includes(id))).toBe(true);
  });

  it('keeps legacy types valid', () => {
    expect(DEVICE_INTEGRATION_IDS).toEqual(expect.arrayContaining(['homeassistant', 'custom']));
    expect(getDeviceIntegration('homeassistant')?.selectable).toBe(false);
  });

  it('describes form fields with unique ids and valid conditions', () => {
    for (const integration of DEVICE_INTEGRATIONS) {
      const ids = integration.fields.map(field => field.id);
      expect(new Set(ids).size, integration.id).toBe(ids.length);
      for (const field of integration.fields) if (field.showWhen) expect(ids, integration.id).toContain(field.showWhen);
    }
  });
});

describe('connection endpoints', () => {
  it('builds the Glances URL and keeps the stored password when left empty', () => {
    const glances = getDeviceIntegration('glances')!;
    expect(glances.connect({ ip: '192.0.2.10', port: '61208' })).toEqual({ url: 'http://192.0.2.10:61208', token: undefined });
    expect(glances.connect({ ip: 'https://nas.example', port: '443', username: 'me', password: 'pw' }).token).toBe('me:pw');
    expect(glances.connect({ ip: '192.0.2.10', username: 'me', password: '' }, 'old:secret').token).toBe('me:secret');
  });

  it('builds Proxmox node and VM URLs', () => {
    const proxmox = getDeviceIntegration('proxmox')!;
    expect(proxmox.connect({ ip: '192.0.2.5', port: '8006', nodeName: 'pve', username: 'root@pam!t', password: 'uuid' }))
      .toEqual({ url: 'https://192.0.2.5:8006/api2/json/nodes/pve/status', token: 'root@pam!t=uuid' });
    expect(proxmox.connect({ ip: '192.0.2.5', nodeName: 'pve', vmid: '104', vmType: 'lxc', username: 'root@pam!t', password: '' }, 'root@pam!t=kept'))
      .toEqual({ url: 'https://192.0.2.5:8006/api2/json/nodes/pve/lxc/104/status/current', token: 'root@pam!t=kept' });
  });

  it('builds the LHM URL', () => {
    expect(getDeviceIntegration('lhm')!.connect({ ip: '192.0.2.7', port: '' })).toEqual({ url: 'http://192.0.2.7:9001/data.json' });
  });
});

describe('metrics', () => {
  it('reads Glances (same sample as `npm run fake:integrations`)', () => {
    const metrics = glancesMetrics(glancesNas);
    expect(metrics.map(metric => metric.key)).toEqual(['cpu.usage', 'memory.usage', 'disk.usage:/', 'disk.usage:/mnt/data', 'gpu.usage:RTX 4070']);
    expect(shown(metrics)).toEqual([
      ['CPU', 'CPU', '12%', '62°C', ''],
      ['RAM', 'RAM', '64%', '', '64 Go'],
      ['Disque (/)', '/', '40%', '40°C', '500 Go'],
      ['Disque (data)', 'data', '55%', '40°C', '2,0 To'],
      ['RTX 4070', 'RTX 4070', '7%', '50°C', ''],
    ]);
  });

  it('reads Proxmox, with node storage summed over pools', () => {
    expect(shown(proxmoxMetrics({ cpu: 1.2, memory: { used: 8 * GIB, total: 32 * GIB }, rootfs: { used: 1, total: 2 } }, { used: 3000 * GIB, total: 4000 * GIB }))).toEqual([
      ['CPU', 'CPU', '100%', '', ''],
      ['RAM', 'RAM', '25%', '', '32 Go'],
      ['Disque (Local)', 'Local', '75%', '', '4,0 To'],
    ]);
    expect(proxmoxMetrics({})).toEqual([]);
  });

  it('reads the LHM sensor tree (same sample as `npm run fake:integrations`)', () => {
    expect(shown(lhmMetrics(lhmGamingPc))).toEqual([
      ['CPU', 'CPU', '23%', '55°C', ''],
      ['RAM', 'RAM', '50%', '', '16 Go'],
      ['Disque (Samsung SSD 980)', 'Samsung SSD 980', '30%', '', '932 Go'],
      ['GeForce RTX 3080', 'GeForce RTX 3080', '10%', '45°C', ''],
    ]);
  });
});

describe('polling', () => {
  afterEach(() => vi.unstubAllGlobals());

  const device = (api: Device['api']): Device => ({ id: `d-${Math.random()}`, name: 'NAS', host: '', icon: '🖥️', api });

  it('falls back to the newest Glances API that answers', async () => {
    const fetchMock = vi.fn(async (url: string) => url.includes('/api/5/')
      ? new Response('', { status: 404 })
      : new Response(JSON.stringify({ cpu: { total: 5 } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const status = await pollDevice(device({ type: 'glances', url: 'http://192.0.2.10:61208' }));
    expect(status).toMatchObject({ online: true, metrics: [{ key: 'cpu.usage', kind: 'cpu', percent: 5 }] });
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(['http://192.0.2.10:61208/api/5/all', 'http://192.0.2.10:61208/api/4/all']);
  });

  it('reports failures on the card', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 })));
    expect(await pollDevice(device({ type: 'glances', url: 'http://192.0.2.10' }))).toMatchObject({ online: false, error: 'Réponse invalide (HTML)' });
    expect(await pollDevice(device({ type: 'glances', url: '' }))).toMatchObject({ online: false, error: 'URL Glances manquante.' });
  });

  it('shows static stats without an integration', async () => {
    const stats = [{ label: 'CPU', value: '1%' }];
    expect(await pollDevice({ ...device(undefined), stats })).toMatchObject({ online: true, stats });
    expect(await pollDevice({ ...device({ type: 'homeassistant', url: 'http://x' }), stats })).toMatchObject({ online: true, stats });
  });
});

describe('self-signed certificates', () => {
  it('rejects an untrusted certificate unless the device accepts it', async () => {
    const { spawnSync } = await import('node:child_process');
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const https = await import('node:https');
    const { httpGet } = await import('./http');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-cert-'));
    const made = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1',
      '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem')], { stdio: 'ignore' });
    if (made.status !== 0) return; // openssl not installed: nothing to prove here
    const server = https.createServer({ key: fs.readFileSync(path.join(dir, 'key.pem')), cert: fs.readFileSync(path.join(dir, 'cert.pem')) }, (_req, res) => res.end('ok'));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    try {
      await expect(httpGet(`https://127.0.0.1:${port}/`)).rejects.toThrow();
      const answer = await httpGet(`https://127.0.0.1:${port}/`, { allowSelfSigned: true });
      expect(answer.ok).toBe(true);
      expect(await answer.text()).toBe('ok');
    } finally {
      server.close();
    }
  });
});

describe('certificate failures', () => {
  it('recognises an untrusted certificate behind wrapped errors', async () => {
    const { isCertificateError } = await import('./runtime');
    const tls = Object.assign(new Error('self-signed certificate'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
    expect(isCertificateError(new TypeError('fetch failed', { cause: tls }))).toBe(true);
    expect(isCertificateError(Object.assign(new Error('x'), { reason: tls }))).toBe(true);
    expect(isCertificateError(new Error('ECONNREFUSED'))).toBe(false);
  });
});

describe('catalogue integrations (samples from their documented APIs)', () => {
  it('reads Netdata allmetrics', () => {
    expect(shown(netdataMetrics(netdataServer))).toEqual([
      ['CPU', 'CPU', '19%', '54°C', ''],
      ['RAM', 'RAM', '50%', '', '8 Go / 16 Go'],
      ['Disque (/)', '/', '24%', '', '60 Go / 250 Go'],
      ['Disque (data)', 'data', '66%', '', '2,4 To / 3,6 To'],
    ]);
  });

  it('reads one Beszel system by name', () => {
    const nas = beszelSystems.items.find(system => system.name === 'nas')!;
    expect(shown(beszelMetrics(nas))).toEqual([
      ['CPU', 'CPU', '17%', '48°C', ''],
      ['RAM', 'RAM', '41%', '', ''],
      ['Disque (system)', 'system', '63%', '', ''],
      ['Disque (data)', 'data', '72%', '', ''],
    ]);
  });

  it('reads node_exporter through Prometheus', () => {
    expect(shown(prometheusMetrics(prometheusNode as never))).toEqual([
      ['CPU', 'CPU', '21%', '46°C', ''],
      ['RAM', 'RAM', '40%', '', '13 Go / 31 Go'],
      ['Disque (/)', '/', '30%', '', '140 Go / 466 Go'],
      ['Disque (storage)', 'storage', '70%', '', '5,2 To / 7,5 To'],
    ]);
    // The instance label cannot break out of its quotes.
    expect(prometheusQueries('a"}or vector(1)').cpu).toContain('instance="a\\"}or vector(1)"');
  });
});

describe('device vitals', () => {
  it('reads uptime, load and network from each source', () => {
    expect(parseUptime('12 days, 4:05:06')).toBe(12 * 86_400 + 4 * 3600 + 5 * 60 + 6);
    expect(parseUptime('3:00:01')).toBe(10_801);
    // Loopback and docker bridges are left out.
    expect(glancesVitals(glancesNas)).toEqual({ uptimeSeconds: 1_051_506, load: [0.82, 0.74, 0.66], cores: 8, netRxBps: 2_450_000, netTxBps: 830_000 });
    expect(beszelVitals(beszelSystems.items[0])).toEqual({ uptimeSeconds: 864_000, load: [0.4, 0.5, 0.6], cores: 8, netTotalBps: 125_000 });
    expect(netdataVitals(netdataServer)).toEqual({ uptimeSeconds: 1_045_230, load: [1.12, 0.98, 0.87], netRxBps: 2_450_063, netTxBps: 830_025 });
    expect(prometheusVitals(prometheusNode as never)).toEqual({ uptimeSeconds: 1_045_230, load: [0.82, 0.74, 0.66], cores: 8, netRxBps: 2_450_001, netTxBps: 830_000 });
    // Virtual adapters (WSL) are left out.
    expect(lhmVitals(lhmGamingPc)).toEqual({ netRxBps: Math.round(2.3 * 1024 ** 2), netTxBps: Math.round(812.5 * 1024) });
  });

  it('turns Proxmox guest counters into a throughput between two polls', () => {
    const memory: Record<string, string> = {};
    expect(proxmoxVitals({ uptime: 3600, cpus: 4, netin: 1_000_000, netout: 500_000 }, memory, 1_000_000)).toEqual({ uptimeSeconds: 3600, cores: 4 });
    expect(proxmoxVitals({ uptime: 3610, cpus: 4, netin: 1_100_000, netout: 520_000 }, memory, 1_010_000)).toMatchObject({ netRxBps: 10_000, netTxBps: 2_000 });
    // A guest restart resets its counters: no negative rate.
    expect(proxmoxVitals({ uptime: 5, netin: 10, netout: 10 }, memory, 1_020_000).netRxBps).toBeUndefined();
    expect(proxmoxVitals({ uptime: 3600, loadavg: ['0.52', '0.48', '0.40'], cpuinfo: { cpus: 16 } }, {}, 0)).toEqual({ uptimeSeconds: 3600, load: [0.52, 0.48, 0.4], cores: 16 });
  });
});
