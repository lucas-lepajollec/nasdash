import type { IntegrationInstance } from '@/lib/types';
import type { PhotoStatsResponse } from '@/lib/widgetData/contracts';
import { array, object, serviceJson, ServiceError, string } from '@/lib/widgetData/services';
import { count, counters, identity, years } from '../photos/shared';
import { immichHeaders } from './collect';

export function toImmichStats(instance: IntegrationInstance, value: unknown, admin = true): PhotoStatsResponse {
  const data = object(value);
  if (count(admin ? data.photos : data.images) === undefined) throw new ServiceError('widgets.error.parse');
  return { ...identity(instance), ...counters({ photos: admin ? data.photos : data.images, videos: data.videos, libraryBytes: admin ? data.usage : undefined }),
    ...(admin && Array.isArray(data.usageByUser) ? { users: array(data.usageByUser).slice(0, 200).map(raw => {
      const row = object(raw);
      return { name: string(row.userName), photos: count(row.photos) ?? 0, videos: count(row.videos) ?? 0, ...counters({ bytes: row.usage }) };
    }) } : {}) };
}
/** Best effort: at most five 1,000-item pages, never an unbounded library crawl. */
async function recentAdded(instance: IntegrationInstance): Promise<{ added: number[]; truncated: boolean }> {
  const now = new Date(), start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 29 * 86400000;
  const added = Array<number>(30).fill(0), seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 1; page <= 5; page++) {
    const data = object(await serviceJson(instance, '/api/search/metadata', { headers: immichHeaders(instance), method: 'POST', json: {
      createdAfter: new Date(start).toISOString(), createdBefore: now.toISOString(), size: 1000, ...(cursor ? { cursor } : { page }), order: 'desc', withExif: false,
    } })), assets = object(data.assets);
    if (!Array.isArray(assets.items)) throw new ServiceError('widgets.error.parse');
    for (const raw of array(assets.items).slice(0, 1000)) {
      const row = object(raw), id = string(row.id), at = Date.parse(string(row.createdAt)), day = Math.floor((at - start) / 86400000);
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      if (day >= 0 && day < 30) added[day]++;
    }
    cursor = typeof assets.nextCursor === 'string' && assets.nextCursor.length <= 4096 ? assets.nextCursor : undefined;
    if ((!cursor && !assets.nextPage) || array(assets.items).length < 1000) return { added, truncated: false };
  }
  return { added, truncated: true };
}
export async function collectImmichStats(instance: IntegrationInstance): Promise<PhotoStatsResponse> {
  const get = (path: string) => serviceJson(instance, path, { headers: immichHeaders(instance) });
  let result: PhotoStatsResponse;
  const denied = (error: unknown) => error instanceof ServiceError && [401, 403, 404].includes(Number(error.parameters?.status));
  try { result = toImmichStats(instance, await get('/api/server/statistics')); }
  catch (error) {
    if (!denied(error)) throw error;
    try { result = toImmichStats(instance, await get('/api/assets/statistics'), false); }
    catch (inner) {
      // A scoped API key without statistics access: what else it may read still shows.
      if (!denied(inner)) throw inner;
      result = { provider: 'immich', name: instance.name, limited: true, fetchedAt: Date.now() };
    }
  }
  const timeline = async () => {
    try { return await get('/api/timeline/buckets'); }
    catch (error) {
      // Current Immich chooses minimal buckets and no longer accepts `size`;
      // earlier releases require it. Both return timeBucket/count rows.
      if (!(error instanceof ServiceError) || error.parameters?.status !== 400) throw error;
      return get('/api/timeline/buckets?size=MONTH');
    }
  };
  const [storage, owned, shared, people, buckets, added] = await Promise.allSettled([
    get('/api/server/storage'), get('/api/albums'), get('/api/albums?shared=true'),
    get('/api/people?withHidden=false'), timeline(), recentAdded(instance),
  ]);
  if (storage.status === 'fulfilled') {
    const data = object(storage.value), usedBytes = count(data.diskUseRaw), totalBytes = count(data.diskSizeRaw);
    if (usedBytes !== undefined && totalBytes !== undefined) result.disk = { usedBytes, totalBytes };
  }
  // A failed half would undercount; omit the total until both lists are available.
  if (owned.status === 'fulfilled' && shared.status === 'fulfilled' && Array.isArray(owned.value) && Array.isArray(shared.value)) {
    result.albums = new Set([...owned.value, ...shared.value].map(raw => string(object(raw).id)).filter(Boolean)).size;
  }
  if (people.status === 'fulfilled') Object.assign(result, counters({ people: object(people.value).total }));
  if (buckets.status === 'fulfilled') { const byYear = years(buckets.value, 'timeBucket', 'count'); if (byYear) result.byYear = byYear; }
  // Without statistics access, the timeline still counts everything.
  if (result.limited && result.photos === undefined && buckets.status === 'fulfilled' && Array.isArray(buckets.value)) result.items = buckets.value.reduce((sum: number, raw) => sum + (count(object(raw).count) ?? 0), 0);
  // A truncated histogram is not an exact daily total. `limited` is reserved
  // for missing API permissions, so omit this optional series instead.
  if (added.status === 'fulfilled' && !added.value.truncated) result.added = added.value.added;
  return result;
}
