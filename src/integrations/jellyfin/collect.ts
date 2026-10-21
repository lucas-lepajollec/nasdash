/** Jellyfin and Emby share the media API; credentials always travel in headers. */
import type { IntegrationInstance } from '@/lib/types';
import type { MediaCounts, MediaItem, MediaKind, MediaLibrary, MediaLibraryResponse, MediaNowPlayingResponse, MediaRecentResponse, MediaServer, MediaSession, MediaWatched } from '@/lib/widgetData/contracts';
import { array, date, number, object, string, serviceJson, serviceUrl, ServiceError } from '@/lib/widgetData/services';
import type { MediaSelection } from '@/lib/widgetData/media';

export const jellyfinPrefix = (instance: IntegrationInstance) => instance.type === 'emby' ? '/emby' : '';
export const jellyfinHeaders = (instance: IntegrationInstance) => ({ 'X-Emby-Token': instance.secrets?.apiKey ?? '' });
const kinds = new Map<string, MediaKind>([['Movie', 'movie'], ['Episode', 'episode'], ['Audio', 'track'], ['MusicAlbum', 'album'], ['Series', 'series'], ['MusicVideo', 'video'], ['Video', 'video']]);
const optionalNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
const ticks = (value: unknown) => optionalNumber(value) === undefined ? undefined : number(value) / 10000;

/** Image fields remain server-only paths until the route replaces them with proxy URLs. */
export function toJellyfinItem(instance: IntegrationInstance, value: unknown): MediaItem | undefined {
  const item = object(value), id = string(item.Id);
  if (!id) return undefined;
  const kind = kinds.get(string(item.Type)) ?? 'other';
  const tags = object(item.ImageTags), prefix = jellyfinPrefix(instance);
  const posterId = kind === 'episode' && string(item.SeriesId) && string(item.SeriesPrimaryImageTag) ? string(item.SeriesId) : tags.Primary ? id : undefined;
  const backdropId = array(item.BackdropImageTags).length ? id : kind === 'episode' && string(item.ParentBackdropItemId) && array(item.ParentBackdropImageTags).length ? string(item.ParentBackdropItemId) : undefined;
  return {
    id, kind, title: string(item.Name),
    subtitle: kind === 'episode' ? string(item.SeriesName) || undefined : kind === 'track' ? [string(item.AlbumArtist), string(item.Album)].filter(Boolean).join(' · ') || undefined : kind === 'album' ? string(item.AlbumArtist) || array(item.Artists).map(string).filter(Boolean).join(' · ') || undefined : undefined,
    season: optionalNumber(item.ParentIndexNumber), episode: optionalNumber(item.IndexNumber), year: optionalNumber(item.ProductionYear),
    durationMs: ticks(item.RunTimeTicks), addedAt: date(item.DateCreated),
    poster: posterId ? `${prefix}/Items/${encodeURIComponent(posterId)}/Images/Primary?fillHeight=480&quality=90` : undefined,
    backdrop: backdropId ? `${prefix}/Items/${encodeURIComponent(backdropId)}/Images/Backdrop?fillWidth=960&quality=80` : undefined,
    link: serviceUrl(instance, instance.type === 'emby' ? `/web/index.html#!/item?id=${encodeURIComponent(id)}` : `/web/#/details?id=${encodeURIComponent(id)}`),
  };
}
export function toJellyfinSessions(instance: IntegrationInstance, value: unknown): MediaSession[] {
  if (!Array.isArray(value)) throw new ServiceError('widgets.error.parse');
  return value.slice(0, 100).flatMap(entry => {
    const session = object(entry), source = object(session.NowPlayingItem), item = toJellyfinItem(instance, source);
    if (!item) return [];
    const play = object(session.PlayState), transcode = object(session.TranscodingInfo);
    const streams = array(source.MediaStreams).map(object);
    const video = streams.find(stream => stream.Type === 'Video');
    const audio = streams.find(stream => stream.Type === 'Audio');
    const quality = item.kind === 'track' ? string(audio?.Codec).toUpperCase() || undefined : video ? `${number(video.Height) >= 2000 ? '4K' : number(video.Height) >= 1000 ? '1080p' : number(video.Height) >= 700 ? '720p' : 'SD'}${/HDR|DOVI/i.test(`${string(video.VideoRangeType)} ${string(video.VideoRange)}`) ? ' HDR' : ''}` : undefined;
    const method: MediaSession['method'] = play.PlayMethod === 'DirectPlay' ? 'direct' : play.PlayMethod === 'DirectStream' ? 'stream' : play.PlayMethod === 'Transcode' ? 'transcode' : undefined;
    return [{ id: string(session.Id) || item.id, item, user: string(session.UserName) || undefined,
      player: [string(session.Client), string(session.DeviceName)].filter(Boolean).join(' · ') || undefined,
      state: play.IsPaused === true ? 'paused' as const : 'playing' as const,
      positionMs: ticks(play.PositionTicks), method, quality,
      bitrateKbps: optionalNumber(transcode.Bitrate ?? source.Bitrate) === undefined ? undefined : number(transcode.Bitrate ?? source.Bitrate) / 1000,
    }];
  });
}
const request = (instance: IntegrationInstance, path: string) => serviceJson<unknown>(instance, `${jellyfinPrefix(instance)}${path}`, { headers: jellyfinHeaders(instance) });
const identity = (instance: IntegrationInstance) => ({ server: instance.type as MediaServer, name: instance.name, fetchedAt: Date.now() });
export async function collectJellyfinNowPlaying(instance: IntegrationInstance): Promise<MediaNowPlayingResponse> {
  return { ...identity(instance), sessions: toJellyfinSessions(instance, await request(instance, '/Sessions?ActiveWithinSeconds=960')) };
}
export async function collectJellyfinRecent(instance: IntegrationInstance, selection: MediaSelection): Promise<MediaRecentResponse> {
  const types = { movie: 'Movie', episode: 'Episode', album: 'MusicAlbum' };
  const query = `SortBy=DateCreated&SortOrder=Descending&Recursive=true&IncludeItemTypes=${selection.kinds.map(kind => types[kind]).join(',')}&Limit=${selection.count}&Fields=DateCreated,ProductionYear,SeriesId,SeriesPrimaryImageTag,ParentBackdropItemId,ParentBackdropImageTags,BackdropImageTags,ImageTags&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb`;
  const data = object(await request(instance, `/Items?${query}`));
  if (!Array.isArray(data.Items)) throw new ServiceError('widgets.error.parse');
  const items = data.Items.slice(0, selection.count).map(value => toJellyfinItem(instance, value)).filter((item): item is MediaItem => !!item && selection.kinds.some(kind => kind === item.kind));
  return { ...identity(instance), items };
}
const ITEM_FIELDS = 'DateCreated,ProductionYear,SeriesId,SeriesPrimaryImageTag,ParentBackdropItemId,ParentBackdropImageTags,BackdropImageTags,ImageTags';
const total = async (instance: IntegrationInstance, query: string) => optionalNumber(object(await request(instance, `/Items?${query}&Recursive=true&Limit=0`)).TotalRecordCount);

/** Counts, recent arrivals and newest posters of one library (folder). */
async function jellyfinLibrary(instance: IntegrationInstance, folder: Record<string, unknown>, kind: MediaLibrary['kind']): Promise<MediaLibrary> {
  const name = string(folder.Name), id = string(folder.ItemId);
  if (!id) return { name, kind };
  const parent = `ParentId=${encodeURIComponent(id)}`, since = Date.now() - 7 * 86_400_000;
  const main = { movies: 'Movie', series: 'Series', music: 'MusicArtist', books: 'Book,AudioBook', other: 'Movie,Series,Video,MusicAlbum,Book' }[kind];
  const newestTypes = kind === 'series' ? 'Episode' : kind === 'music' ? 'MusicAlbum' : main;
  const [count, episodes, albums, tracks, added, newest, random] = await Promise.all([
    kind === 'music' ? optionalNumber(object(await request(instance, `/Artists?${parent}&Limit=0`)).TotalRecordCount) : total(instance, `${parent}&IncludeItemTypes=${main}`),
    kind === 'series' ? total(instance, `${parent}&IncludeItemTypes=Episode`) : undefined,
    kind === 'music' ? total(instance, `${parent}&IncludeItemTypes=MusicAlbum`) : undefined,
    kind === 'music' ? total(instance, `${parent}&IncludeItemTypes=Audio`) : undefined,
    // Jellyfin has no "created after" filter: count the newest ones (at most 200) by date.
    request(instance, `/Items?${parent}&Recursive=true&SortBy=DateCreated&SortOrder=Descending&IncludeItemTypes=${newestTypes}&Limit=200&Fields=DateCreated&EnableImages=false`)
      .then(data => array(object(data).Items).filter(value => (date(object(value).DateCreated) ?? 0) >= since).length, () => undefined),
    // Series libraries show their series' posters, newest episode first.
    request(instance, `/Items?${parent}&Recursive=true&SortBy=${kind === 'series' ? 'DateLastContentAdded' : 'DateCreated'}&SortOrder=Descending&IncludeItemTypes=${kind === 'series' ? 'Series' : newestTypes}&Limit=8&Fields=${ITEM_FIELDS}&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop`).catch(() => ({})),
    // Any titles of the library, so covers vary beyond the latest batch added together.
    request(instance, `/Items?${parent}&Recursive=true&SortBy=Random&IncludeItemTypes=${kind === 'series' ? 'Series' : newestTypes}&Limit=24&Fields=${ITEM_FIELDS}&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop`).catch(() => ({})),
  ]);
  const posters = (data: unknown) => array(object(data).Items).map(value => toJellyfinItem(instance, value)).filter((item): item is MediaItem => !!item?.poster);
  const art = posters(newest), sample = posters(random);
  return { name, kind, count, episodes, albums, tracks, added, ...(art.length ? { art } : {}), ...(sample.length ? { sample } : {}) };
}
export async function collectJellyfinLibrary(instance: IntegrationInstance): Promise<MediaLibraryResponse> {
  const [totals, folders] = await Promise.all([request(instance, '/Items/Counts'), request(instance, '/Library/VirtualFolders')]);
  if (!Array.isArray(folders) || !totals || typeof totals !== 'object' || Array.isArray(totals)) throw new ServiceError('widgets.error.parse');
  const fields: Record<keyof MediaCounts, string> = { movies: 'MovieCount', series: 'SeriesCount', episodes: 'EpisodeCount', artists: 'ArtistCount', albums: 'AlbumCount', tracks: 'SongCount', books: 'BookCount' };
  const counts: MediaCounts = {};
  for (const [key, field] of Object.entries(fields)) {
    const value = optionalNumber(object(totals)[field]);
    if (value !== undefined) counts[key as keyof MediaCounts] = value;
  }
  const libraryKinds = new Map<string, MediaLibrary['kind']>([['movies', 'movies'], ['tvshows', 'series'], ['music', 'music'], ['books', 'books']]);
  const libraries: MediaLibrary[] = [];
  // A few libraries at a time; one that cannot be read keeps its name.
  for (const folder of folders.slice(0, 30).map(object).filter(folder => string(folder.CollectionType) !== 'boxsets' && string(folder.CollectionType) !== 'playlists')) {
    const kind = libraryKinds.get(string(folder.CollectionType)) ?? 'other';
    libraries.push(await jellyfinLibrary(instance, folder, kind).catch(() => ({ name: string(folder.Name), kind })));
  }
  return { ...identity(instance), counts, libraries };
}

/**
 * What was watched lately on the server: each account's titles by last
 * played date (Jellyfin and Emby keep it per account), merged, newest first.
 */
export async function collectJellyfinHistory(instance: IntegrationInstance, limit = 8): Promise<MediaWatched[]> {
  const users = array(await request(instance, '/Users')).slice(0, 10).map(object).filter(user => string(user.Id));
  const fields = ITEM_FIELDS;
  const lists = await Promise.all(users.map(async user => {
    try {
      const data = object(await request(instance, `/Users/${encodeURIComponent(string(user.Id))}/Items?SortBy=DatePlayed&SortOrder=Descending&Recursive=true&IncludeItemTypes=Movie,Episode&Limit=${limit}&Fields=${fields}&EnableUserData=true&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb`));
      return array(data.Items).flatMap(value => {
        const data = object(object(value).UserData), watchedAt = date(data.LastPlayedDate);
        const item = toJellyfinItem(instance, value);
        if (!item || !watchedAt) return [];
        // A finished title reads 100; a started one, its position.
        const position = ticks(data.PlaybackPositionTicks), progress = data.Played === true && !position ? 100 : position && item.durationMs ? Math.min(99, Math.round(position / item.durationMs * 100)) : undefined;
        return [{ item, user: string(user.Name) || undefined, watchedAt, progress, remainingMs: position && item.durationMs && progress !== 100 ? Math.max(0, item.durationMs - position) : undefined }];
      });
    } catch { return []; /* One account that cannot be read does not hide the others. */ }
  }));
  const seen = new Set<string>();
  return lists.flat().sort((a, b) => (b.watchedAt ?? 0) - (a.watchedAt ?? 0)).filter(entry => !seen.has(entry.item.id) && !!seen.add(entry.item.id)).slice(0, limit);
}
