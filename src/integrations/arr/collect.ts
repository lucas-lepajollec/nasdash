/** Shared Sonarr/Radarr/Lidarr/Prowlarr API mapping. Never return upstream objects. */
import { upcomingPhase } from '@/lib/widgetData/arr';
import type { IntegrationInstance } from '@/lib/types';
import type { ArrAppStatus, ArrType, ImportedItem, IndexersResponse, QueueItem, QueueStatus, UpcomingItem } from '@/lib/widgetData/contracts';
import { array, date, number, object, string, serviceJson, serviceUrl, ServiceError } from '@/lib/widgetData/services';

export const arrPrefix = (instance: IntegrationInstance) => instance.type === 'sonarr' || instance.type === 'radarr' ? '/api/v3' : '/api/v1';
export const arrHeaders = (instance: IntegrationInstance) => ({ 'X-Api-Key': instance.secrets?.apiKey ?? '' });
export const arrRequest = <T = unknown>(instance: IntegrationInstance, path: string) => serviceJson<T>(instance, `${arrPrefix(instance)}${path}`, { headers: arrHeaders(instance) });
const list = (value: unknown): unknown[] => { if (!Array.isArray(value)) throw new ServiceError('widgets.error.parse'); return value; };
const libraryType = (instance: IntegrationInstance) => instance.type as UpcomingItem['source'];
const kind = (instance: IntegrationInstance) => instance.type === 'sonarr' ? 'episode' as const : instance.type === 'radarr' ? 'movie' as const : 'album' as const;
const unique = (instance: IntegrationInstance, id: unknown) => `${instance.id}:${String(id ?? '')}`;
/** Only local MediaCover endpoints. Ignore remoteUrl, credentials, traversal and unrelated API paths. */
export function arrImage(instance: IntegrationInstance, images: unknown, cover: 'poster' | 'fanart'): string | undefined {
  for (const raw of array(images)) {
    const image = object(raw);
    if (image.coverType !== cover || typeof image.url !== 'string' || /[\\\x00-\x20]/.test(image.url)) continue;
    try {
      if (/(?:^|\/)\.{1,2}(?:\/|$)|%2e|%2f|%5c/i.test(image.url)) continue;
      const url = new URL(image.url, 'http://local.invalid');
      const match = /^(?:\/api\/v[13])?\/mediacover\/(\d+\/[a-z0-9_.-]+)$/i.exec(url.pathname);
      if (!match || url.username || url.password || /api.?key|token|password/i.test(url.search)) continue;
      return `${arrPrefix(instance)}/mediacover/${match[1]}${url.search}`;
    } catch { /* Invalid artwork is simply absent. */ }
  }
}
const art = (instance: IntegrationInstance, item: Record<string, unknown>, parent: Record<string, unknown>) => ({
  poster: arrImage(instance, item.images, 'poster') ?? arrImage(instance, parent.images, 'poster'),
  backdrop: arrImage(instance, item.images, 'fanart') ?? arrImage(instance, parent.images, 'fanart'),
});
export function radarrRelease(item: Record<string, unknown>, start: number, end: number): { at: number; release: 'cinema' | 'digital' | 'physical' } | undefined {
  return ([['inCinemas', 'cinema'], ['digitalRelease', 'digital'], ['physicalRelease', 'physical']] as const)
    .map(([field, release]) => ({ at: date(item[field]) ?? NaN, release })).filter(entry => entry.at >= start && entry.at <= end).sort((a, b) => a.at - b.at)[0];
}
export function toArrUpcoming(instance: IntegrationInstance, value: unknown, start: number, end: number): UpcomingItem[] {
  return list(value).flatMap(raw => {
    const item = object(raw), parent = object(instance.type === 'sonarr' ? item.series : item.artist);
    const release = instance.type === 'radarr' ? radarrRelease(item, start, end) : undefined;
    const at = release?.at ?? date(instance.type === 'sonarr' ? item.airDateUtc : item.releaseDate);
    if (at === undefined || at < start || at > end || (instance.type === 'radarr' && !release)) return [];
    const slug = instance.type === 'sonarr' ? parent.titleSlug : instance.type === 'radarr' ? item.tmdbId ?? item.titleSlug : parent.foreignArtistId;
    const segment = instance.type === 'sonarr' ? 'series' : instance.type === 'radarr' ? 'movie' : 'artist';
    return [{ phase: upcomingPhase({ kind: kind(instance), episode: number(item.episodeNumber), release: release?.release }), id: unique(instance, item.id), source: libraryType(instance), sourceName: instance.name, kind: kind(instance), title: string(item.title),
      subtitle: string(parent.title) || string(parent.artistName) || undefined,
      ...(instance.type === 'sonarr' ? { season: number(item.seasonNumber), episode: number(item.episodeNumber) } : {}),
      at, ...(release ? { release: release.release } : {}), hasFile: item.hasFile === true || number(object(item.statistics).trackFileCount) > 0,
      ...art(instance, item, parent), ...(slug !== undefined ? { link: serviceUrl(instance, `/${segment}/${encodeURIComponent(String(slug))}`) } : {}) }];
  });
}
export async function collectArrUpcoming(instance: IntegrationInstance, start: number, end: number): Promise<UpcomingItem[]> {
  const query = new URLSearchParams({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
  if (instance.type === 'sonarr') query.set('includeSeries', 'true');
  if (instance.type === 'lidarr') query.set('includeArtist', 'true');
  else query.set('unmonitored', 'false');
  return toArrUpcoming(instance, await arrRequest(instance, `/calendar?${query}`), start, end);
}
export function queueStatus(item: Record<string, unknown>): QueueStatus {
  const status = [item.status, item.trackedDownloadState, item.trackedDownloadStatus].map(value => string(value).toLowerCase()).join(' ');
  if (/failed|error/.test(status)) return 'failed';
  if (/warning/.test(status)) return 'warning';
  if (/importpending|importing/.test(status)) return 'importing';
  if (/paused/.test(status)) return 'paused';
  if (/queued|delay/.test(status)) return 'queued';
  if (/completed|imported/.test(status)) return 'completed';
  return 'downloading';
}
export function etaMs(value: unknown, completion?: unknown, now = Date.now()): number | undefined {
  const match = /^(?:(\d+)\.)?(\d+):(\d{2}):(\d{2})$/.exec(string(value));
  if (match && Number(match[3]) < 60 && Number(match[4]) < 60) return ((Number(match[1] ?? 0) * 24 + Number(match[2])) * 3600 + Number(match[3]) * 60 + Number(match[4])) * 1000;
  const at = date(completion);
  return at === undefined ? undefined : Math.max(0, at - now);
}
/** Status text is displayable; local/UNC/Windows paths and URLs are private. */
export function safeArrMessage(value: unknown, max = 160): string | undefined {
  const message = string(value).replace(/["'](?:[A-Za-z]:[\\/]|\\\\|\/)[^"'\r\n]*["']/g, '').replace(/https?:\/\/[^\s<>"']+|(?:[A-Za-z]:[\\/]|\\\\|\/)[^\s<>"']*|[^\s<>"']*[\\/][^\s<>"']+/g, '').replace(/\s+/g, ' ').trim();
  return message ? message.slice(0, max) : undefined;
}
export function toArrQueue(instance: IntegrationInstance, value: unknown): { items: QueueItem[]; total: number } {
  const body = object(value), records = list(body.records);
  return { total: typeof body.totalRecords === 'number' ? number(body.totalRecords) : records.length, items: records.map(raw => {
    const item = object(raw), media = object(instance.type === 'sonarr' ? item.episode : instance.type === 'radarr' ? item.movie : item.album);
    const parent = object(instance.type === 'sonarr' ? item.series : item.artist), size = number(item.size), left = number(item.sizeleft);
    const message = array(item.statusMessages).map(entry => array(object(entry).messages)[0]).find(value => typeof value === 'string' && value.length);
    return { id: unique(instance, item.id), source: libraryType(instance), sourceName: instance.name, kind: kind(instance), title: string(media.title) || string(item.title),
      subtitle: string(parent.title) || string(parent.artistName) || undefined,
      ...(instance.type === 'sonarr' ? { season: number(media.seasonNumber), episode: number(media.episodeNumber) } : {}),
      progress: size ? Math.min(100, Math.max(0, 100 * (size - left) / size)) : 0, status: queueStatus(item), message: safeArrMessage(message), sizeBytes: size, leftBytes: left,
      etaMs: etaMs(item.timeleft, item.estimatedCompletionTime), quality: string(object(object(item.quality).quality).name) || undefined,
      ...(item.protocol === 'torrent' || item.protocol === 'usenet' ? { protocol: item.protocol } : {}), client: string(item.downloadClient) || undefined,
      poster: art(instance, media, parent).poster };
  }) };
}
export async function collectArrQueue(instance: IntegrationInstance) {
  const include = instance.type === 'sonarr' ? 'includeSeries=true&includeEpisode=true' : instance.type === 'radarr' ? 'includeMovie=true' : 'includeArtist=true&includeAlbum=true';
  return toArrQueue(instance, await arrRequest(instance, `/queue?page=1&pageSize=50&${include}`));
}
/** The *arr's own cover of a series / movie / artist by id, when the history only carries remote URLs. */
const localCover = (instance: IntegrationInstance, id: unknown) => typeof id !== 'number' || !Number.isInteger(id) || id <= 0 ? undefined
  // Lidarr files covers per album (`album/{id}/cover.jpg`); Sonarr and Radarr per series / movie.
  : instance.type === 'lidarr' ? `${arrPrefix(instance)}/mediacover/album/${id}/cover.jpg` : `${arrPrefix(instance)}/mediacover/${id}/poster.jpg`;
export function toArrRecent(instance: IntegrationInstance, value: unknown): ImportedItem[] {
  const seen = new Map<string, ImportedItem>();
  return list(object(value).records).map(object).sort((a, b) => (date(b.date) ?? 0) - (date(a.date) ?? 0)).flatMap(item => {
    // Paged APIs accept integer filters. Lidarr calls event 3 trackFileImported.
    if (![3, 'downloadFolderImported', 'trackFileImported'].includes(item.eventType as string | number)) return [];
    const at = date(item.date);
    if (at === undefined) return [];
    const media = object(instance.type === 'sonarr' ? item.episode : instance.type === 'radarr' ? item.movie : item.album), parent = object(instance.type === 'sonarr' ? item.series : item.artist);
    // Episodes of one series and tracks of one album fold into one entry: the newest, with how many.
    const key = instance.type === 'sonarr' ? `series:${item.seriesId ?? parent.id ?? media.id}` : String(media.id ?? item.albumId ?? item.movieId ?? item.id);
    const folded = seen.get(key);
    if (folded) { folded.count = (folded.count ?? 1) + (instance.type === 'lidarr' ? 0 : 1); return []; }
    const parentId = instance.type === 'sonarr' ? item.seriesId ?? parent.id : instance.type === 'radarr' ? item.movieId ?? media.id : item.albumId ?? media.id;
    const entry: ImportedItem = { id: unique(instance, item.id), source: libraryType(instance), kind: kind(instance), title: string(media.title), subtitle: string(parent.title) || string(parent.artistName) || undefined,
      ...(instance.type === 'sonarr' ? { season: number(media.seasonNumber), episode: number(media.episodeNumber) } : {}),
      quality: string(object(object(item.quality).quality).name) || undefined, at, poster: art(instance, media, parent).poster ?? localCover(instance, parentId) };
    seen.set(key, entry);
    return [entry];
  }).slice(0, 6);
}
export async function collectArrRecent(instance: IntegrationInstance): Promise<ImportedItem[]> {
  const include = instance.type === 'sonarr' ? 'includeSeries=true&includeEpisode=true' : instance.type === 'radarr' ? 'includeMovie=true' : 'includeArtist=true&includeAlbum=true';
  return toArrRecent(instance, await arrRequest(instance, `/history?page=1&pageSize=50&sortKey=date&sortDirection=descending&eventType=3&${include}`));
}
export function prowlarrActivity(history: unknown, now = Date.now()): Pick<IndexersResponse, 'hourly' | 'lastQueryAt'> {
  const hourly = Array<number>(24).fill(0), start = now - 86400000;
  let lastQueryAt: number | undefined;
  for (const item of list(object(history).records).map(object)) {
    if (![2, 3, 'indexerQuery', 'indexerRss'].includes(item.eventType as string | number)) continue;
    const at = date(item.date);
    if (at === undefined || at < start || at > now) continue;
    hourly[Math.min(23, Math.floor((at - start) / 3600000))]++;
    lastQueryAt = Math.max(lastQueryAt ?? 0, at);
  }
  return { hourly, ...(lastQueryAt !== undefined ? { lastQueryAt } : {}) };
}
export function toProwlarrIndexers(instance: IntegrationInstance, indexers: unknown, statuses: unknown, stats: unknown, now = Date.now()): IndexersResponse {
  const statusList = list(statuses).map(object), statList = array(object(stats).indexers).map(object);
  const entries = list(indexers).map(raw => {
    const item = object(raw), status = statusList.find(status => status.indexerId === item.id), stat = statList.find(stat => stat.indexerId === item.id);
    const retryAt = date(status?.disabledTill);
    return { id: String(item.id), name: string(item.name), protocol: item.protocol === 'usenet' ? 'usenet' as const : 'torrent' as const, enabled: item.enable === true,
      healthy: !status || (retryAt !== undefined && retryAt <= now), ...(retryAt !== undefined ? { retryAt } : {}),
      // Requests: searches and RSS reads alike (an *arr mostly reads RSS).
      ...(stat ? { queries: number(stat.numberOfQueries) + number(stat.numberOfRssQueries), grabs: number(stat.numberOfGrabs), failures: number(stat.numberOfFailedQueries) + number(stat.numberOfFailedRssQueries), averageMs: number(stat.averageResponseTime) } : {}) };
  });
  return { name: instance.name, indexers: entries, totals: entries.reduce((sum, item) => ({ queries: sum.queries + (item.queries ?? 0), grabs: sum.grabs + (item.grabs ?? 0), failures: sum.failures + (item.failures ?? 0) }), { queries: 0, grabs: 0, failures: 0 }), fetchedAt: now };
}
export async function collectProwlarrIndexers(instance: IntegrationInstance): Promise<IndexersResponse> {
  const now = Date.now();
  const [indexers, statuses, stats] = await Promise.all(['/indexer', '/indexerstatus', `/indexerstats?startDate=${encodeURIComponent(new Date(now - 86400000).toISOString())}`].map(path => arrRequest(instance, path)));
  const result = toProwlarrIndexers(instance, indexers, statuses, stats, now);
  try { return { ...result, ...prowlarrActivity(await arrRequest(instance, '/history?page=1&pageSize=1000&sortKey=date&sortDirection=descending'), now) }; }
  catch { return result; /* History permissions do not affect indexer health. */ }
}
export async function collectArrStatus(instance: IntegrationInstance): Promise<ArrAppStatus> {
  const base = { id: instance.id, name: instance.name, type: instance.type as ArrType };
  try {
    const paths = instance.type === 'prowlarr' ? ['/system/status', '/health', '/indexer', '/indexerstatus'] : ['/system/status', '/health', '/queue/status', '/wanted/missing?pageSize=1', '/diskspace'];
    const [status, health, third, fourth, disks] = await Promise.all(paths.map(path => arrRequest(instance, path)));
    if (typeof object(status).version !== 'string') throw new ServiceError('widgets.error.parse');
    const common = { ...base, version: string(object(status).version), health: list(health).map(raw => { const item = object(raw); return { level: item.type === 'error' ? 'error' as const : 'warning' as const, message: safeArrMessage(item.message, 200) ?? '' }; }), online: true };
    if (instance.type === 'prowlarr') {
      const entries = toProwlarrIndexers(instance, third, fourth, {}).indexers;
      return { ...common, indexers: entries.filter(item => item.enabled).length, failingIndexers: entries.filter(item => !item.healthy).length };
    }
    const free = list(disks).map(object).filter(item => typeof item.freeSpace === 'number').map(item => number(item.freeSpace));
    return { ...common, queue: number(object(third).totalCount), missing: number(object(fourth).totalRecords), ...(free.length ? { freeBytes: Math.min(...free) } : {}) };
  } catch { return { ...base, health: [], online: false }; }
}
