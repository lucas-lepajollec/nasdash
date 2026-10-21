import type { IntegrationInstance } from '@/lib/types';
import type { CatalogHit, CatalogKind, ExternalItem, WatchEntry } from '@/lib/widgetData/contracts';
import { date, number, object, string, serviceIdentity, ServiceError } from '@/lib/widgetData/services';
import { catalogCaches, catalogId, external, pacedJson, rows } from './shared';
export const TMDB_BASE = 'https://api.themoviedb.org/3';
const transport = pacedJson(100), cache = catalogCaches();
export async function tmdbRequest(instance: IntegrationInstance, path: string) {
  if (instance.type !== 'tmdb' || !instance.secrets?.apiKey) throw new ServiceError('widgets.error.notFound');
  const key = instance.secrets.apiKey, jwt = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key);
  const url = new URL(`${TMDB_BASE}${path}`);
  if (!jwt) url.searchParams.set('api_key', key);
  return object(await transport.request(url.toString(), { headers: jwt ? { Authorization: `Bearer ${key}` } : {} }));
}
const image = (value: unknown, size: 'w342' | 'w780') => typeof value === 'string' && /^\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(value) ? `https://image.tmdb.org/t/p/${size}${value}` : undefined;
function hit(raw: Record<string, unknown>, kind: CatalogKind): CatalogHit {
  return { provider: 'tmdb', id: catalogId(raw.id), kind, title: string(raw.title) || string(raw.name), status: string(raw.status), poster: image(raw.poster_path, 'w342'), year: date(raw.release_date ?? raw.first_air_date) ? new Date(date(raw.release_date ?? raw.first_air_date)!).getUTCFullYear() : undefined };
}
export function mapTmdb(entry: WatchEntry, raw: Record<string, unknown>): ExternalItem {
  const movie = entry.kind === 'movie', next = object(raw.next_episode_to_air), last = object(raw.last_episode_to_air);
  const at = date(movie ? raw.release_date : next.air_date);
  const ended = !movie && ['Ended', 'Canceled'].includes(string(raw.status));
  // Released movies are available now; the public status vocabulary uses `airing` for current releases.
  const status = ended ? 'ended' : movie && raw.status === 'Released' ? 'airing' : at !== undefined ? movie ? 'upcoming' : typeof next.season_number === 'number' && next.season_number === last.season_number ? 'airing' : 'upcoming' : 'announced';
  return external(entry, { id: `tmdb:${movie ? 'movie' : 'tv'}:${entry.id}`, title: string(raw.title) || string(raw.name), status, at: ended ? undefined : at,
    ...(!movie && !ended && raw.next_episode_to_air ? { season: number(next.season_number), episode: number(next.episode_number), episodeTitle: string(next.name) } : {}),
    network: string(object(Array.isArray(raw.networks) ? raw.networks[0] : undefined).name) || undefined,
    poster: image(raw.poster_path, 'w342'), backdrop: image(raw.backdrop_path, 'w780'), link: `https://www.themoviedb.org/${movie ? 'movie' : 'tv'}/${entry.id}` });
}
export const searchTmdb = (q: string, instance: IntegrationInstance) => cache.search.get(`${serviceIdentity(instance)}:${q}`, async () => rows((await tmdbRequest(instance, `/search/multi?query=${encodeURIComponent(q)}`)).results)
  .filter(raw => raw.media_type === 'movie' || raw.media_type === 'tv').map(raw => hit(raw, raw.media_type === 'movie' ? 'movie' : 'series')));
export async function getTmdb(entry: WatchEntry, instance: IntegrationInstance): Promise<ExternalItem> {
  const item = await cache.entries.get(`${serviceIdentity(instance)}:${entry.kind}:${entry.id}`, async () => {
    const raw = await tmdbRequest(instance, `/${entry.kind === 'movie' ? 'movie' : 'tv'}/${catalogId(entry.id)}`);
    if (!raw.id) throw new ServiceError('widgets.error.parse');
    return mapTmdb({ ...entry, title: '' }, raw);
  });
  return { ...item, title: item.title || entry.title };
}
export const allTmdb = (instance: IntegrationInstance, kinds: CatalogKind[]) => cache.all.get(`${serviceIdentity(instance)}:${kinds.join(',')}`, async () => {
  const items: ExternalItem[] = [];
  for (const kind of ['movie', 'series'] as const) {
    if (!kinds.includes(kind)) continue;
    for (const raw of rows((await tmdbRequest(instance, kind === 'movie' ? '/movie/upcoming?page=1' : '/tv/on_the_air?page=1')).results)) {
      // TV lists omit next_episode_to_air; read detail to avoid calling first_air_date its next release.
      items.push(kind === 'movie' ? mapTmdb(hit(raw, kind), raw) : await getTmdb(hit(raw, kind), instance));
    }
  }
  return items;
});
export function clearTmdbCatalog() { cache.clear(); transport.clear(); }
