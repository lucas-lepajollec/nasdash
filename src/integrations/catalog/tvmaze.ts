import type { CatalogHit, ExternalItem, WatchEntry } from '@/lib/widgetData/contracts';
import { date, number, object, string, ServiceError } from '@/lib/widgetData/services';
import { tvMazeJson, clearTvMazeCache } from '../tvmaze/collect';
import { catalogCaches, catalogId, external, publicImage, rows, sortExternal } from './shared';
const cache = catalogCaches();
const poster = (show: Record<string, unknown>) => publicImage(object(show.image).original, ['static.tvmaze.com']) ?? publicImage(object(show.image).medium, ['static.tvmaze.com']);
const kind = (show: Record<string, unknown>) => show.type === 'Animation' ? 'anime' as const : 'series' as const;
function hit(show: Record<string, unknown>): CatalogHit {
  return { provider: 'tvmaze', id: catalogId(show.id), kind: kind(show), title: string(show.name), poster: poster(show), year: date(show.premiered) ? new Date(date(show.premiered)!).getUTCFullYear() : undefined, status: string(show.status) };
}
export function mapTvMaze(entry: WatchEntry, show: Record<string, unknown>, next?: Record<string, unknown>, previous?: Record<string, unknown>): ExternalItem {
  const at = date(next?.airstamp) ?? date(next?.airdate), ended = show.status === 'Ended';
  const status = ended ? 'ended' : at !== undefined ? previous && typeof next?.season === 'number' && next.season === previous.season ? 'airing' : 'upcoming' : 'announced';
  return external(entry, { id: `tvmaze:${entry.id}`, title: string(show.name), status, poster: poster(show), link: `https://www.tvmaze.com/shows/${entry.id}`,
    network: string(object(show.network).name) || string(object(show.webChannel).name) || undefined,
    ...(!ended && next ? { at, season: number(next.season), episode: number(next.number), episodeTitle: string(next.name) } : {}) });
}
export const searchTvMaze = (q: string) => cache.search.get(q, async () => rows(await tvMazeJson(`/search/shows?q=${encodeURIComponent(q)}`)).map(row => hit(object(row.show))));
export async function getTvMaze(entry: WatchEntry): Promise<ExternalItem> {
  const item = await cache.entries.get(entry.id, async () => {
    const raw = await tvMazeJson(`/shows/${catalogId(entry.id)}`);
    if (!raw) throw new ServiceError('widgets.error.notFound');
    const show = object(raw);
    if (!show.id) throw new ServiceError('widgets.error.parse');
    const links = object(show._links);
    const episode = async (key: string) => {
      const match = /^https:\/\/api\.tvmaze\.com(\/episodes\/\d+)$/.exec(string(object(links[key]).href));
      const result = match ? await tvMazeJson(match[1]) : undefined;
      return result ? object(result) : undefined;
    };
    return mapTvMaze({ ...entry, title: '' }, show, await episode('nextepisode'), await episode('previousepisode'));
  });
  return { ...item, kind: entry.kind, title: item.title || entry.title };
}
export const allTvMaze = (now = Date.now()) => cache.all.get(new Date(now).toISOString().slice(0, 10), async () => {
  const grouped = new Map<string, ExternalItem>();
  for (let n = 0; n < 7; n++) {
    const day = new Date(now + n * 86400000).toISOString().slice(0, 10);
    for (const episode of rows(await tvMazeJson(`/schedule/web?date=${day}`))) {
      if (episode.number !== 1) continue;
      const show = object(object(episode._embedded).show), entry = hit(show);
      if (!grouped.has(entry.id)) grouped.set(entry.id, mapTvMaze(entry, show, episode));
    }
  }
  return sortExternal([...grouped.values()]).slice(0, 30);
});
export function clearTvMazeCatalog() { cache.clear(); clearTvMazeCache(); }
