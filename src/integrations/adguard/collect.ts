import type { IntegrationInstance } from '@/lib/types';
import type { DnsSummary, DnsTopEntry } from '@/lib/widgetData/contracts';
import { array, date, number, object, serviceJson, ServiceError } from '@/lib/widgetData/services';
import { basicAuthHeader } from '../http';
export const adguardHeaders = (instance: IntegrationInstance) => basicAuthHeader(`${instance.settings.username ?? ''}:${instance.secrets?.password ?? ''}`);
const tops = (value: unknown): DnsTopEntry[] => array(value).flatMap(entry => Object.entries(object(entry)).map(([name, count]) => ({ name: name.slice(0, 512), count: number(count) }))).sort((a, b) => b.count - a.count).slice(0, 8);
export function toAdguardSummary(instance: IntegrationInstance, status: unknown, stats: unknown, filtering: unknown, now = Date.now()): DnsSummary {
  const state = object(status), data = object(stats);
  const queries = array(data.dns_queries).slice(-24), blocked = array(data.blocked_filtering).slice(-24);
  const hour = Math.floor(now / 3600000) * 3600000;
  const disabledUntil = date(state.protection_disabled_until) ?? (number(state.protection_disabled_until) || undefined);
  const resumes = disabledUntil ?? (number(state.protection_disabled_duration) > 0 ? now + number(state.protection_disabled_duration) : undefined);
  return {
    provider: 'adguard', name: instance.name, blocking: state.protection_enabled === true,
    ...(state.protection_enabled !== true && resumes ? { blockingResumesAt: resumes } : {}),
    queries: number(data.num_dns_queries), blocked: number(data.num_blocked_filtering),
    blockedPercent: number(data.num_dns_queries) ? Math.min(100, number(data.num_blocked_filtering) / number(data.num_dns_queries) * 100) : 0,
    averageMs: number(data.avg_processing_time) * 1000,
    listedDomains: array(object(filtering).filters).reduce<number>((sum, filter) => sum + number(object(filter).rules_count), 0),
    clients: array(data.top_clients).length,
    history: queries.map((value, index) => [hour - (queries.length - 1 - index) * 3600000, number(value), number(blocked[index])] as [number, number, number]),
    topBlocked: tops(data.top_blocked_domains), topClients: tops(data.top_clients), topQueried: tops(data.top_queried_domains), fetchedAt: now,
  };
}
export async function collectAdguard(instance: IntegrationInstance): Promise<DnsSummary> {
  const headers = adguardHeaders(instance);
  const [status, stats, filtering] = await Promise.all(['/control/status', '/control/stats?recent=86400000', '/control/filtering/status'].map(path => serviceJson(instance, path, { headers })));
  if (typeof object(status).protection_enabled !== 'boolean' || typeof object(stats).num_dns_queries !== 'number') throw new ServiceError('widgets.error.parse');
  return toAdguardSummary(instance, status, stats, filtering);
}
export async function toggleAdguard(instance: IntegrationInstance, blocking: boolean, durationSeconds?: number): Promise<void> {
  await serviceJson(instance, '/control/protection', { headers: adguardHeaders(instance), method: 'POST', json: { enabled: blocking, duration: blocking ? 0 : (durationSeconds ?? 0) * 1000 } });
}
