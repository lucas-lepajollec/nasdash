/** Settings and source authorization shared by the *arr routes and media image proxy. */
import { readConfig } from '@/lib/config';
import type { IntegrationInstance } from '@/lib/types';
import { ARR_TYPES, LIBRARY_ARR_TYPES, DOWNLOAD_CLIENT_TYPES, MEDIA_SERVER_TYPES, type UpcomingItem } from './contracts';
import { demoVisitorInstance, ServiceError } from './services';
export const ARR_WIDGET_TYPES = ['media-upcoming', 'media-queue', 'media-arr', 'media-indexers', 'media-downloads'] as const;
export type ArrWidgetType = typeof ARR_WIDGET_TYPES[number];
export const ARR_IMAGE_WIDGET_TYPES = ['media-upcoming', 'media-queue'] as const;
export const sourceTypes = (type: ArrWidgetType): readonly string[] => type === 'media-arr' ? ARR_TYPES : type === 'media-downloads' ? DOWNLOAD_CLIENT_TYPES : type === 'media-indexers' ? ['prowlarr'] : LIBRARY_ARR_TYPES;
export function upcomingSource(settings: Record<string, unknown>): 'arr' | 'library' {
  const source = settings.source ?? 'arr';
  if (source !== 'arr' && source !== 'library' || settings.ended !== undefined && typeof settings.ended !== 'boolean' || settings.mediaId !== undefined && (typeof settings.mediaId !== 'string' || !settings.mediaId)) throw new ServiceError('widgets.error.invalidSettings', 400);
  return source;
}
export function librarySource(settings: Record<string, unknown>): IntegrationInstance[] {
  return widgetSources({ integrationId: settings.mediaId }, MEDIA_SERVER_TYPES, true);
}
export function settingNumber(settings: Record<string, unknown>, field: string, fallback: number, min: number, max: number): number {
  const value = settings[field] === undefined ? fallback : settings[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new ServiceError('widgets.error.invalidSettings', 400);
  return value;
}
export function upcomingKinds(settings: Record<string, unknown>): UpcomingItem['kind'][] {
  const kinds = settings.kinds === undefined ? ['episode', 'movie', 'album'] : settings.kinds;
  if (!Array.isArray(kinds) || !kinds.length || kinds.length > 3 || kinds.some(kind => !['episode', 'movie', 'album'].includes(kind)) || new Set(kinds).size !== kinds.length) throw new ServiceError('widgets.error.invalidSettings', 400);
  return kinds;
}
export function widgetSources(settings: Record<string, unknown>, types: readonly string[], single = false): IntegrationInstance[] {
  const saved = (readConfig().integrations ?? []).filter(instance => types.includes(instance.type));
  if (single) {
    const id = settings.integrationId;
    if (id !== undefined && (typeof id !== 'string' || !id)) throw new ServiceError('widgets.error.invalidSettings', 400);
    const instance = id === undefined ? saved[0] : saved.find(instance => instance.id === id) ?? demoVisitorInstance(id, types);
    if (!instance) throw new ServiceError('widgets.error.notFound', 404);
    return [instance];
  }
  const ids = settings.integrationIds;
  if (ids === undefined) return saved;
  if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) || new Set(ids).size !== ids.length) throw new ServiceError('widgets.error.invalidSettings', 400);
  return ids.map(id => {
    const instance = saved.find(instance => instance.id === id) ?? demoVisitorInstance(id, types);
    if (!instance) throw new ServiceError('widgets.error.notFound', 404);
    return instance;
  });
}
