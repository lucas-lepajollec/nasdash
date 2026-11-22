import type { IntegrationInstance } from '@/lib/types';
import type { MediaRequestItem, MediaRequestsSummary } from '@/lib/widgetData/contracts';
import { array, number, object, serviceJson, string, ServiceError } from '@/lib/widgetData/services';
import type { KitServer } from '../kitServer';
import { demoArtUrl } from '@/lib/demo/library';

/**
 * Seerr (Overseerr, Jellyseerr): `GET /api/v1/request/count`, the latest
 * requests (`GET /api/v1/request?take=20&sort=added`) and each one's title
 * from `/api/v1/movie/{tmdbId}` or `/api/v1/tv/{tmdbId}` (cached a day). An
 * administrator approves or declines a pending request
 * (`POST /api/v1/request/{id}/approve|decline`), only one listed as pending.
 */
type Options = { method?: 'POST' };
export const seerrRequest = <T = unknown>(instance: IntegrationInstance, path: string, options: Options = {}) =>
  serviceJson<T>(instance, `/api/v1${path}`, { ...options, headers: { 'X-Api-Key': instance.secrets?.apiKey ?? '' } });

const TMDB_IMAGES = 'https://image.tmdb.org/t/p/w185';
const text = (value: unknown, max = 160) => string(value).trim().slice(0, max);
const COUNT = 20;

/** Request status 1 pending, 2 approved, 3 declined; then the media's own (5 available, 3–4 processing or partly there). */
export function requestStatus(request: Record<string, unknown>): MediaRequestItem['status'] {
  const status = number(request.status), media = number(object(request.media).status);
  if (status === 3) return 'declined';
  if (status === 1) return 'pending';
  if (media === 5) return 'available';
  if (media === 3 || media === 4) return 'processing';
  return status === 2 ? 'approved' : 'unknown';
}

const titles = new Map<string, { title: string; year?: number; poster?: string; at: number }>();
async function details(instance: IntegrationInstance, kind: 'movie' | 'tv', tmdbId: number) {
  const key = `${instance.id}:${kind}:${tmdbId}`, cached = titles.get(key);
  if (cached && Date.now() - cached.at < 86_400_000) return cached;
  const media = object(await seerrRequest(instance, `/${kind}/${tmdbId}`).catch(() => ({})));
  const date = text(kind === 'movie' ? media.releaseDate : media.firstAirDate, 10);
  const posterPath = text(media.posterPath, 120);
  const found = {
    title: text(kind === 'movie' ? media.title : media.name) || `TMDB ${tmdbId}`,
    ...(/^\d{4}/.test(date) ? { year: Number(date.slice(0, 4)) } : {}),
    ...(/^\/[A-Za-z0-9_.-]+\.(jpg|png|webp)$/.test(posterPath) ? { poster: `${TMDB_IMAGES}${posterPath}` } : {}),
    at: Date.now(),
  };
  titles.delete(key); titles.set(key, found);
  while (titles.size > 2000) titles.delete(titles.keys().next().value!);
  return found;
}

export function toCounts(value: unknown): MediaRequestsSummary['counts'] {
  const counts = object(value);
  if (!('total' in counts)) throw new ServiceError('widgets.error.parse');
  return { total: number(counts.total), pending: number(counts.pending), approved: number(counts.approved), processing: number(counts.processing), available: number(counts.available), declined: number(counts.declined) };
}

export async function collectSeerr(instance: IntegrationInstance): Promise<MediaRequestsSummary> {
  const [counts, page] = await Promise.all([seerrRequest(instance, '/request/count'), seerrRequest(instance, `/request?take=${COUNT}&skip=0&filter=all&sort=added`)]);
  const results = array(object(page).results).map(object).slice(0, COUNT);
  const requests = await Promise.all(results.map(async request => {
    const media = object(request.media);
    const kind: 'movie' | 'tv' = string(request.type) === 'tv' || string(media.mediaType) === 'tv' ? 'tv' : 'movie';
    const tmdbId = number(media.tmdbId);
    const found = tmdbId ? await details(instance, kind, tmdbId) : { title: '?' };
    const by = object(request.requestedBy);
    const at = Date.parse(string(request.createdAt));
    return {
      id: String(number(request.id)), kind, title: found.title,
      ...('year' in found && found.year ? { year: found.year } : {}),
      ...('poster' in found && found.poster ? { poster: found.poster } : {}),
      ...(text(by.displayName || by.username || by.plexUsername || by.jellyfinUsername, 60) ? { requestedBy: text(by.displayName || by.username || by.plexUsername || by.jellyfinUsername, 60) } : {}),
      ...(Number.isFinite(at) ? { requestedAt: at } : {}),
      status: requestStatus(request),
    } satisfies MediaRequestItem;
  }));
  return { provider: 'seerr', name: instance.name, counts: toCounts(counts), requests, fetchedAt: Date.now() };
}

/** Approve or decline a request Seerr lists as pending now: never an id the browser made up. */
async function decide(instance: IntegrationInstance, target: string | undefined, decision: 'approve' | 'decline') {
  if (!target || !/^\d{1,10}$/.test(target)) throw new ServiceError('widgets.error.invalidRequest', 400);
  const pending = array(object(await seerrRequest(instance, '/request?take=100&skip=0&filter=pending&sort=added')).results).map(object);
  if (!pending.some(request => String(number(request.id)) === target)) throw new ServiceError('widgets.requests.error.notPending', 409);
  await seerrRequest(instance, `/request/${target}/${decision}`, { method: 'POST' });
}

/* Public demo: open films (Blender Studio); deciding moves a request out of the pending ones. */
const demoDecisions = new Map<string, 'approved' | 'declined'>();
export function demoSeerr(instance: IntegrationInstance): MediaRequestsSummary {
  const now = Date.now(), day = 86_400_000;
  const all: MediaRequestItem[] = [
    { id: '41', title: 'Wing It!', kind: 'movie', year: 2023, poster: demoArtUrl('wing-it'), requestedBy: 'Alex', requestedAt: now - 2 * 3_600_000, status: 'pending' },
    { id: '40', title: 'Caminandes', kind: 'tv', year: 2013, poster: demoArtUrl('caminandes'), requestedBy: 'Sam', requestedAt: now - 5 * 3_600_000, status: 'pending' },
    { id: '39', title: 'Charge', kind: 'movie', year: 2022, poster: demoArtUrl('charge'), requestedBy: 'Alex', requestedAt: now - day, status: 'processing' },
    { id: '38', title: 'Agent 327', kind: 'tv', year: 2017, poster: demoArtUrl('agent-327'), requestedBy: 'Jo', requestedAt: now - 2 * day, status: 'available' },
    { id: '37', title: 'Hero', kind: 'movie', year: 2018, poster: demoArtUrl('hero'), requestedBy: 'Sam', requestedAt: now - 4 * day, status: 'available' },
  ];
  const requests = all.map(request => { const decided = demoDecisions.get(`${instance.id}:${request.id}`); return decided ? { ...request, status: decided } : request; });
  const pending = requests.filter(request => request.status === 'pending').length;
  return { provider: 'seerr', name: instance.name, counts: { total: 128, pending, approved: 4, processing: 3, available: 119, declined: 2 }, requests, fetchedAt: now };
}
const demoDecide = (decision: 'approved' | 'declined') => (instance: IntegrationInstance, target?: string) => {
  if (target) demoDecisions.set(`${instance.id}:${target}`, decision);
  while (demoDecisions.size > 400) demoDecisions.delete(demoDecisions.keys().next().value!);
};

export const seerrKit: KitServer<MediaRequestsSummary> = {
  ttlMs: 60_000,
  collect: collectSeerr,
  test: async instance => { toCounts(await seerrRequest(instance, '/request/count')); },
  demo: demoSeerr,
  actions: {
    approve: { run: (instance, target) => decide(instance, target, 'approve'), demo: demoDecide('approved') },
    decline: { run: (instance, target) => decide(instance, target, 'decline'), demo: demoDecide('declined') },
  },
};
