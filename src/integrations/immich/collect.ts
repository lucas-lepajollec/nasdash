import type { IntegrationInstance } from '@/lib/types';
import type { Photo, PhotosResponse } from '@/lib/widgetData/contracts';
import { array, date, number, object, string, photoUrls, rememberPhoto, serviceJson, serviceUrl, UUID, ServiceError, type PhotoSelection } from '@/lib/widgetData/services';
export const immichHeaders = (instance: IntegrationInstance) => ({ 'x-api-key': instance.secrets?.apiKey ?? '' });
export function toImmichPhotos(instance: IntegrationInstance, assets: unknown, widgetId: string, count = 12, draft?: unknown): Photo[] {
  if (!Array.isArray(assets)) throw new ServiceError('widgets.error.parse');
  const seen = new Set<string>();
  return array(assets).flatMap(asset => {
    const item = object(asset), exif = object(item.exifInfo);
    const id = string(item.id);
    if (!UUID.test(id) || seen.has(id) || (item.type && item.type !== 'IMAGE')) return [];
    seen.add(id);
    return [{ id, ...photoUrls(widgetId, id, draft),
      ...(number(exif.exifImageWidth) ? { width: number(exif.exifImageWidth) } : {}),
      ...(number(exif.exifImageHeight) ? { height: number(exif.exifImageHeight) } : {}),
      takenAt: date(item.localDateTime) ?? date(item.fileCreatedAt),
      place: [string(exif.city), string(exif.country)].filter(Boolean).join(', ') || undefined,
      link: serviceUrl(instance, `/photos/${id}`),
    }];
  }).slice(0, count);
}
async function memoryAssets(instance: IntegrationInstance, count: number): Promise<unknown[]> {
  const headers = immichHeaders(instance);
  const today = new Date();
  try {
    const memories = await serviceJson(instance, `/api/memories?for=${today.toISOString().slice(0, 10)}`, { headers });
    const assets = array(memories).flatMap(memory => array(object(memory).assets));
    if (assets.length) return assets;
  } catch (error) {
    if (!(error instanceof ServiceError) || ![400, 403, 404].includes(Number(error.parameters?.status))) throw error;
  }
  // Bounded fallback for installations/API keys without memories: this UTC day
  // in up to ten previous years (never a whole multi-year library search).
  const assets: unknown[] = [];
  for (let year = today.getUTCFullYear() - 1; year >= today.getUTCFullYear() - 10 && assets.length < count; year--) {
    const start = new Date(Date.UTC(year, today.getUTCMonth(), today.getUTCDate()));
    if (start.getUTCMonth() !== today.getUTCMonth()) continue; // February 29
    const end = new Date(start.getTime() + 86400000);
    const result = object(await serviceJson(instance, '/api/search/metadata', { headers, method: 'POST', json: { type: 'IMAGE', order: 'desc', size: count - assets.length, withExif: true, takenAfter: start.toISOString(), takenBefore: end.toISOString() } }));
    assets.push(...array(object(result.assets).items));
  }
  return assets;
}
export async function collectImmich(instance: IntegrationInstance, selection: PhotoSelection, widgetId: string, draft?: unknown): Promise<PhotosResponse> {
  const headers = immichHeaders(instance);
  let assets: unknown;
  if (selection.mode === 'album') {
    const album = object(await serviceJson(instance, `/api/albums/${selection.albumId}`, { headers }));
    assets = album.assets;
  } else if (selection.mode === 'memories') assets = await memoryAssets(instance, selection.count);
  else {
    const random = selection.mode === 'random';
    const result = await serviceJson(instance, `/api/search/${random ? 'random' : 'metadata'}`, { headers, method: 'POST', json: {
      size: selection.count, type: 'IMAGE', withExif: true,
      ...(!random ? { order: 'desc' } : {}), ...(selection.mode === 'favorites' ? { isFavorite: true } : {}),
    } });
    assets = random ? result : object(object(result).assets).items;
  }
  const photos = toImmichPhotos(instance, assets, widgetId, selection.count, draft);
  for (const photo of photos) rememberPhoto(instance, photo.id);
  let stats: PhotosResponse['stats'];
  try {
    const data = object(await serviceJson(instance, '/api/server/statistics', { headers }));
    stats = { ...(typeof data.photos === 'number' ? { photos: number(data.photos) } : {}), ...(typeof data.videos === 'number' ? { videos: number(data.videos) } : {}), ...(typeof data.usage === 'number' ? { usageBytes: number(data.usage) } : {}) };
  } catch { /* Optional admin statistics must not prevent library access. */ }
  return { provider: 'immich', name: instance.name, photos, ...(stats && Object.keys(stats).length ? { stats } : {}), fetchedAt: Date.now() };
}
export async function immichAlbums(instance: IntegrationInstance) {
  return array(await serviceJson(instance, '/api/albums', { headers: immichHeaders(instance) })).slice(0, 200).map(value => {
    const album = object(value);
    return { id: string(album.id), name: string(album.albumName), count: number(album.assetCount) };
  }).filter(album => UUID.test(album.id));
}
