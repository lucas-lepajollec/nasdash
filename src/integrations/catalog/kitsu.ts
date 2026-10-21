import type { CatalogHit, ExternalItem, WatchEntry } from '@/lib/widgetData/contracts';
import { date, object, string, ServiceError } from '@/lib/widgetData/services';
import { catalogCaches, catalogId, external, pacedJson, publicImage, rows } from './shared';
const transport = pacedJson(250), cache = catalogCaches();
const request = async (path: string) => object(await transport.request(`https://kitsu.app/api/edge${path}`, { headers: { Accept: 'application/vnd.api+json' } }));
const image = (value: unknown) => publicImage(value, ['media.kitsu.app', 'media.kitsu.io']);
function hit(raw: Record<string, unknown>): CatalogHit {
  const a = object(raw.attributes);
  return { provider: 'kitsu', id: catalogId(raw.id), kind: 'anime', title: string(a.canonicalTitle), status: string(a.status), poster: image(object(a.posterImage).medium) ?? image(object(a.posterImage).original), year: date(a.startDate) ? new Date(date(a.startDate)!).getUTCFullYear() : undefined };
}
export function mapKitsu(entry: WatchEntry, raw: Record<string, unknown>): ExternalItem {
  const a = object(raw.attributes), next = date(a.nextRelease), start = date(a.startDate);
  const status = a.status === 'finished' ? 'ended' : a.status === 'current' && next !== undefined ? 'airing' : ['upcoming', 'tba', 'unreleased'].includes(string(a.status)) && start !== undefined ? 'upcoming' : 'announced';
  return external(entry, { id: `kitsu:${entry.id}`, title: string(a.canonicalTitle), status, at: status === 'airing' ? next : status === 'upcoming' ? start : undefined,
    poster: hit({ ...raw, id: entry.id }).poster, backdrop: image(object(a.coverImage).original), link: `https://kitsu.app/anime/${encodeURIComponent(string(a.slug) || entry.id)}` });
}
export const searchKitsu = (q: string) => cache.search.get(q, async () => rows((await request(`/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=10`)).data).map(hit));
export async function getKitsu(entry: WatchEntry): Promise<ExternalItem> {
  const item = await cache.entries.get(entry.id, async () => {
    const raw = object((await request(`/anime/${catalogId(entry.id)}`)).data);
    if (!raw.id || !raw.attributes) throw new ServiceError('widgets.error.parse');
    return mapKitsu({ ...entry, title: '' }, raw);
  });
  return { ...item, title: item.title || entry.title };
}
export const allKitsu = () => cache.all.get('all', async () => {
  const items: ExternalItem[] = [];
  for (const status of ['current', 'upcoming']) for (const raw of rows((await request(`/anime?filter[status]=${status}&sort=popularityRank&page[limit]=20`)).data)) items.push(mapKitsu(hit(raw), raw));
  return items;
});
export function clearKitsuCatalog() { cache.clear(); transport.clear(); }
