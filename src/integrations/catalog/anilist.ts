import type { CatalogHit, ExternalItem, WatchEntry } from '@/lib/widgetData/contracts';
import { number, object, string, ServiceError } from '@/lib/widgetData/services';
import { catalogCaches, catalogId, external, pacedJson, publicImage } from './shared';
const transport = pacedJson(700), cache = catalogCaches();
const fields = 'id title { romaji english native } status startDate { year month day } nextAiringEpisode { episode airingAt } coverImage { extraLarge } bannerImage siteUrl';
async function media(variables: { search: string } | { id: number }) {
  const search = 'search' in variables;
  const data = object(await transport.request('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `query (${search ? '$search: String' : '$id: Int'}) { Media(${search ? 'search: $search' : 'id: $id'}, type: ANIME) { ${fields} } }`, variables }) }));
  const result = object(object(data.data).Media);
  if (data.errors || !result.id) throw new ServiceError('widgets.error.http');
  return result;
}
const image = (value: unknown) => publicImage(value, ['s4.anilist.co']);
function hit(raw: Record<string, unknown>): CatalogHit {
  const title = object(raw.title);
  return { provider: 'anilist', id: catalogId(raw.id), kind: 'anime', title: string(title.english) || string(title.romaji) || string(title.native), status: string(raw.status), poster: image(object(raw.coverImage).extraLarge), year: number(object(raw.startDate).year) || undefined };
}
export function mapAniList(entry: WatchEntry, raw: Record<string, unknown>): ExternalItem {
  const next = object(raw.nextAiringEpisode), start = object(raw.startDate);
  const startAt = start.year && start.month && start.day ? Date.UTC(number(start.year), number(start.month) - 1, number(start.day)) : undefined;
  const at = number(next.airingAt) > 0 ? number(next.airingAt) * 1000 : startAt;
  const status = ['FINISHED', 'CANCELLED'].includes(string(raw.status)) ? 'ended' : raw.status === 'RELEASING' && next.airingAt ? 'airing' : raw.status === 'NOT_YET_RELEASED' && at !== undefined ? 'upcoming' : 'announced';
  return external(entry, { id: `anilist:${entry.id}`, title: hit({ ...raw, id: entry.id }).title, status, at: status === 'ended' || status === 'announced' ? undefined : at,
    episode: number(next.episode) || undefined, poster: image(object(raw.coverImage).extraLarge), backdrop: image(raw.bannerImage), link: `https://anilist.co/anime/${entry.id}` });
}
/** Unavailability is isolated by the catalogue coordinator, including GraphQL errors and 403s. */
export const searchAniList = (q: string) => cache.search.get(q, async () => [hit(await media({ search: q }))]);
export async function getAniList(entry: WatchEntry): Promise<ExternalItem> {
  const id = catalogId(entry.id);
  if (!/^\d+$/.test(id)) throw new ServiceError('widgets.error.notFound');
  const item = await cache.entries.get(id, async () => mapAniList({ ...entry, title: '' }, await media({ id: Number(id) })));
  return { ...item, title: item.title || entry.title };
}
export function clearAniListCatalog() { cache.clear(); transport.clear(); }
