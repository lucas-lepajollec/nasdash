import type { IntegrationInstance } from '@/lib/types';
import type { UptimeMonitor, UptimeSummary } from '@/lib/widgetData/contracts';
import { array, number, object, serviceJson, string, ServiceError } from '@/lib/widgetData/services';
import type { KitServer } from '../kitServer';

/**
 * Uptime Kuma through one of its status pages, read without an account:
 * `GET /api/status-page/{slug}` (groups and monitors) and
 * `GET /api/status-page/heartbeat/{slug}` (the last beats, 24-hour uptime).
 * Only what the page itself publishes; Uptime Kuma caches them a minute or more.
 */
const STATES: UptimeMonitor['status'][] = ['down', 'up', 'pending', 'maintenance'];
const MAX_BEATS = 30;
export const slugOf = (instance: IntegrationInstance) => {
  const slug = (instance.settings.slug ?? '').trim().toLowerCase();
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) throw new ServiceError('integrations.uptimekuma.badSlug', 400);
  return slug;
};
const text = (value: unknown, max = 120) => string(value).trim().slice(0, max);
const webLink = (value: unknown) => { const link = text(value, 512); return /^https?:\/\//i.test(link) ? link : undefined; };
const state = (value: unknown): UptimeMonitor['status'] => typeof value === 'number' && STATES[value] ? STATES[value] : 'unknown';
/** Uptime Kuma gives the 24-hour uptime as a fraction (0.995) on recent versions, a percentage on older ones. */
const percent = (value: unknown) => typeof value !== 'number' || !Number.isFinite(value) ? undefined : Math.round((value <= 1 ? value * 100 : value) * 100) / 100;

export function toUptime(instance: IntegrationInstance, page: unknown, heartbeat: unknown, now = Date.now()): UptimeSummary {
  const groups = object(page).publicGroupList;
  if (!Array.isArray(groups)) throw new ServiceError('widgets.error.parse');
  const beats = object(object(heartbeat).heartbeatList), uptimes = object(object(heartbeat).uptimeList);
  return {
    provider: 'uptimekuma', name: instance.name,
    ...(text(object(object(page).config).title) ? { title: text(object(object(page).config).title) } : {}),
    groups: groups.map(object).map(group => ({
      name: text(group.name),
      monitors: array(group.monitorList).map(object).map(monitor => {
        const id = String(number(monitor.id) || text(monitor.id, 20));
        const list = array(beats[id]).map(object);
        const last = list.at(-1);
        const uptime = percent(uptimes[`${id}_24`]);
        const url = webLink(monitor.url);
        return {
          id, name: text(monitor.name) || id,
          status: last ? state(last.status) : 'unknown',
          ...(uptime !== undefined ? { uptime } : {}),
          ...(last && typeof last.ping === 'number' ? { ping: Math.round(last.ping) } : {}),
          beats: list.slice(-MAX_BEATS).map(beat => state(beat.status)),
          ...(url ? { url } : {}),
        };
      }),
    })).filter(group => group.monitors.length > 0),
    fetchedAt: now,
  };
}

export async function collectUptime(instance: IntegrationInstance): Promise<UptimeSummary> {
  const slug = encodeURIComponent(slugOf(instance));
  const [page, heartbeat] = await Promise.all([
    serviceJson(instance, `/api/status-page/${slug}`),
    serviceJson(instance, `/api/status-page/heartbeat/${slug}`),
  ]);
  return toUptime(instance, page, heartbeat);
}

export function demoUptime(instance: IntegrationInstance): UptimeSummary {
  const minute = Math.floor(Date.now() / 60_000);
  const beats = (pattern: string) => Array.from({ length: MAX_BEATS }, (_, index) => pattern[(index + minute) % pattern.length] === 'x' ? 'down' as const : 'up' as const);
  return {
    provider: 'uptimekuma', name: instance.name, title: 'Homelab',
    groups: [
      { name: 'Services', monitors: [
        { id: '1', name: 'Jellyfin', status: 'up', uptime: 100, ping: 18 + (minute % 5), beats: beats('u') },
        { id: '2', name: 'Immich', status: 'up', uptime: 99.86, ping: 34, beats: beats('uuuuuuuuuuuuuuuuuuuuuuuuuuxuuu') },
        { id: '3', name: 'Nextcloud', status: 'up', uptime: 99.4, ping: 51, beats: beats('uuuuuuuuxuuuuuuuuuuuuuuuuuuuuu') },
        { id: '4', name: 'Home Assistant', status: 'up', uptime: 100, ping: 12, beats: beats('u') },
      ] },
      { name: 'Network', monitors: [
        { id: '5', name: 'Router', status: 'up', uptime: 100, ping: 2, beats: beats('u') },
        { id: '6', name: 'Backup VPS', status: minute % 6 === 0 ? 'down' : 'up', uptime: 97.9, ping: 88, beats: beats('uuuuuuuuuuuuuxxuuuuuuuuuuuuuuu') },
      ] },
    ],
    fetchedAt: Date.now(),
  };
}

export const uptimekumaKit: KitServer<UptimeSummary> = {
  ttlMs: 60_000,
  collect: collectUptime,
  test: async instance => { toUptime(instance, await serviceJson(instance, `/api/status-page/${encodeURIComponent(slugOf(instance))}`), {}); },
  demo: demoUptime,
};
