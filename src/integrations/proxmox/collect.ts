import https from 'https';
import { MonitoringConfigurationError, MonitoringHttpError, MonitoringInvalidResponseError } from '@/lib/monitoringError';
import { CollectError, type CollectContext, type DeviceCollector, type DeviceVitals, type Metric, type SourceTarget, type TargetLister } from '../types';

/**
 * Proxmox VE API with an API token: a node (`…/nodes/<node>/status`, storage
 * summed over its pools) or one VM/LXC (`…/<qemu|lxc>/<vmid>/status/current`).
 */

interface ProxmoxResponse {
  cpu?: number;
  memory?: { used?: number; total?: number };
  mem?: number;
  maxmem?: number;
  rootfs?: { used?: number; total?: number };
  disk?: number;
  maxdisk?: number;
  used?: number;
  total?: number;
  uptime?: number;
  /** Node: `["0.52", "0.48", "0.40"]`. */
  loadavg?: (string | number)[];
  cpuinfo?: { cpus?: number };
  /** VM/LXC: CPU count and cumulative network bytes since it started. */
  cpus?: number;
  netin?: number;
  netout?: number;
}

function request<T>(urlText: string, token: string, allowSelfSigned: boolean): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlText);
    const req = https.request({
      hostname: url.hostname,
      port: url.port || 8006,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { Authorization: `PVEAPIToken=${token}`, Accept: 'application/json' },
      timeout: 4000,
      // Proxmox ships a self-signed certificate; checked unless the device says otherwise.
      rejectUnauthorized: !allowSelfSigned,
    }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new MonitoringHttpError('Proxmox', response.statusCode || 500, response.statusMessage));
          return;
        }
        try {
          // Proxmox nests every answer under `data`.
          resolve((JSON.parse(body) as { data: T }).data);
        } catch {
          reject(new MonitoringInvalidResponseError('Réponse JSON Proxmox invalide.'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

export function proxmoxMetrics(data: ProxmoxResponse, storage?: { used: number; total: number }): Metric[] {
  const metrics: Metric[] = [];
  if (data.cpu !== undefined && !Number.isNaN(data.cpu * 100)) {
    metrics.push({ key: 'cpu.usage', kind: 'cpu', percent: data.cpu * 100 });
  }
  const memUsed = data.memory?.used || data.mem;
  const memTotal = data.memory?.total || data.maxmem;
  if (memUsed && memTotal) {
    metrics.push({ key: 'memory.usage', kind: 'memory', percent: (memUsed / memTotal) * 100, totalBytes: memTotal });
  }
  const diskUsed = storage?.used ?? (data.rootfs?.used || data.disk);
  const diskTotal = storage?.total ?? (data.rootfs?.total || data.maxdisk);
  if (diskUsed && diskTotal) {
    metrics.push({ key: 'disk.usage:local', kind: 'disk', name: 'Local', percent: (diskUsed / diskTotal) * 100, totalBytes: diskTotal });
  }
  return metrics;
}

/**
 * Uptime, load (node) and network throughput (VM/LXC: from the cumulative
 * counters of two polls, kept in the device memory).
 */
export function proxmoxVitals(data: ProxmoxResponse, memory: CollectContext['memory'], now = Date.now()): DeviceVitals {
  const vitals: DeviceVitals = {};
  if (typeof data.uptime === 'number' && data.uptime > 0) vitals.uptimeSeconds = data.uptime;
  const load = (data.loadavg ?? []).map(Number).filter(Number.isFinite);
  if (load.length) vitals.load = load.slice(0, 3);
  const cores = data.cpuinfo?.cpus ?? data.cpus;
  if (typeof cores === 'number' && cores > 0) vitals.cores = cores;
  if (typeof data.netin === 'number' && typeof data.netout === 'number') {
    const previous = { at: Number(memory.netAt), rx: Number(memory.netIn), tx: Number(memory.netOut) };
    const seconds = (now - previous.at) / 1000;
    // Counters restart with the VM: a drop means a restart, not a negative rate.
    if (seconds > 0 && seconds < 600 && data.netin >= previous.rx && data.netout >= previous.tx) {
      vitals.netRxBps = Math.round((data.netin - previous.rx) / seconds);
      vitals.netTxBps = Math.round((data.netout - previous.tx) / seconds);
    }
    memory.netAt = String(now);
    memory.netIn = String(data.netin);
    memory.netOut = String(data.netout);
  }
  return vitals;
}

export const collectProxmox: DeviceCollector = async (connection, context) => {
  if (!connection.url || !connection.token) {
    throw new CollectError('URL ou Token manquant.', new MonitoringConfigurationError('URL ou jeton Proxmox manquant.'));
  }
  let data: ProxmoxResponse;
  try {
    data = await request<ProxmoxResponse>(connection.url, connection.token, connection.allowSelfSigned === true);
  } catch (error) {
    throw new CollectError((error instanceof Error && error.message) || 'Impossible de joindre Proxmox', error);
  }

  // A whole node reports the sum of its storage pools.
  let storage: { used: number; total: number } | undefined;
  if (!connection.vmid && connection.url.endsWith('/status')) {
    try {
      const pools = await request<ProxmoxResponse[]>(connection.url.replace('/status', '/storage'), connection.token, connection.allowSelfSigned === true);
      if (Array.isArray(pools) && pools.length > 0) {
        const total = pools.reduce((sum, pool) => sum + (pool.total || 0), 0);
        if (total > 0) storage = { used: pools.reduce((sum, pool) => sum + (pool.used || 0), 0), total };
      }
      context.clearWarning('Proxmox Storage');
    } catch (error) {
      context.warn('Proxmox Storage', error);
    }
  }

  const metrics = proxmoxMetrics(data, storage);
  if (metrics.length === 0) throw new CollectError('VM arrêtée ou aucune stat.', undefined, true);
  return { metrics, vitals: proxmoxVitals(data, context.memory) };
};

/** The nodes of the cluster and their VMs / containers, to pick one per device. */
export const listProxmoxTargets: TargetLister = async connection => {
  if (!connection.url || !connection.token) throw new CollectError('URL ou Token manquant.', new MonitoringConfigurationError('URL ou jeton Proxmox manquant.'));
  const base = connection.url.slice(0, connection.url.indexOf('/api2/json') + '/api2/json'.length);
  const self = connection.allowSelfSigned === true;
  try {
    const nodes = await request<Array<{ node?: string; status?: string }>>(`${base}/nodes`, connection.token, self);
    const targets: SourceTarget[] = [];
    for (const node of nodes.filter(item => item.node)) {
      targets.push({ values: { nodeName: node.node! }, label: node.node!, ...(node.status ? { detail: node.status } : {}) });
      for (const kind of ['qemu', 'lxc'] as const) {
        try {
          const guests = await request<Array<{ vmid?: number; name?: string; status?: string }>>(`${base}/nodes/${node.node}/${kind}`, connection.token, self);
          for (const guest of guests.filter(item => item.vmid !== undefined)) {
            targets.push({
              values: { nodeName: node.node!, vmid: String(guest.vmid), vmType: kind },
              label: guest.name || `${kind === 'qemu' ? 'VM' : 'LXC'} ${guest.vmid}`,
              detail: [node.node, kind === 'qemu' ? 'VM' : 'LXC', guest.vmid, guest.status].filter(Boolean).join(' · '),
            });
          }
        } catch {
          // A token may see the node but not its guests: the node stays offered.
        }
      }
    }
    return targets;
  } catch (error) {
    throw new CollectError((error instanceof Error && error.message) || 'Impossible de joindre Proxmox', error);
  }
};
