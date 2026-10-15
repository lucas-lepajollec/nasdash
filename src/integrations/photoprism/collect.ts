import type { IntegrationInstance } from '@/lib/types';
import type { Photo, PhotosResponse } from '@/lib/widgetData/contracts';
import { array, date, number, object, string, photoUrls, rememberPhoto, serviceIdentity, serviceJson, serviceUrl, PHOTO_UID, PHOTO_HASH, ALBUM_UID, ServiceError, type PhotoSelection } from '@/lib/widgetData/services';
import { TtlCache } from '@/lib/widgetData/cache';
export const photoprismHeaders = (instance: IntegrationInstance) => ({ Authorization: `Bearer ${instance.secrets?.token ?? ''}` });
const previewTokens = new TtlCache<string>(300_000);
export function photoprismPreviewToken(instance: IntegrationInstance): Promise<string> {
  return previewTokens.get(serviceIdentity(instance), async () => {
    const config = object(await serviceJson(instance, '/api/v1/config', { headers: photoprismHeaders(instance) }));
    const token = string(config.previewToken);
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(token)) throw new ServiceError('widgets.error.parse');
    return token;
  });
}
export function toPhotoprismPhotos(instance: IntegrationInstance, assets: unknown, widgetId: string, count = 12, draft?: unknown): Photo[] {
  if (!Array.isArray(assets)) throw new ServiceError('widgets.error.parse');
  const seen = new Set<string>();
  return array(assets).flatMap(asset => {
    const item = object(asset);
    const id = string(item.UID);
    const file = array(item.Files).map(object).find(file => PHOTO_HASH.test(string(file.Hash)) && file.MediaType !== 'video');
    const hash = string(file?.Hash) || string(item.Hash);
    if (!PHOTO_UID.test(id) || !PHOTO_HASH.test(hash) || seen.has(id) || item.Type === 'video') return [];
    seen.add(id);
    rememberPhoto(instance, id, hash);
    return [{ id, ...photoUrls(widgetId, id, draft),
      ...(number(file?.Width ?? item.Width) ? { width: number(file?.Width ?? item.Width) } : {}),
      ...(number(file?.Height ?? item.Height) ? { height: number(file?.Height ?? item.Height) } : {}),
      takenAt: date(item.TakenAtLocal) ?? date(item.TakenAt),
      place: [string(item.PlaceCity), string(item.PlaceCountry)].filter(Boolean).join(', ') || undefined,
      link: serviceUrl(instance, `/library/browse?view=cards&q=${encodeURIComponent(`uid:${id}`)}`),
    }];
  }).slice(0, count);
}
export async function collectPhotoprism(instance: IntegrationInstance, selection: PhotoSelection, widgetId: string, draft?: unknown): Promise<PhotosResponse> {
  const query = new URLSearchParams({ count: String(selection.count), order: selection.mode === 'random' ? 'random' : 'newest', quality: '3', merged: 'true', type: 'image' });
  if (selection.mode === 'favorites') query.set('favorite', 'true');
  if (selection.mode === 'album') query.set('s', selection.albumId!);
  if (selection.mode === 'memories') {
    const now = new Date();
    query.set('q', `month:${now.getUTCMonth() + 1} day:${now.getUTCDate()} before:${now.getUTCFullYear()}-01-01`);
  }
  const assets = await serviceJson(instance, `/api/v1/photos?${query}`, { headers: photoprismHeaders(instance) });
  return { provider: 'photoprism', name: instance.name, photos: toPhotoprismPhotos(instance, assets, widgetId, selection.count, draft), fetchedAt: Date.now() };
}
export async function photoprismAlbums(instance: IntegrationInstance) {
  return array(await serviceJson(instance, '/api/v1/albums?count=200&type=album', { headers: photoprismHeaders(instance) })).slice(0, 200).map(value => {
    const album = object(value);
    return { id: string(album.UID), name: string(album.Title), count: number(album.PhotoCount) };
  }).filter(album => ALBUM_UID.test(album.id));
}
