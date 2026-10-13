import { collectorFailure } from '../errors';
import { scopeConnectionMemory } from '../context';
import { MonitoringConfigurationError, MonitoringHttpError } from '@/lib/monitoringError';
import { splitUserPassword } from '../connect';
import { httpGet, httpRequest } from '../http';
import { CollectError, type DeviceCollector, type DeviceVitals, type Metric, type ResolvedConnection, type TargetLister } from '../types';

/**
 * Beszel hub (a PocketBase app). Login, then the systems list:
 * - `POST /api/collections/<users|_superusers>/auth-with-password` `{ identity, password }` → `{ token }`
 *   (`/api/admins/auth-with-password` on hubs older than PocketBase 0.23);
 * - `GET /api/collections/systems/records?perPage=500` → `{ items: [{ name, status, info }] }`
 *   with `info.cpu`, `info.mp` (memory %), `info.dp` (root disk %), `info.efs` (extra disks %),
 *   `info.g` (aggregate GPU %), `info.dt` (dashboard temperature, not necessarily CPU), `info.rdn` (root disk name),
 *   `info.u` (uptime s), `info.la` (load 1/5/15), `info.t` (threads), `info.bb` (network bytes/s,
 *   sent + received; `info.b` in MB/s on older agents).
 * The token is kept between polls and renewed when refused.
 */

interface BeszelSystem {
  id?: string;
  name?: string;
  status?: string;
  info?: {
    cpu?: number; mp?: number; dp?: number; g?: number; dt?: number; efs?: Record<string, number>; rdn?: string;
    u?: number; la?: number[]; t?: number; bb?: number; b?: number;
  };
}

interface BeszelSensorStats {
  t?: Record<string, number>;
  g?: Record<string, { n?: string; u?: number; mu?: number; mt?: number }>;
}

const LOGIN_PATHS = ['/api/collections/users/auth-with-password', '/api/collections/_superusers/auth-with-password', '/api/admins/auth-with-password'];

export function beszelMetrics(system: BeszelSystem, sensors?: BeszelSensorStats): Metric[] {
  const info = system.info ?? {};
  const metrics: Metric[] = [];
  // DashboardTemp may be a selected GPU/disk sensor: only a named CPU sensor is safe.
  const cpuTemperatures = Object.entries(sensors?.t ?? {}).filter(([name, value]) => Number.isFinite(value) && /(cpu|package|tctl|tdie|coretemp|k10temp|k8temp|zenpower)/i.test(name) && !/(gpu|nvidia|amdgpu|radeon|nouveau)/i.test(name)).map(([, value]) => value);
  if (typeof info.cpu === 'number' && Number.isFinite(info.cpu)) metrics.push({ key: 'cpu.usage', kind: 'cpu', percent: info.cpu, ...(cpuTemperatures.length ? { temperatureC: Math.max(...cpuTemperatures) } : {}) });
  if (typeof info.mp === 'number') metrics.push({ key: 'memory.usage', kind: 'memory', percent: info.mp });
  if (typeof info.dp === 'number') metrics.push({ key: 'disk.usage:root', kind: 'disk', name: info.rdn || '/', percent: info.dp });
  for (const [name, percent] of Object.entries(info.efs ?? {})) {
    if (typeof percent === 'number') metrics.push({ key: `disk.usage:${name}`, kind: 'disk', name, percent });
  }
  const gpuReadings = Object.entries(sensors?.g ?? {}).filter(([, gpu]) => gpu && typeof gpu.u === 'number' && Number.isFinite(gpu.u));
  for (const [id, gpu] of gpuReadings) {
    const name = gpu.n || id;
    const temperature = sensors?.t?.[name];
    metrics.push({ key: `gpu.usage:${id}`, kind: 'gpu', name, percent: gpu.u!, ...(typeof temperature === 'number' && Number.isFinite(temperature) ? { temperatureC: temperature } : {}), ...(typeof gpu.mt === 'number' && gpu.mt > 0 ? { totalBytes: gpu.mt * 1024 ** 2 } : {}), ...(typeof gpu.mu === 'number' && Number.isFinite(gpu.mu) ? { usedBytes: gpu.mu * 1024 ** 2 } : {}) });
  }
  if (!gpuReadings.length && typeof info.g === 'number' && info.g > 0) metrics.push({ key: 'gpu.usage', kind: 'gpu', name: 'GPU', percent: info.g });
  return metrics;
}

export function beszelVitals(system: BeszelSystem): DeviceVitals {
  const info = system.info ?? {};
  const vitals: DeviceVitals = {};
  if (typeof info.u === 'number' && info.u > 0) vitals.uptimeSeconds = info.u;
  if (Array.isArray(info.la) && typeof info.la[0] === 'number') vitals.load = info.la.slice(0, 3);
  if (typeof info.t === 'number' && info.t > 0) vitals.cores = info.t;
  if (typeof info.bb === 'number') vitals.netTotalBps = info.bb;
  else if (typeof info.b === 'number') vitals.netTotalBps = Math.round(info.b * 1024 * 1024);
  return vitals;
}

async function login(connection: ResolvedConnection): Promise<string> {
  const { username, password } = splitUserPassword(connection.token);
  let lastStatus = 0;
  for (const path of LOGIN_PATHS) {
    const answer = await httpRequest(`${connection.url}${path}`, { method: 'POST', json: { identity: username, password }, allowSelfSigned: connection.allowSelfSigned });
    if (answer.ok) {
      const token = (JSON.parse(await answer.text()) as { token?: string }).token;
      if (token) return token;
    }
    lastStatus = answer.status;
  }
  throw new CollectError('integrations.error.authentication', new MonitoringHttpError('Beszel', lastStatus || 401, 'Login refused'));
}

/** Signs in (token kept between calls) and reads the systems list. */
async function listSystems(connection: ResolvedConnection, context: Parameters<DeviceCollector>[1]): Promise<BeszelSystem[]> {
  scopeConnectionMemory(connection, context);
  const listUrl = `${connection.url}/api/collections/systems/records?page=1&perPage=500`;
  let token = context.memory.token || await login(connection);
  let answer = await httpGet(listUrl, { headers: { Authorization: token, Accept: 'application/json' }, allowSelfSigned: connection.allowSelfSigned });
  if (answer.status === 401 || answer.status === 403) {
    token = await login(connection);
    answer = await httpGet(listUrl, { headers: { Authorization: token, Accept: 'application/json' }, allowSelfSigned: connection.allowSelfSigned });
  }
  if (!answer.ok) throw collectorFailure('Beszel', new MonitoringHttpError('Beszel', answer.status, answer.statusText));
  context.memory.token = token;
  return (JSON.parse(await answer.text()) as { items?: BeszelSystem[] }).items ?? [];
}

/** Optional named sensors: old hubs/restricted tokens still provide their usage metrics. */
async function sensorStats(connection: ResolvedConnection, context: Parameters<DeviceCollector>[1], systemId: string | undefined): Promise<BeszelSensorStats | undefined> {
  if (!systemId) return;
  const literal = systemId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const query = new URLSearchParams({ filter: `system="${literal}" && type="1m"`, sort: '-created', page: '1', perPage: '1' });
  try {
    const answer = await httpGet(`${connection.url}/api/collections/system_stats/records?${query}`, { headers: { Authorization: context.memory.token, Accept: 'application/json' }, allowSelfSigned: connection.allowSelfSigned });
    if (!answer.ok) {
      context.warn('Beszel sensors', new MonitoringHttpError('Beszel', answer.status, answer.statusText));
      return;
    }
    const data = JSON.parse(await answer.text()) as { items?: { stats?: BeszelSensorStats }[] };
    const stats = data.items?.[0]?.stats;
    context.clearWarning('Beszel sensors');
    return stats && typeof stats === 'object' ? stats : undefined;
  } catch (error) {
    context.warn('Beszel sensors', error);
    return;
  }
}

/** The systems of the hub, to pick one per device. */
export const listBeszelSystems: TargetLister = async (connection, context) => {
  if (!connection.url || !connection.token) throw new CollectError('integrations.error.missingCredentials', new MonitoringConfigurationError('Missing Beszel address or credentials.'));
  try {
    return (await listSystems(connection, context)).filter(system => system.name).map(system => ({ values: { target: system.name! }, label: system.name!, ...(system.status ? { detail: system.status } : {}) }));
  } catch (error) {
    if (error instanceof CollectError) throw error;
    throw collectorFailure('Beszel', error);
  }
};

export const collectBeszel: DeviceCollector = async (connection, context) => {
  if (!connection.url || !connection.token) throw new CollectError('integrations.error.missingCredentials', new MonitoringConfigurationError('Missing Beszel address or credentials.'));
  if (!connection.target) throw new CollectError('integrations.error.targetMissing', new MonitoringConfigurationError('No Beszel system selected.'));
  try {
    const systems = await listSystems(connection, context);
    const wanted = connection.target.trim().toLowerCase();
    const system = systems.find(candidate => candidate.name?.toLowerCase() === wanted || candidate.id === connection.target);
    if (!system) throw new CollectError('integrations.error.targetNotFound', undefined, true, { target: connection.target });
    if (system.status && system.status !== 'up') throw new CollectError(system.status === 'paused' ? 'integrations.error.targetPaused' : 'integrations.error.targetOffline', undefined, true);
    return { metrics: beszelMetrics(system, await sensorStats(connection, context, system.id)), vitals: beszelVitals(system) };
  } catch (error) {
    if (error instanceof CollectError) throw error;
    throw collectorFailure('Beszel', error);
  }
};
