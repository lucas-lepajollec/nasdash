import { mapBounded } from '@/lib/widgetData/concurrency';
/** Jellyfin and Emby share the media API; credentials always travel in headers. */
import type { IntegrationInstance } from '@/lib/types';
import type { MediaCounts, MediaItem, MediaKind, MediaLibrary, MediaLibraryResponse, MediaNowPlayingResponse, MediaRecentResponse, MediaServer, MediaSession, MediaWatched, MusicAlbum, MusicTrack, MusicNowPlayingResponse, MusicRecentResponse, MusicTopResponse, MusicLibraryResponse, MusicPlaylist, MusicSearchResponse, MusicControlRequest } from '@/lib/widgetData/contracts';
import { array, date, number, object, string, serviceJson, serviceUrl, ServiceError } from '@/lib/widgetData/services';
import { musicWeek } from '@/lib/widgetData/music';
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
const request = (instance: IntegrationInstance, path: string, options: { method?: 'POST' } = {}) => serviceJson<unknown>(instance, `${jellyfinPrefix(instance)}${path}`, { ...options, headers: jellyfinHeaders(instance) });
/** Current Emby uses a paged query; older Emby and Jellyfin return a bare array. */
async function jellyfinUsers(instance: IntegrationInstance): Promise<unknown[]> {
  if (instance.type === 'emby') {
    try {
      const data = object(await request(instance, '/Users/Query?Limit=101'));
      if (!Array.isArray(data.Items)) throw new ServiceError('widgets.error.parse');
      if (number(data.TotalRecordCount) > 100 || data.Items.length > 100) throw new ServiceError('widgets.error.tooLarge');
      return data.Items;
    } catch (error) {
      if (!(error instanceof ServiceError) || error.parameters?.status !== 404) throw error;
    }
  }
  const data = await request(instance, '/Users');
  if (!Array.isArray(data)) throw new ServiceError('widgets.error.parse');
  if (data.length > 100) throw new ServiceError('widgets.error.tooLarge');
  return data;
}
const identity = (instance: IntegrationInstance) => ({ server: instance.type as MediaServer, name: instance.name, fetchedAt: Date.now() });
const sessionsPath = (instance: IntegrationInstance) => instance.type === 'emby' ? '/Sessions' : '/Sessions?ActiveWithinSeconds=960';
async function jellyfinFolders(instance: IntegrationInstance): Promise<unknown> {
  if (instance.type === 'emby') {
    try {
      const data = object(await request(instance, '/Library/VirtualFolders/Query?Limit=30'));
      if (!Array.isArray(data.Items)) throw new ServiceError('widgets.error.parse');
      return data.Items;
    } catch (error) {
      if (!(error instanceof ServiceError) || error.parameters?.status !== 404) throw error;
    }
  }
  return request(instance, '/Library/VirtualFolders');
}
export async function collectJellyfinNowPlaying(instance: IntegrationInstance): Promise<MediaNowPlayingResponse> {
  return { ...identity(instance), sessions: toJellyfinSessions(instance, await request(instance, sessionsPath(instance))) };
}
export async function collectJellyfinRecent(instance: IntegrationInstance, selection: MediaSelection): Promise<MediaRecentResponse> {
  const types = { movie: 'Movie', episode: 'Episode', album: 'MusicAlbum' };
  const query = `SortBy=DateCreated&SortOrder=Descending&Recursive=true&IncludeItemTypes=${selection.kinds.map(kind => types[kind]).join(',')}&Limit=${selection.count}&Fields=DateCreated&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb`;
  const data = object(await request(instance, `/Items?${query}`));
  if (!Array.isArray(data.Items)) throw new ServiceError('widgets.error.parse');
  const items = data.Items.slice(0, selection.count).map(value => toJellyfinItem(instance, value)).filter((item): item is MediaItem => !!item && selection.kinds.some(kind => kind === item.kind));
  return { ...identity(instance), items };
}
// Image tags, series identifiers and production year are ordinary DTO fields.
const ITEM_FIELDS = 'DateCreated';
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
  const [totals, folders] = await Promise.all([request(instance, '/Items/Counts'), jellyfinFolders(instance)]);
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
  const users = (await jellyfinUsers(instance)).slice(0, 10).map(object).filter(user => string(user.Id));
  const fields = ITEM_FIELDS;
  const lists = await mapBounded(users, 4, async user => {
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
  });
  const seen = new Set<string>();
  return lists.flat().sort((a, b) => (b.watchedAt ?? 0) - (a.watchedAt ?? 0)).filter(entry => !seen.has(entry.item.id) && !!seen.add(entry.item.id)).slice(0, limit);
}

/* Music reads are separate from the historical video collectors above. */
export function toJellyfinMusicAlbum(instance: IntegrationInstance, value: unknown): MusicAlbum | undefined {
  const raw = object(value), item = toJellyfinItem(instance, value);
  if (!item || item.kind !== 'album') return undefined;
  return { id: item.id, title: item.title, artist: item.subtitle, year: item.year, cover: item.poster, link: item.link,
    trackCount: optionalNumber(raw.ChildCount), addedAt: item.addedAt, playedAt: date(object(raw.UserData).LastPlayedDate), plays: optionalNumber(object(raw.UserData).PlayCount) };
}
export function toJellyfinMusicTrack(instance: IntegrationInstance, value: unknown): MusicTrack | undefined {
  const raw = object(value), item = toJellyfinItem(instance, value);
  if (!item || item.kind !== 'track') return undefined;
  return { id: item.id, title: item.title, artist: array(raw.Artists).map(string).filter(Boolean).join(' · ') || string(raw.AlbumArtist) || undefined,
    album: string(raw.Album) || undefined, albumId: string(raw.AlbumId) || undefined, playedAt: date(object(raw.UserData).LastPlayedDate), durationMs: item.durationMs,
    cover: string(raw.AlbumId) ? `${jellyfinPrefix(instance)}/Items/${encodeURIComponent(string(raw.AlbumId))}/Images/Primary?maxWidth=600&quality=90` : undefined };
}
export async function collectJellyfinMusicNowPlaying(instance: IntegrationInstance): Promise<MusicNowPlayingResponse> {
  const data = await request(instance, sessionsPath(instance));
  if (!Array.isArray(data)) throw new ServiceError('widgets.error.parse');
  const sessions: MusicNowPlayingResponse['sessions'] = (await mapBounded(data.slice(0, 100), 4, async value => {
    const source = object(value), raw = object(source.NowPlayingItem), track = toJellyfinMusicTrack(instance, raw);
    if (!track) return [];
    const play = object(source.PlayState), stream = array(raw.MediaStreams).map(object).find(stream => stream.Type === 'Audio');
    let next: MusicTrack[] = [];
    let queue = array(source.NowPlayingQueue).map(object);
    if (instance.type === 'emby' && !queue.length && string(source.Id)) {
      try {
        const result = object(await request(instance, `/Sessions/PlayQueue?Id=${encodeURIComponent(string(source.Id))}`));
        queue = array(result.Items).map(object);
      } catch { /* Older servers and clients may not expose a saved queue. */ }
    }
    // PlaylistItemId disambiguates repeated tracks in a session queue.
    const at = string(source.PlaylistItemId) ? queue.findIndex(item => item.PlaylistItemId === source.PlaylistItemId) : queue.findIndex(item => item.Id === track.id);
    const ids = at < 0 ? [] : queue.slice(at + 1, at + 6).map(item => string(item.Id)).filter(Boolean);
    if (ids.length) {
      try {
        const items = object(await request(instance, `/Items?Ids=${encodeURIComponent(ids.join(','))}&IncludeItemTypes=Audio&Fields=MediaSources&Limit=5`));
        const mapped = new Map(array(items.Items).map(value => toJellyfinMusicTrack(instance, value)).filter((item): item is MusicTrack => !!item).map(item => [item.id, item]));
        next = ids.flatMap(id => mapped.get(id) ? [mapped.get(id)!] : []);
      } catch { /* Queue enrichment must not hide the active track. */ }
    }
    return [{ id: string(source.Id) || track.id, track, canControl: source.SupportsRemoteControl === true,
      ...(next.length ? { next } : {}), user: string(source.UserName) || undefined,
      player: [string(source.Client), string(source.DeviceName)].filter(Boolean).join(' · ') || undefined,
      state: play.IsPaused === true ? 'paused' as const : 'playing' as const, positionMs: ticks(play.PositionTicks), quality: string(stream?.Codec).toUpperCase() || undefined }];
  })).flat();
  return { ...identity(instance), sessions };
}
// ProductionYear and ImageTags are ordinary DTO fields, not ItemFields enum values.
const MUSIC_FIELDS = 'DateCreated,ChildCount';
function musicItems(data: unknown) {
  const items = object(data).Items;
  if (!Array.isArray(items)) throw new ServiceError('widgets.error.parse');
  return items;
}
async function jellyfinMusicAlbums(instance: IntegrationInstance, sort: 'DateCreated' | 'PlayCount' | 'DatePlayed', limit: number, offset = 0, user?: string) {
  const data = object(await request(instance, `${user ? `/Users/${encodeURIComponent(user)}/Items` : '/Items'}?IncludeItemTypes=MusicAlbum&Recursive=true&SortBy=${sort}&SortOrder=Descending&Limit=${limit}&StartIndex=${offset}&Fields=${MUSIC_FIELDS}&EnableUserData=true&ImageTypeLimit=1&EnableImageTypes=Primary`));
  if (!Array.isArray(data.Items)) throw new ServiceError('widgets.error.parse');
  return data.Items.map(value => toJellyfinMusicAlbum(instance, value)).filter((album): album is MusicAlbum => !!album);
}
export async function collectJellyfinMusicRecent(instance: IntegrationInstance, count: number, content: 'added' | 'albums' | 'tracks' = 'added'): Promise<MusicRecentResponse> {
  if (content === 'albums') return { ...identity(instance), albums: await collectJellyfinMusicHistory(instance, count) };
  if (content === 'tracks') {
    const tracks: MusicTrack[] = [];
    for (const user of await jellyfinMusicUsers(instance)) {
      const data = object(await request(instance, `/Users/${encodeURIComponent(user)}/Items?IncludeItemTypes=Audio&Recursive=true&SortBy=DatePlayed&SortOrder=Descending&EnableUserData=true&Limit=${count}`));
      tracks.push(...musicItems(data).map(value => toJellyfinMusicTrack(instance, value)).filter((item): item is MusicTrack => !!item && item.playedAt !== undefined));
    }
    const seen = new Set<string>();
    return { ...identity(instance), albums: [], tracks: tracks.sort((a, b) => b.playedAt! - a.playedAt!).filter(item => !seen.has(item.id) && !!seen.add(item.id)).slice(0, count) };
  }
  return { ...identity(instance), albums: (await jellyfinMusicAlbums(instance, 'DateCreated', count)).slice(0, count) };
}
async function jellyfinMusicUsers(instance: IntegrationInstance) {
  const data = await jellyfinUsers(instance);
  return data.map(object).map(user => string(user.Id)).filter(Boolean);
}
/** Album UserData.PlayCount is per account, not a BaseItemDto property.
 * Sum all accessible accounts, paging through positive counts so merging
 * per-user top-N lists cannot undercount an album's other listeners. */
/** Tracks played most, all accounts summed (each account's own play counts). */
export async function collectJellyfinMusicTopTracks(instance: IntegrationInstance, count: number): Promise<MusicTrack[]> {
  const merged = new Map<string, MusicTrack>();
  for (const user of await jellyfinMusicUsers(instance)) {
    const data = object(await request(instance, `/Users/${encodeURIComponent(user)}/Items?IncludeItemTypes=Audio&Recursive=true&SortBy=PlayCount&SortOrder=Descending&EnableUserData=true&Limit=${Math.min(200, count * 4)}`));
    for (const value of musicItems(data)) {
      const track = toJellyfinMusicTrack(instance, value), plays = number(object(object(value).UserData).PlayCount);
      if (track && plays > 0) merged.set(track.id, { ...track, plays: (merged.get(track.id)?.plays ?? 0) + plays });
    }
  }
  return [...merged.values()].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0)).slice(0, count);
}
export async function collectJellyfinMusicTop(instance: IntegrationInstance, count: number): Promise<MusicTopResponse> {
  const merged = new Map<string, MusicAlbum>();
  let requests = 0;
  for (const user of await jellyfinMusicUsers(instance)) {
    const seen = new Set<string>();
    for (let offset = 0; ; offset += 200) {
      if (++requests > 50) throw new ServiceError('widgets.error.tooLarge');
      const list = await jellyfinMusicAlbums(instance, 'PlayCount', 200, offset, user);
      for (const album of list) if ((album.plays ?? 0) > 0 && !seen.has(album.id)) {
        seen.add(album.id);
        merged.set(album.id, { ...album, plays: (merged.get(album.id)?.plays ?? 0) + album.plays! });
      }
      if (list.length < 200 || list.some(album => !album.plays)) break;
    }
  }
  return { ...identity(instance), albums: [...merged.values()].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0)).slice(0, count) };
}
export async function collectJellyfinMusicHistory(instance: IntegrationInstance, count = 6): Promise<MusicAlbum[]> {
  const albums: MusicAlbum[] = [];
  for (const user of await jellyfinMusicUsers(instance)) {
    albums.push(...(await jellyfinMusicAlbums(instance, 'DatePlayed', count, 0, user)).filter(album => album.playedAt !== undefined));
  }
  const seen = new Set<string>();
  return albums.sort((a, b) => b.playedAt! - a.playedAt!).filter(album => !seen.has(album.id) && !!seen.add(album.id)).slice(0, count);
}
export async function collectJellyfinMusicLibrary(instance: IntegrationInstance): Promise<MusicLibraryResponse> {
  const [counts, week, genreData] = await Promise.all([
    request(instance, '/Items/Counts'), musicWeek((offset, size) => jellyfinMusicAlbums(instance, 'DateCreated', size, offset)),
    request(instance, '/MusicGenres?IncludeItemTypes=MusicAlbum&Recursive=true&Fields=ItemCounts&Limit=1000')
      .catch(() => request(instance, '/Genres?IncludeItemTypes=MusicAlbum&Recursive=true&Fields=ItemCounts&Limit=1000')).catch(() => ({})),
  ]);
  const data = object(counts);
  const genreItems = array(object(genreData).Items).map(object), genreCounts: { name: string; count: number }[] = [];
  for (const genre of genreItems) {
    const name = string(genre.Name);
    if (!name) continue;
    let count = optionalNumber(genre.AlbumCount) ?? optionalNumber(genre.SongCount);
    // Some versions ignore Fields=ItemCounts on genre DTOs. A count-only
    // album query is cheap; cap fan-out on unusually large genre catalogues.
    if (count === undefined && genreItems.length <= 20) count = await total(instance, `IncludeItemTypes=MusicAlbum&Genres=${encodeURIComponent(name)}`).catch(() => undefined);
    if (count !== undefined) genreCounts.push({ name, count });
  }
  const genres = genreCounts.sort((a, b) => b.count - a.count).slice(0, 8);
  // Audio duration requires traversing the entire track library; leave it absent.
  return { ...identity(instance), artists: optionalNumber(data.ArtistCount), albums: optionalNumber(data.AlbumCount), tracks: optionalNumber(data.SongCount), ...(genres.length ? { genres } : {}), ...week };
}

export function toJellyfinMusicPlaylist(instance: IntegrationInstance, value: unknown): MusicPlaylist | undefined {
  const raw = object(value), id = string(raw.Id);
  if (!id || raw.Type !== 'Playlist' || raw.MediaType && raw.MediaType !== 'Audio') return undefined;
  return { id, name: string(raw.Name), trackCount: optionalNumber(raw.ChildCount), durationMs: ticks(raw.RunTimeTicks), changedAt: date(instance.type === 'emby' ? raw.DateModified : raw.DateLastSaved),
    cover: object(raw.ImageTags).Primary ? `${jellyfinPrefix(instance)}/Items/${encodeURIComponent(id)}/Images/Primary?maxWidth=600&quality=90` : undefined };
}
export async function collectJellyfinMusicPlaylists(instance: IntegrationInstance, count: number) {
  const data = object(await request(instance, `/Items?IncludeItemTypes=Playlist&MediaTypes=Audio&Recursive=true&Fields=ChildCount&Limit=${count}`));
  return { ...identity(instance), playlists: musicItems(data).map(value => toJellyfinMusicPlaylist(instance, value)).filter((item): item is MusicPlaylist => !!item).slice(0, count) };
}
// Which account opened a playlist last: a playlist belongs to its owner (and whom it is shared with).
const playlistUsers = new Map<string, string>();
export async function collectJellyfinMusicTracks(instance: IntegrationInstance, kind: 'album' | 'playlist', id: string) {
  const users = await jellyfinMusicUsers(instance);
  const read = async (user: string | undefined) => {
    const params = new URLSearchParams({ IncludeItemTypes: 'Audio', Recursive: 'true', Limit: '300', ...(user ? { UserId: user } : {}) });
    if (kind === 'album') { params.set('ParentId', id); params.set('SortBy', 'ParentIndexNumber,IndexNumber'); params.set('SortOrder', 'Ascending'); }
    const data = object(await request(instance, `${kind === 'album' ? '/Items' : `/Playlists/${encodeURIComponent(id)}/Items`}?${params}`));
    return musicItems(data).map(value => toJellyfinMusicTrack(instance, value)).filter((item): item is MusicTrack => !!item).slice(0, 300);
  };
  if (kind === 'album') return read(users[0]);
  // A playlist answers only its owner and the accounts it is shared with: try the accounts
  // (the one that worked last first) until one may read it, at most ten.
  const key = `${instance.id}:${id}`, known = playlistUsers.get(key);
  const order = [...(known && users.includes(known) ? [known] : []), ...users.filter(user => user !== known)].slice(0, 10);
  let failure: unknown;
  for (const user of order.length ? order : [undefined]) {
    try {
      const tracks = await read(user);
      if (user) { playlistUsers.delete(key); playlistUsers.set(key, user); if (playlistUsers.size > 500) playlistUsers.delete(playlistUsers.keys().next().value!); }
      return tracks;
    } catch (error) {
      if (!(error instanceof ServiceError) || ![401, 403, 404].includes(Number(error.parameters?.status))) throw error;
      failure = error;
    }
  }
  throw failure;
}
export async function collectJellyfinMusicSearch(instance: IntegrationInstance, query: string): Promise<MusicSearchResponse> {
  // Separate bounded queries give each category its own 20-result allowance.
  const read = async (type: string) => musicItems(await request(instance, `/Items?searchTerm=${encodeURIComponent(query)}&IncludeItemTypes=${type}&MediaTypes=Audio&Recursive=true&Fields=ChildCount&Limit=20`));
  const [tracks, albums, playlists] = await Promise.all([read('Audio'), read('MusicAlbum'), read('Playlist')]);
  return { tracks: tracks.map(value => toJellyfinMusicTrack(instance, value)).filter((item): item is MusicTrack => !!item).slice(0, 20),
    albums: albums.map(value => toJellyfinMusicAlbum(instance, value)).filter((item): item is MusicAlbum => !!item).slice(0, 20),
    playlists: playlists.map(value => toJellyfinMusicPlaylist(instance, value)).filter((item): item is MusicPlaylist => !!item).slice(0, 20) };
}
export async function jellyfinMusicStreamPath(instance: IntegrationInstance, id: string) {
  // Emby's universal endpoint takes Container in the path; Jellyfin exposes
  // its negotiation parameters in the query instead.
  if (instance.type === 'emby') return `/emby/Audio/${encodeURIComponent(id)}/universal.mp3?DeviceId=NasDash`;
  const user = (await jellyfinMusicUsers(instance))[0];
  if (!user) throw new ServiceError('widgets.error.notFound', 404);
  return `${jellyfinPrefix(instance)}/Audio/${encodeURIComponent(id)}/universal?${new URLSearchParams({ UserId: user, Container: 'mp3,flac,aac,m4a,ogg,opus', AudioCodec: 'aac', TranscodingContainer: 'mp3' })}`;
}
export async function controlJellyfinMusic(instance: IntegrationInstance, sessionId: string, action: MusicControlRequest['action']) {
  const current = await collectJellyfinMusicNowPlaying(instance);
  if (!current.sessions.some(session => session.id === sessionId && session.canControl)) throw new ServiceError('widgets.music.error.controlUnavailable', 403);
  const commands = { playpause: 'PlayPause', next: 'NextTrack', previous: 'PreviousTrack' };
  await serviceJson(instance, `${jellyfinPrefix(instance)}/Sessions/${encodeURIComponent(sessionId)}/Playing/${commands[action]}`, {
    method: 'POST', headers: jellyfinHeaders(instance), json: { Command: commands[action] },
  });
}
