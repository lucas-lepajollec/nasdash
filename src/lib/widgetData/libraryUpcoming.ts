/** Library series and provider ids remain server-only until mapped to follow-ups. */
import { followUpPhase } from './arr';
import type { IntegrationInstance } from '@/lib/types';
import { jellyfinHeaders, jellyfinPrefix, toJellyfinItem } from '@/integrations/jellyfin/collect';
import { plexHeaders, toPlexItem } from '@/integrations/plex/collect';
import { tvMazeShow, type TvMazeProvider, type TvMazeShow } from '@/integrations/tvmaze/collect';
import type { FollowUpItem, MediaItem } from './contracts';
import { array, number, object, string, serviceJson, ServiceError } from './services';
interface Series { item: MediaItem; provider: TvMazeProvider; raw: Record<string, unknown> }
/** Small worker pool; a failed series never discards the rest of the library. */
async function mapBounded<T, R>(rows: T[], limit: number, load: (row: T) => Promise<R>): Promise<R[]> {
  let cursor = 0;
  const result: R[] = [];
  await Promise.all(Array.from({ length: Math.min(limit, rows.length) }, async () => {
    while (cursor < rows.length) { const i = cursor++; result[i] = await load(rows[i]); }
  }));
  return result;
}
export function toFollowUp(item: MediaItem, show: TvMazeShow, ownedSeason?: number): FollowUpItem | undefined {
  const ended = show.status === 'Ended';
  if (!ended && !['Running', 'To Be Determined', 'In Development'].includes(show.status)) return undefined;
  const next = ended ? undefined : show.next;
  const status = ended ? 'ended' : next?.at !== undefined ? next.season > (ownedSeason ?? 0) ? 'upcoming' : 'airing' : 'announced';
  return { phase: followUpPhase({ status, episode: next?.episode }), id: item.id, title: item.title, poster: item.poster, backdrop: item.backdrop, link: item.link, network: show.network, ownedSeason,
    status,
    ...(next ? { at: next.at, season: next.season, episode: next.episode, episodeTitle: next.title } : {}) };
}
export function sortFollowUps(items: FollowUpItem[]): FollowUpItem[] {
  const rank = (item: FollowUpItem) => item.at !== undefined ? 0 : item.status === 'ended' ? 2 : 1;
  return [...items].sort((a, b) => rank(a) - rank(b) || (a.at ?? 0) - (b.at ?? 0));
}
export async function collectLibraryUpcoming(instance: IntegrationInstance): Promise<FollowUpItem[]> {
  const plex = instance.type === 'plex';
  const request = async (path: string) => {
    const data = object(await serviceJson(instance, plex ? path : `${jellyfinPrefix(instance)}${path}`, { headers: plex ? plexHeaders(instance) : jellyfinHeaders(instance) }));
    if (plex) {
      if (!data.MediaContainer || typeof data.MediaContainer !== 'object') throw new ServiceError('widgets.error.parse');
      return object(data.MediaContainer);
    }
    return data;
  };
  const rows: Series[] = [];
  if (plex) {
    const sections = await request('/library/sections');
    if (!Array.isArray(sections.Directory)) throw new ServiceError('widgets.error.parse');
    const machine = await request('/').then(data => string(data.machineIdentifier)).catch(() => undefined);
    for (const section of array(sections.Directory).map(object).filter(section => section.type === 'show').slice(0, 30)) {
      if (rows.length >= 300) break;
      const key = string(section.key);
      if (!/^[A-Za-z0-9_-]+$/.test(key)) continue;
      const data = await request(`/library/sections/${encodeURIComponent(key)}/all?type=2&includeGuids=1&X-Plex-Container-Start=0&X-Plex-Container-Size=300`);
      if (!Array.isArray(data.Metadata)) throw new ServiceError('widgets.error.parse');
      for (const raw of data.Metadata.map(object)) {
        const item = toPlexItem(instance, raw, machine);
        if (!item || rows.length >= 300) continue;
        const guids = array(raw.Guid).map(value => string(object(value).id));
        rows.push({ item, raw, provider: { tvdb: guids.find(id => /^tvdb:\/\/\d+$/.test(id))?.slice(7), imdb: guids.find(id => /^imdb:\/\/(?:tt)?\d+$/.test(id))?.slice(7) } });
      }
    }
  } else {
    const data = await request('/Items?IncludeItemTypes=Series&Recursive=true&Fields=ProviderIds,ProductionYear,ImageTags,BackdropImageTags,DateCreated&Limit=500');
    if (!Array.isArray(data.Items)) throw new ServiceError('widgets.error.parse');
    for (const raw of data.Items.slice(0, 300).map(object)) {
      const item = toJellyfinItem(instance, raw), ids = object(raw.ProviderIds);
      if (item) rows.push({ item, raw, provider: { tvdb: string(ids.Tvdb ?? ids.tvdb), imdb: string(ids.Imdb ?? ids.imdb) } });
    }
  }
  const shows = await mapBounded(rows, 6, async row => ({ row, show: await tvMazeShow(row.provider).catch(() => null) }));
  const results = await mapBounded(shows, 4, async ({ row, show }) => {
    if (!show) return undefined;
    let ownedSeason: number | undefined;
    if (show.status !== 'Ended' && ['Running', 'To Be Determined', 'In Development'].includes(show.status)) {
      try {
        const data = await request(plex ? `/library/metadata/${encodeURIComponent(row.item.id)}/children` : `/Shows/${encodeURIComponent(row.item.id)}/Seasons`);
        const seasons = plex ? data.Metadata : data.Items;
        if (Array.isArray(seasons)) ownedSeason = Math.max(0, ...seasons.map(object).filter(season => !plex || typeof season.leafCount !== 'number' || season.leafCount > 0).map(season => number(plex ? season.index : season.IndexNumber)));
      } catch { /* Optional season metadata does not hide a known show. */ }
    }
    return toFollowUp(row.item, show, ownedSeason);
  });
  // Filter ended in the route, after the instance cache, before bounding the answer.
  return sortFollowUps(results.filter((item): item is FollowUpItem => !!item));
}
