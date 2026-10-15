import type { IntegrationInstance } from '@/lib/types';
import type { DnsSummary, DnsTopEntry } from '@/lib/widgetData/contracts';
import { array, number, object, string, ServiceError, serviceIdentity, serviceJson } from '@/lib/widgetData/services';
import type { HttpOptions } from '../http';

interface Session { sid: string; expires: number }
const sessions = new Map<string, Session>();
const logins = new Map<string, Promise<Session>>();
export function clearPiholeSessions() { sessions.clear(); logins.clear(); }
async function login(instance: IntegrationInstance): Promise<Session> {
  const key = serviceIdentity(instance);
  const current = sessions.get(key);
  if (current && current.expires > Date.now()) return current;
  const pending = logins.get(key);
  if (pending) return pending;
  const request = (async () => {
    const body = object(await serviceJson(instance, '/api/auth', { method: 'POST', json: { password: instance.secrets?.password ?? '' } }));
    const session = object(body.session);
    const sid = string(session.sid);
    if (!sid || session.valid === false) throw new ServiceError('integrations.error.authentication');
    const result = { sid, expires: Date.now() + Math.max(0, number(session.validity) - 2) * 1000 };
    sessions.delete(key);
    sessions.set(key, result);
    while (sessions.size > 200) sessions.delete(sessions.keys().next().value!);
    return result;
  })();
  logins.set(key, request);
  try { return await request; } finally { logins.delete(key); }
}
export async function piholeRequest<T>(instance: IntegrationInstance, path: string, options: HttpOptions = {}): Promise<T> {
  const session = await login(instance);
  const send = (sid: string) => serviceJson<T>(instance, path, { ...options, headers: { ...options.headers, 'X-FTL-SID': sid } });
  try { return await send(session.sid); }
  catch (error) {
    if (!(error instanceof ServiceError) || error.parameters?.status !== 401) throw error;
    const key = serviceIdentity(instance);
    if (sessions.get(key)?.sid === session.sid) sessions.delete(key);
    return send((await login(instance)).sid);
  }
}
const tops = (value: unknown, clients = false): DnsTopEntry[] => array(value).slice(0, 8).map(entry => {
  const item = object(entry);
  return { name: clients ? string(item.name) || string(item.ip) : string(item.domain), count: number(item.count) };
}).filter(entry => entry.name);
export function toPiholeSummary(instance: IntegrationInstance, summary: unknown, blocking: unknown, history: unknown, blocked: unknown, queried: unknown, clients: unknown, now = Date.now()): DnsSummary {
  const stats = object(summary), state = object(blocking), queries = object(stats.queries);
  const enabled = state.blocking === 'enabled' || state.blocking === true;
  return {
    provider: 'pihole', name: instance.name, blocking: enabled,
    ...(!enabled && number(state.timer) > 0 ? { blockingResumesAt: now + number(state.timer) * 1000 } : {}),
    queries: number(queries.total), blocked: number(queries.blocked), blockedPercent: Math.min(100, number(queries.percent_blocked)),
    listedDomains: number(object(stats.gravity).domains_being_blocked), clients: number(object(stats.clients).active),
    history: array(object(history).history).map(entry => {
      const point = object(entry);
      return [number(point.timestamp) * 1000, number(point.total), number(point.blocked)] as [number, number, number];
    }).filter(point => point[0] >= now - 86400000 && point[0] <= now).sort((a, b) => a[0] - b[0]).filter((_, i, all) => i % Math.max(1, Math.ceil(all.length / 144)) === 0),
    topBlocked: tops(object(blocked).domains), topQueried: tops(object(queried).domains), topClients: tops(object(clients).clients, true), fetchedAt: now,
  };
}
export async function collectPihole(instance: IntegrationInstance): Promise<DnsSummary> {
  const results = await Promise.all(['/api/stats/summary', '/api/dns/blocking', '/api/history', '/api/stats/top_domains?blocked=true&count=8', '/api/stats/top_domains?count=8', '/api/stats/top_clients?count=8'].map(path => piholeRequest(instance, path)));
  if (typeof object(object(results[0]).queries).total !== 'number' || !['enabled', 'disabled', 'failed', 'unknown', true, false].includes(object(results[1]).blocking as string)) throw new ServiceError('widgets.error.parse');
  return toPiholeSummary(instance, results[0], results[1], results[2], results[3], results[4], results[5]);
}
export async function togglePihole(instance: IntegrationInstance, blocking: boolean, durationSeconds?: number): Promise<void> {
  await piholeRequest(instance, '/api/dns/blocking', { method: 'POST', json: { blocking, timer: blocking || !durationSeconds ? null : durationSeconds } });
}
