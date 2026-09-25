import { MonitoringConfigurationError, MonitoringHttpError, MonitoringInvalidResponseError } from '@/lib/monitoringError';
import { basicAuthHeader, httpGet } from '../http';
import { CollectError, type DeviceCollector, type DeviceVitals, type Metric } from '../types';

/**
 * Netdata Agent: every chart's latest values in one call,
 * `GET /api/v1/allmetrics?format=json` → `{ "<chart>": { units, family, dimensions: { <dim>: { value } } } }`.
 * Used charts: `system.cpu` (%, summed over dimensions), `system.ram` (MiB),
 * `disk_space.*` (GiB, one per mount point), `sensors.*` in °C for the CPU temperature,
 * `system.net` (kilobits/s, sent negative), `system.load` and `system.uptime` (s).
 */

interface NetdataChart {
  name?: string;
  family?: string;
  units?: string;
  dimensions?: Record<string, { name?: string; value?: number | null }>;
}

const MIB = 1024 ** 2;
const GIB = 1024 ** 3;
const IGNORED_MOUNTS = ['/boot', '/efi', '/snap', '/run', '/dev', '/sys', '/proc', 'docker', 'overlay'];

const value = (chart: NetdataChart | undefined, dimension: string) => {
  const found = chart?.dimensions?.[dimension]?.value;
  return typeof found === 'number' ? Math.abs(found) : undefined;
};

export function netdataMetrics(charts: Record<string, NetdataChart>): Metric[] {
  const metrics: Metric[] = [];

  const cpuTempChart = Object.entries(charts).find(([id, chart]) => id.startsWith('sensors.') && /celsius/i.test(chart.units ?? '') && /(coretemp|k10temp|cpu|package|tctl)/i.test(`${id} ${chart.family ?? ''}`))?.[1];
  const cpuTemps = Object.values(cpuTempChart?.dimensions ?? {}).map(dimension => dimension.value).filter((temp): temp is number => typeof temp === 'number');
  const cpu = charts['system.cpu'];
  if (cpu?.dimensions) {
    const total = Object.values(cpu.dimensions).reduce((sum, dimension) => sum + (typeof dimension.value === 'number' ? dimension.value : 0), 0);
    metrics.push({ key: 'cpu.usage', kind: 'cpu', percent: total, ...(cpuTemps.length ? { temperatureC: Math.max(...cpuTemps) } : {}) });
  }

  const ram = charts['system.ram'];
  const used = value(ram, 'used');
  if (ram && used !== undefined) {
    const total = ['free', 'used', 'cached', 'buffers'].reduce((sum, dimension) => sum + (value(ram, dimension) ?? 0), 0);
    if (total > 0) metrics.push({ key: 'memory.usage', kind: 'memory', percent: (used / total) * 100, usedBytes: used * MIB, totalBytes: total * MIB });
  }

  for (const [id, chart] of Object.entries(charts)) {
    if (!id.startsWith('disk_space.')) continue;
    const mount = chart.family || id.slice('disk_space.'.length).replace(/_/g, '/');
    if (mount !== '/' && IGNORED_MOUNTS.some(ignored => mount.includes(ignored))) continue;
    const diskUsed = value(chart, 'used');
    const avail = value(chart, 'avail');
    if (diskUsed === undefined || avail === undefined) continue;
    const total = diskUsed + avail + (value(chart, 'reserved_for_root') ?? 0);
    if (!total) continue;
    const name = mount === '/' ? '/' : mount.split('/').filter(Boolean).pop() || mount;
    metrics.push({ key: `disk.usage:${mount}`, kind: 'disk', name, percent: (diskUsed / total) * 100, usedBytes: diskUsed * GIB, totalBytes: total * GIB });
  }
  return metrics;
}

export function netdataVitals(charts: Record<string, NetdataChart>): DeviceVitals {
  const vitals: DeviceVitals = {};
  const uptime = value(charts['system.uptime'], 'uptime');
  if (uptime !== undefined) vitals.uptimeSeconds = Math.round(uptime);
  const load = charts['system.load'];
  const load1 = value(load, 'load1');
  if (load1 !== undefined) vitals.load = [load1, value(load, 'load5') ?? load1, value(load, 'load15') ?? load1];
  const net = charts['system.net'];
  const received = value(net, 'received'), sent = value(net, 'sent');
  // Kilobits per second → bytes per second.
  if (received !== undefined) vitals.netRxBps = Math.round((received * 1000) / 8);
  if (sent !== undefined) vitals.netTxBps = Math.round((sent * 1000) / 8);
  return vitals;
}

export const collectNetdata: DeviceCollector = async connection => {
  if (!connection.url) throw new CollectError('URL Netdata manquante.', new MonitoringConfigurationError('URL Netdata manquante.'));
  const url = `${connection.url.replace(/\/$/, '')}/api/v1/allmetrics?format=json&help=no&types=no&timestamps=no&names=yes&data=average`;
  let answer;
  try {
    answer = await httpGet(url, { headers: { Accept: 'application/json', ...basicAuthHeader(connection.token) }, allowSelfSigned: connection.allowSelfSigned });
  } catch (error) {
    throw new CollectError('Impossible de joindre Netdata', error);
  }
  if (!answer.ok) throw new CollectError(`Erreur serveur (${answer.status})`, new MonitoringHttpError('Netdata', answer.status, answer.statusText));
  let charts: Record<string, NetdataChart>;
  try {
    charts = JSON.parse(await answer.text()) as Record<string, NetdataChart>;
  } catch {
    throw new CollectError('Réponse invalide (HTML)', new MonitoringInvalidResponseError(`Réponse non JSON sur ${url}.`));
  }
  return { metrics: netdataMetrics(charts), vitals: netdataVitals(charts) };
};
