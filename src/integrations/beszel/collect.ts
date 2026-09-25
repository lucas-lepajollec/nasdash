import { MonitoringConfigurationError, MonitoringHttpError } from '@/lib/monitoringError';
import { splitUserPassword } from '../connect';
import { httpGet, httpRequest } from '../http';
import { CollectError, type DeviceCollector, type DeviceVitals, type Metric, type ResolvedConnection } from '../types';

/**
 * Beszel hub (a PocketBase app). Login, then the systems list:
 * - `POST /api/collections/<users|_superusers>/auth-with-password` `{ identity, password }` → `{ token }`
 *   (`/api/admins/auth-with-password` on hubs older than PocketBase 0.23);
 * - `GET /api/collections/systems/records?perPage=500` → `{ items: [{ name, status, info }] }`
 *   with `info.cpu`, `info.mp` (memory %), `info.dp` (root disk %), `info.efs` (extra disks %),
 *   `info.g` (GPU %), `info.dt` (temperature °C), `info.rdn` (root disk name),
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

const LOGIN_PATHS = ['/api/collections/users/auth-with-password', '/api/collections/_superusers/auth-with-password', '/api/admins/auth-with-password'];

export function beszelMetrics(system: BeszelSystem): Metric[] {
  const info = system.info ?? {};
  const metrics: Metric[] = [];
  if (typeof info.cpu === 'number') metrics.push({ key: 'cpu.usage', kind: 'cpu', percent: info.cpu, ...(info.dt ? { temperatureC: info.dt } : {}) });
  if (typeof info.mp === 'number') metrics.push({ key: 'memory.usage', kind: 'memory', percent: info.mp });
  if (typeof info.dp === 'number') metrics.push({ key: 'disk.usage:root', kind: 'disk', name: info.rdn || '/', percent: info.dp });
  for (const [name, percent] of Object.entries(info.efs ?? {})) {
    if (typeof percent === 'number') metrics.push({ key: `disk.usage:${name}`, kind: 'disk', name, percent });
  }
  if (typeof info.g === 'number' && info.g > 0) metrics.push({ key: 'gpu.usage', kind: 'gpu', name: 'GPU', percent: info.g });
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
  throw new CollectError('Identifiants Beszel refusés.', new MonitoringHttpError('Beszel', lastStatus || 401, 'Login refused'));
}

export const collectBeszel: DeviceCollector = async (connection, context) => {
  if (!connection.url || !connection.token) throw new CollectError('Adresse ou identifiants Beszel manquants.', new MonitoringConfigurationError('Adresse ou identifiants Beszel manquants.'));
  if (!connection.target) throw new CollectError('Système Beszel non choisi.', new MonitoringConfigurationError('Système Beszel non choisi.'));
  const listUrl = `${connection.url}/api/collections/systems/records?page=1&perPage=500`;
  try {
    let token = context.memory.token || await login(connection);
    let answer = await httpGet(listUrl, { headers: { Authorization: token, Accept: 'application/json' }, allowSelfSigned: connection.allowSelfSigned });
    if (answer.status === 401 || answer.status === 403) {
      token = await login(connection);
      answer = await httpGet(listUrl, { headers: { Authorization: token, Accept: 'application/json' }, allowSelfSigned: connection.allowSelfSigned });
    }
    if (!answer.ok) throw new CollectError(`Erreur serveur (${answer.status})`, new MonitoringHttpError('Beszel', answer.status, answer.statusText));
    context.memory.token = token;
    const systems = (JSON.parse(await answer.text()) as { items?: BeszelSystem[] }).items ?? [];
    const wanted = connection.target.trim().toLowerCase();
    const system = systems.find(candidate => candidate.name?.toLowerCase() === wanted || candidate.id === connection.target);
    if (!system) throw new CollectError(`Système « ${connection.target} » introuvable dans Beszel.`, undefined, true);
    if (system.status && system.status !== 'up') throw new CollectError(`Système Beszel ${system.status === 'paused' ? 'en pause' : 'hors ligne'}.`, undefined, true);
    return { metrics: beszelMetrics(system), vitals: beszelVitals(system) };
  } catch (error) {
    if (error instanceof CollectError) throw error;
    throw new CollectError('Impossible de joindre Beszel', error);
  }
};
