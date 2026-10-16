import type { IntegrationInstance } from '@/lib/types';
import type { DnsSummary, DnsTopEntry } from '@/lib/widgetData/contracts';
import { array, date, number, object, string, ServiceError, serviceJson } from '@/lib/widgetData/services';

/**
 * Technitium DNS Server (https://technitium.com/dns/), read through its HTTP
 * API with an API token. Every answer is `{ status: 'ok' | 'error' |
 * 'invalid-token', response }` with HTTP 200, so the status is checked here.
 * A cluster (v14+) answers for one node or, with `node=cluster`, for all.
 *
 * Least privilege: the widget needs Dashboard (view). Reading the blocking
 * state needs Settings (view) and pausing it Settings (modify); without
 * them the widget shows the statistics and no switch.
 */
export const technitiumHeaders = (instance: IntegrationInstance) => ({ Authorization: `Bearer ${instance.secrets?.token ?? ''}` });

/** `cluster`, a node's DNS name, or nothing (the server the address points to). */
export const TECHNITIUM_NODE = /^(?:cluster|[A-Za-z0-9](?:[A-Za-z0-9-]{0,62})(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}))*)$/;
export function technitiumNode(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 253 || !TECHNITIUM_NODE.test(value)) throw new ServiceError('widgets.error.invalidSettings', 400);
  return value;
}

class TechnitiumDenied extends ServiceError {
  constructor() { super('integrations.technitium.missingPermission', 502, { status: 403 }); }
}

export async function technitiumRequest(instance: IntegrationInstance, path: string, params: Record<string, string> = {}, node?: string): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({ ...params, ...(node ? { node } : {}) });
  const body = object(await serviceJson(instance, `${path}${query.size ? `?${query}` : ''}`, { headers: technitiumHeaders(instance) }));
  if (body.status === 'ok') return object(body.response);
  if (body.status === 'invalid-token') throw new ServiceError('integrations.error.authentication', 502, { status: 401 });
  // Technitium words a missing permission "Access was denied"; its text is never passed on.
  if (/access was denied/i.test(string(body.errorMessage))) throw new TechnitiumDenied();
  throw new ServiceError('widgets.error.parse');
}

const tops = (value: unknown, clients = false): DnsTopEntry[] => array(value).slice(0, 8).map(entry => {
  const item = object(entry);
  // Clients: their reverse DNS name when Technitium knows it, else the address.
  return { name: clients ? string(item.domain) || string(item.name) : string(item.name), count: number(item.hits) };
}).filter(entry => entry.name);

export function toTechnitiumSummary(instance: IntegrationInstance, stats: Record<string, unknown>, settings: Record<string, unknown> | null, now = Date.now()): DnsSummary {
  const counters = object(stats.stats);
  const queries = number(counters.totalQueries), blocked = number(counters.totalBlocked);
  const chart = object(stats.mainChartData);
  const labels = array(chart.labels);
  const series = (name: string) => array(array(chart.datasets).map(object).find(set => string(set.label).toLowerCase() === name)?.data);
  const totals = series('total'), blockedSeries = series('blocked');
  const history = labels.map((label, index) => [date(label) ?? NaN, number(totals[index]), number(blockedSeries[index])] as [number, number, number])
    .filter(point => Number.isFinite(point[0]) && point[0] >= now - 86400000 && point[0] <= now + 3600000)
    .sort((a, b) => a[0] - b[0]);
  const resumes = settings ? date(settings.temporaryDisableBlockingTill) : undefined;
  const blocking = settings ? settings.enableBlocking !== false && !(resumes && resumes > now) : undefined;
  return {
    provider: 'technitium', name: instance.name,
    ...(blocking === undefined ? { canToggle: false } : { blocking }),
    ...(blocking === false && resumes && resumes > now ? { blockingResumesAt: resumes } : {}),
    queries, blocked, blockedPercent: queries ? Math.min(100, blocked / queries * 100) : 0,
    listedDomains: number(counters.blockListZones) + number(counters.blockedZones) || undefined,
    clients: number(counters.totalClients), cached: number(counters.totalCached), recursive: number(counters.totalRecursive),
    history,
    topBlocked: tops(stats.topBlockedDomains), topQueried: tops(stats.topDomains), topClients: tops(stats.topClients, true), fetchedAt: now,
  };
}

/** The last day's statistics; the blocking state when the token may read the settings. */
export async function collectTechnitium(instance: IntegrationInstance, node?: string): Promise<DnsSummary> {
  const stats = await technitiumRequest(instance, '/api/dashboard/stats/get', { type: 'LastDay', utc: 'true' }, node);
  if (typeof object(stats.stats).totalQueries !== 'number') throw new ServiceError('widgets.error.parse');
  // Settings of one server: for the whole cluster, the node the address points to.
  const settingsNode = node === 'cluster' ? undefined : node;
  let settings: Record<string, unknown> | null = null;
  try { settings = await technitiumRequest(instance, '/api/settings/get', {}, settingsNode); }
  catch (error) { if (!(error instanceof TechnitiumDenied)) throw error; }
  return toTechnitiumSummary(instance, stats, settings);
}

/** Pause (for `durationSeconds`, rounded up to whole minutes, or until resumed) or resume blocking. */
export async function toggleTechnitium(instance: IntegrationInstance, blocking: boolean, durationSeconds?: number, node?: string): Promise<void> {
  const target = node === 'cluster' ? undefined : node;
  if (!blocking && durationSeconds) await technitiumRequest(instance, '/api/settings/temporaryDisableBlocking', { minutes: String(Math.max(1, Math.ceil(durationSeconds / 60))) }, target);
  else await technitiumRequest(instance, '/api/settings/set', { enableBlocking: String(blocking) }, target);
}

/** Nodes of a cluster (admin settings): their names only, never their addresses. */
export async function technitiumNodes(instance: IntegrationInstance): Promise<{ cluster: boolean; nodes: string[] }> {
  try {
    const state = await technitiumRequest(instance, '/api/admin/cluster/state', { includeServerIpAddresses: 'false' });
    const nodes = array(state.clusterNodes).map(entry => string(object(entry).name)).filter(name => name && name.length <= 253 && TECHNITIUM_NODE.test(name) && name !== 'cluster');
    return { cluster: state.clusterInitialized === true && nodes.length > 0, nodes: [...new Set(nodes)].slice(0, 32) };
  } catch (error) {
    // A standalone server (or a token without that permission) has no cluster to choose from.
    if (error instanceof ServiceError && ['widgets.error.parse', 'integrations.technitium.missingPermission'].includes(error.key)) return { cluster: false, nodes: [] };
    throw error;
  }
}
