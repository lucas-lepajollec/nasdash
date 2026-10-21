/** Settings and source authorization shared by the *arr routes and media image proxy. */
import { readConfig } from '@/lib/config';
import type { IntegrationInstance } from '@/lib/types';
import { ARR_TYPES, LIBRARY_ARR_TYPES, DOWNLOAD_CLIENT_TYPES, MEDIA_SERVER_TYPES, type CatalogKind, type WatchEntry, type ReleasePhase, type FollowUpItem, type UpcomingItem } from './contracts';
import { demoVisitorInstance, ServiceError } from './services';
export const ARR_WIDGET_TYPES = ['media-upcoming', 'media-queue', 'media-arr', 'media-indexers', 'media-downloads'] as const;
export type ArrWidgetType = typeof ARR_WIDGET_TYPES[number];
export const ARR_IMAGE_WIDGET_TYPES = ['media-upcoming', 'media-queue'] as const;
export const sourceTypes = (type: ArrWidgetType): readonly string[] => type === 'media-arr' ? ARR_TYPES : type === 'media-downloads' ? DOWNLOAD_CLIENT_TYPES : type === 'media-indexers' ? ['prowlarr'] : LIBRARY_ARR_TYPES;
export type UpcomingSource = 'arr' | 'library' | 'external';
const invalid = () => { throw new ServiceError('widgets.error.invalidSettings', 400); };
export function upcomingSources(settings: Record<string, unknown>): UpcomingSource[] {
  if (settings.source !== undefined && !['arr', 'library'].includes(settings.source as string)) invalid();
  if (settings.ended !== undefined && typeof settings.ended !== 'boolean' || settings.mediaId !== undefined && (typeof settings.mediaId !== 'string' || !settings.mediaId)) invalid();
  const sources = settings.sources ?? (settings.source === 'library' ? ['library'] : ['arr']);
  if (!Array.isArray(sources) || !sources.length || sources.length > 3 || new Set(sources).size !== sources.length || sources.some(source => !['arr', 'library', 'external'].includes(source))) invalid();
  return sources as UpcomingSource[];
}
/** Legacy caller compatibility; combined image authorization uses upcomingSources. */
export function upcomingSource(settings: Record<string, unknown>): 'arr' | 'library' { return upcomingSources(settings)[0] === 'library' ? 'library' : 'arr'; }
export function catalogKinds(settings: Record<string, unknown>): CatalogKind[] {
  const kinds = settings.catalogKinds ?? ['series', 'anime', 'movie'];
  if (!Array.isArray(kinds) || !kinds.length || kinds.length > 3 || kinds.some(kind => !['series', 'anime', 'movie'].includes(kind)) || new Set(kinds).size !== kinds.length) invalid();
  return kinds as CatalogKind[];
}
export function externalSettings(settings: Record<string, unknown>): { mode: 'watchlist' | 'all'; watchlist: WatchEntry[]; kinds: CatalogKind[] } {
  const mode = settings.externalMode ?? 'watchlist', watchlist = settings.watchlist ?? [];
  if (!['watchlist', 'all'].includes(mode as string) || !Array.isArray(watchlist) || watchlist.length > 100) invalid();
  for (const entry of watchlist as unknown[]) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) invalid();
    const row = entry as Record<string, unknown>;
    if (!['tvmaze', 'kitsu', 'anilist', 'tmdb'].includes(row.provider as string) || typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(row.id) || !['series', 'anime', 'movie'].includes(row.kind as string) || typeof row.title !== 'string' || row.title.length > 200) invalid();
  }
  // Copy only contract fields: unrelated widget settings never reach a provider.
  return { mode: mode as 'watchlist' | 'all', watchlist: (watchlist as WatchEntry[]).map(({ provider, id, kind, title }) => ({ provider, id, kind, title })), kinds: catalogKinds(settings) };
}
export function upcomingPhase(item: Pick<UpcomingItem, 'kind' | 'episode' | 'release'>): ReleasePhase {
  return item.kind === 'episode' && (item.episode ?? 0) > 1 || item.kind === 'movie' && (item.release === 'digital' || item.release === 'physical') ? 'current' : 'announced';
}
export function followUpPhase(item: Pick<FollowUpItem, 'status' | 'episode'>): ReleasePhase {
  return item.status === 'airing' || item.status === 'upcoming' && (item.episode ?? 0) > 1 ? 'current' : 'announced';
}
export function validateIntegrationIds(settings: Record<string, unknown>): void {
  const ids = settings.integrationIds;
  if (ids !== undefined && (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) || new Set(ids).size !== ids.length)) invalid();
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
