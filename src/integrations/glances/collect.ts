import { MonitoringConfigurationError, MonitoringHttpError, MonitoringInvalidResponseError } from '@/lib/monitoringError';
import { httpGet, type HttpAnswer } from '../http';
import { CollectError, type CollectResult, type DeviceCollector, type DeviceVitals, type Metric } from '../types';

/** Glances REST API (`/api/<version>/all`), optionally behind basic auth. */

interface GlancesResponse {
  sensors?: { label?: string; value?: number }[];
  cpu?: { total?: number };
  mem?: { percent?: number; total?: number };
  fs?: { mnt_point: string; size: number; percent: number }[];
  gpu?: { name?: string; proc?: number; temperature?: number }[];
  /** v4+: `bytes_*_rate_per_sec`; v2/v3: `rx` / `tx` bytes since the previous update. */
  network?: {
    interface_name?: string;
    bytes_recv_rate_per_sec?: number; bytes_sent_rate_per_sec?: number;
    rx?: number; tx?: number; time_since_update?: number;
  }[];
  load?: { min1?: number; min5?: number; min15?: number; cpucore?: number };
  /** "5 days, 3:04:05" or "3:04:05". */
  uptime?: string | number;
  core?: { log?: number; phys?: number };
}

const API_VERSIONS = ['/api/5/all', '/api/4/all', '/api/3/all', '/api/2/all'];
const IGNORED_MOUNTS = ['boot', 'efi', 'overlay', 'tmpfs', 'docker'];

/** Endpoints to try, newest API first; the one that answered is remembered. */
function candidateUrls(url: string, remembered?: string): string[] {
  if (remembered) return [remembered];
  const base = url.endsWith('/') ? url.slice(0, -1) : url;
  if (base.endsWith('/all')) return [base];
  const root = /\/api\/\d+$/.test(base) ? base.substring(0, base.lastIndexOf('/api/')) : base;
  return [...new Set(API_VERSIONS.map(endpoint => `${root}${endpoint}`))];
}

function basicAuth(token: string | undefined): string | undefined {
  if (!token || token.trim() === '' || token === ':') return undefined;
  return `Basic ${Buffer.from(token).toString('base64')}`;
}

export function glancesMetrics(data: GlancesResponse): Metric[] {
  const metrics: Metric[] = [];
  const sensors = Array.isArray(data.sensors) ? data.sensors : [];
  const sensor = (keywords: string[]) => sensors.find(candidate => keywords.some(keyword => candidate.label?.toLowerCase().includes(keyword)));
  const cpuSensor = sensor(['package', 'tctl', 'tdie']) || sensor(['core']) || sensor(['cpu']) || sensor(['acpitz']);
  const diskSensor = sensors.find(candidate => {
    const label = candidate.label?.toLowerCase() ?? '';
    return ['nvme', 'sda', 'disk', 'hdd', 'temp1'].some(keyword => label.includes(keyword)) && !['cpu', 'core'].some(keyword => label.includes(keyword));
  });
  const cpuTemp = typeof cpuSensor?.value === 'number' ? cpuSensor.value : undefined;
  const diskTemp = typeof diskSensor?.value === 'number' ? diskSensor.value : undefined;

  if (data.cpu?.total !== undefined) {
    metrics.push({ key: 'cpu.usage', kind: 'cpu', percent: data.cpu.total, ...(cpuTemp !== undefined ? { temperatureC: cpuTemp } : {}) });
  }
  if (data.mem?.percent !== undefined) {
    metrics.push({ key: 'memory.usage', kind: 'memory', percent: data.mem.percent, ...(data.mem.total ? { totalBytes: data.mem.total } : {}) });
  }
  if (Array.isArray(data.fs)) {
    // One entry per volume: bind mounts of the same size keep the shortest path.
    const volumes = new Map<number, { mnt_point: string; size: number; percent: number }>();
    for (const disk of data.fs) {
      if (!disk.mnt_point || !disk.size) continue;
      if (IGNORED_MOUNTS.some(keyword => disk.mnt_point.toLowerCase().includes(keyword))) continue;
      const existing = volumes.get(disk.size);
      if (!existing || disk.mnt_point.length < existing.mnt_point.length) volumes.set(disk.size, disk);
    }
    for (const disk of volumes.values()) {
      const name = disk.mnt_point === '/' ? '/' : disk.mnt_point.split('/').filter(Boolean).pop() || disk.mnt_point;
      metrics.push({
        key: `disk.usage:${disk.mnt_point}`, kind: 'disk', name, percent: disk.percent, totalBytes: disk.size,
        ...(diskTemp !== undefined ? { temperatureC: diskTemp } : {}),
      });
    }
  }
  if (Array.isArray(data.gpu)) {
    for (const gpu of data.gpu) {
      if (gpu.proc === undefined) continue;
      metrics.push({
        key: `gpu.usage:${gpu.name ?? metrics.length}`, kind: 'gpu', name: gpu.name || 'GPU', percent: gpu.proc,
        ...(typeof gpu.temperature === 'number' ? { temperatureC: gpu.temperature } : {}),
      });
    }
  }
  return metrics;
}

/** Virtual interfaces carry the same traffic again (or none that leaves the machine). */
const VIRTUAL_INTERFACE = /^(lo|docker|br-|veth|virbr|vnet|tun|tap|wg|tailscale|zt|cni|flannel|kube|lxc|vmbr\d+v)/i;

export function parseUptime(value: string | number | undefined): number | undefined {
  if (typeof value === 'number') return value;
  if (!value) return undefined;
  const match = /(?:(\d+)\s*days?,\s*)?(\d+):(\d{2}):(\d{2})/.exec(value);
  if (!match) return undefined;
  const [, days, hours, minutes, seconds] = match;
  return Number(days ?? 0) * 86_400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function glancesVitals(data: GlancesResponse): DeviceVitals {
  const vitals: DeviceVitals = {};
  const uptime = parseUptime(data.uptime);
  if (uptime !== undefined) vitals.uptimeSeconds = uptime;
  if (typeof data.load?.min1 === 'number') vitals.load = [data.load.min1, data.load.min5 ?? data.load.min1, data.load.min15 ?? data.load.min1];
  const cores = data.load?.cpucore ?? data.core?.log;
  if (typeof cores === 'number' && cores > 0) vitals.cores = cores;
  const interfaces = (Array.isArray(data.network) ? data.network : []).filter(item => item.interface_name && !VIRTUAL_INTERFACE.test(item.interface_name));
  if (interfaces.length) {
    let rx = 0, tx = 0, known = false;
    for (const item of interfaces) {
      if (typeof item.bytes_recv_rate_per_sec === 'number') {
        rx += item.bytes_recv_rate_per_sec; tx += item.bytes_sent_rate_per_sec ?? 0; known = true;
      } else if (typeof item.rx === 'number' && item.time_since_update) {
        rx += item.rx / item.time_since_update; tx += (item.tx ?? 0) / item.time_since_update; known = true;
      }
    }
    if (known) { vitals.netRxBps = Math.round(rx); vitals.netTxBps = Math.round(tx); }
  }
  return vitals;
}

export const collectGlances: DeviceCollector = async (connection, context) => {
  if (!connection.url) throw new CollectError('URL Glances manquante.', new MonitoringConfigurationError('URL Glances manquante.'));
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
  const auth = basicAuth(connection.token);
  if (auth) headers.Authorization = auth;

  let response: HttpAnswer | null = null;
  let lastError: unknown = null;
  let usedUrl = '';
  for (const url of candidateUrls(connection.url, context.memory.url)) {
    try {
      response = await httpGet(url, { headers, allowSelfSigned: connection.allowSelfSigned });
      if (response.ok) { usedUrl = url; context.memory.url = url; break; }
      if (response.status !== 404) { usedUrl = url; break; }
    } catch (error) {
      lastError = error;
    }
  }
  if (!response) throw new CollectError('Impossible de joindre Glances', lastError);
  if (!response.ok) {
    throw new CollectError(`Erreur serveur (${response.status})`, new MonitoringHttpError('Glances', response.status, response.statusText));
  }

  let data: GlancesResponse;
  try {
    data = JSON.parse(await response.text()) as GlancesResponse;
  } catch {
    throw new CollectError('Réponse invalide (HTML)', new MonitoringInvalidResponseError(`Réponse HTML reçue au lieu de JSON sur ${usedUrl}.`));
  }
  const result: CollectResult = { metrics: glancesMetrics(data), vitals: glancesVitals(data) };
  return result;
};
