import type { IntegrationInstance } from '@/lib/types';
import { object, serviceJson, ServiceError } from '@/lib/widgetData/services';
import { counters, identity, years } from '../photos/shared';
import { photoprismHeaders } from './collect';
export function toPhotoprismStats(instance: IntegrationInstance, value: unknown) {
  const config = object(value), data = object(config.count);
  if (!Object.keys(data).length) throw new ServiceError('widgets.error.parse');
  // `years` often contains plain years, not counts: those cannot form a histogram.
  const byYear = years(config.years, 'year', 'count');
  return { ...identity(instance), ...counters({ photos: data.photos, videos: data.videos, albums: data.albums, places: data.places,
    people: data.people, favorites: data.favorites }), ...(byYear?.length ? { byYear } : {}) };
}
export async function collectPhotoprismStats(instance: IntegrationInstance) {
  return toPhotoprismStats(instance, await serviceJson(instance, '/api/v1/config', { headers: photoprismHeaders(instance) }));
}
