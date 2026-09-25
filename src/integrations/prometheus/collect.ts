import { MonitoringConfigurationError, MonitoringHttpError, MonitoringInvalidResponseError } from '@/lib/monitoringError';
import { splitUserPassword } from '../connect';
import { basicAuthHeader, httpGet } from '../http';
import { CollectError, type DeviceCollector, type DeviceVitals, type Metric } from '../types';

/**
 * Prometheus HTTP API, instant queries on node_exporter metrics:
 * `GET /api/v1/query?query=<PromQL>` → `{ status: "success", data: { resultType: "vector", result: [{ metric, value: [time, "number"] }] } }`.
 */

interface Sample { metric: Record<string, string>; value: [number, string] }

/** Keeps a label value inside its quotes. */
const label = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const IGNORED_FS = 'tmpfs|overlay|squashfs|ramfs|devtmpfs|nsfs|fuse.lxcfs|autofs|proc|sysfs';

export function prometheusQueries(instance: string) {
  const i = `instance="${label(instance)}"`;
  return {
    cpu: `100 * (1 - avg(rate(node_cpu_seconds_total{${i},mode="idle"}[2m])))`,
    memoryTotal: `node_memory_MemTotal_bytes{${i}}`,
    memoryAvailable: `node_memory_MemAvailable_bytes{${i}}`,
    fsSize: `node_filesystem_size_bytes{${i},fstype!~"${IGNORED_FS}"}`,
    fsAvail: `node_filesystem_avail_bytes{${i},fstype!~"${IGNORED_FS}"}`,
    temperature: `max(node_hwmon_temp_celsius{${i}})`,
    cores: `count(node_cpu_seconds_total{${i},mode="idle"})`,
    netRx: `sum(rate(node_network_receive_bytes_total{${i},device!~"${VIRTUAL_DEVICES}"}[2m]))`,
    netTx: `sum(rate(node_network_transmit_bytes_total{${i},device!~"${VIRTUAL_DEVICES}"}[2m]))`,
    load1: `node_load1{${i}}`,
    load5: `node_load5{${i}}`,
    load15: `node_load15{${i}}`,
    uptime: `node_time_seconds{${i}} - node_boot_time_seconds{${i}}`,
  };
}

/** Interfaces that repeat traffic already counted (loopback, bridges, VPNs, containers). */
const VIRTUAL_DEVICES = 'lo|docker.*|br-.*|veth.*|virbr.*|vnet.*|tun.*|tap.*|wg.*|tailscale.*|zt.*|cni.*|flannel.*|kube.*|lxc.*';

type Query = keyof ReturnType<typeof prometheusQueries>;
/** The gauges are required; vitals are optional (older samples and exporters lack them). */
type Results = Record<'cpu' | 'memoryTotal' | 'memoryAvailable' | 'fsSize' | 'fsAvail' | 'temperature', Sample[]> & Partial<Record<Query, Sample[]>>;

const first = (samples: Sample[]) => samples.length ? Number(samples[0].value[1]) : undefined;

export function prometheusMetrics(results: Results): Metric[] {
  const metrics: Metric[] = [];
  const temperature = first(results.temperature);
  const cpu = first(results.cpu);
  if (cpu !== undefined && Number.isFinite(cpu)) metrics.push({ key: 'cpu.usage', kind: 'cpu', percent: cpu, ...(temperature !== undefined && Number.isFinite(temperature) ? { temperatureC: temperature } : {}) });
  const total = first(results.memoryTotal);
  const available = first(results.memoryAvailable);
  if (total && available !== undefined) metrics.push({ key: 'memory.usage', kind: 'memory', percent: (1 - available / total) * 100, usedBytes: total - available, totalBytes: total });
  // One entry per device: bind mounts of the same disk keep the shortest mount point.
  const byDevice = new Map<string, { mount: string; size: number; avail: number }>();
  for (const sample of results.fsSize) {
    const mount = sample.metric.mountpoint ?? '';
    const size = Number(sample.value[1]);
    const avail = Number(results.fsAvail.find(candidate => candidate.metric.mountpoint === mount)?.value[1]);
    if (!mount || !size || !Number.isFinite(avail) || mount.startsWith('/boot') || mount.startsWith('/run')) continue;
    const device = sample.metric.device ?? mount;
    const existing = byDevice.get(device);
    if (!existing || mount.length < existing.mount.length) byDevice.set(device, { mount, size, avail });
  }
  for (const { mount, size, avail } of byDevice.values()) {
    const name = mount === '/' ? '/' : mount.split('/').filter(Boolean).pop() || mount;
    metrics.push({ key: `disk.usage:${mount}`, kind: 'disk', name, percent: ((size - avail) / size) * 100, usedBytes: size - avail, totalBytes: size });
  }
  return metrics;
}

export function prometheusVitals(results: Results): DeviceVitals {
  const vitals: DeviceVitals = {};
  const read = (samples: Sample[] | undefined) => {
    const found = samples ? first(samples) : undefined;
    return found !== undefined && Number.isFinite(found) ? found : undefined;
  };
  const uptime = read(results.uptime);
  if (uptime !== undefined) vitals.uptimeSeconds = Math.round(uptime);
  const load1 = read(results.load1);
  if (load1 !== undefined) vitals.load = [load1, read(results.load5) ?? load1, read(results.load15) ?? load1];
  const cores = read(results.cores);
  if (cores) vitals.cores = cores;
  const rx = read(results.netRx), tx = read(results.netTx);
  if (rx !== undefined) vitals.netRxBps = Math.round(rx);
  if (tx !== undefined) vitals.netTxBps = Math.round(tx);
  return vitals;
}

export const collectPrometheus: DeviceCollector = async connection => {
  if (!connection.url) throw new CollectError('URL Prometheus manquante.', new MonitoringConfigurationError('URL Prometheus manquante.'));
  if (!connection.target) throw new CollectError('Instance Prometheus non choisie.', new MonitoringConfigurationError('Instance Prometheus non choisie.'));
  const { username, password } = splitUserPassword(connection.token);
  const auth = username ? basicAuthHeader(connection.token) : password ? { Authorization: `Bearer ${password}` } : {};
  const queries = prometheusQueries(connection.target);
  const results = {} as Results;
  // The queries are independent: sent together.
  await Promise.all((Object.entries(queries) as [Query, string][]).map(async ([name, query]) => {
    let answer;
    try {
      answer = await httpGet(`${connection.url.replace(/\/$/, '')}/api/v1/query?query=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json', ...auth }, allowSelfSigned: connection.allowSelfSigned });
    } catch (error) {
      throw new CollectError('Impossible de joindre Prometheus', error);
    }
    if (!answer.ok) throw new CollectError(`Erreur serveur (${answer.status})`, new MonitoringHttpError('Prometheus', answer.status, answer.statusText));
    try {
      const body = JSON.parse(await answer.text()) as { status?: string; data?: { result?: Sample[] } };
      results[name] = body.status === 'success' ? body.data?.result ?? [] : [];
    } catch {
      throw new CollectError('Réponse invalide (HTML)', new MonitoringInvalidResponseError('Réponse Prometheus non JSON.'));
    }
  }));
  const metrics = prometheusMetrics(results);
  if (metrics.length === 0) throw new CollectError(`Aucune donnée pour l’instance « ${connection.target} ».`, undefined, true);
  return { metrics, vitals: prometheusVitals(results) };
};
