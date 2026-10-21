/** Subsonic-compatible servers. Authenticated URLs exist only inside the transport. */
import { createHash, randomBytes } from 'node:crypto';
import type { IntegrationInstance } from '@/lib/types';
import type { MusicAlbum, MusicLibraryResponse, MusicNowPlayingResponse, MusicRecentResponse, MusicTopResponse, MusicTrack, MusicPlaylist, MusicSearchResponse } from '@/lib/widgetData/contracts';
import { array, assertStatus, date, number, object, serviceBytes, serviceIdentity, ServiceError, string } from '@/lib/widgetData/services';
import { TtlCache } from '@/lib/widgetData/cache';
import { musicWeek, optionalMusicNumber } from '@/lib/widgetData/music';

type Endpoint = 'ping' | 'getNowPlaying' | 'getAlbumList2' | 'getScanStatus' | 'getGenres' | 'getArtists' | 'getPlayQueue' | 'getPlaylists' | 'getPlaylist' | 'getAlbum' | 'search3';
/** Never put this path in membership, a response or an error. No redirects, including same-origin ones. */
export function navidromeAuthenticatedPath(instance: IntegrationInstance, path: string) {
  const url = new URL(path, 'http://subsonic.invalid');
  const salt = randomBytes(16).toString('hex');
  const token = createHash('md5').update((instance.secrets?.password ?? '') + salt).digest('hex');
  for (const [key, value] of Object.entries({ u: instance.settings.username ?? '', t: token, s: salt, v: '1.16.1', c: 'NasDash', f: 'json' })) url.searchParams.set(key, value);
  return `${url.pathname}?${url.searchParams}`;
}
async function navidromeReply(instance: IntegrationInstance, endpoint: Endpoint, params: Record<string, string> = {}) {
  const answer = await serviceBytes(instance, navidromeAuthenticatedPath(instance, `/rest/${endpoint}?${new URLSearchParams(params)}`), {}, 2 * 1024 * 1024);
  assertStatus(answer.status);
  let value: unknown;
  try { value = JSON.parse(answer.bytes.toString('utf8')); } catch { throw new ServiceError('widgets.error.parse'); }
  const response = object(object(value)['subsonic-response']);
  if (response.status === 'failed') {
    const code = number(object(response.error).code);
    // Provider messages can echo the URL or credentials; never forward them.
    throw new ServiceError(code === 40 || code === 50 ? 'integrations.error.authentication' : 'widgets.error.http');
  }
  if (response.status !== 'ok') throw new ServiceError('widgets.error.parse');
  const count = answer.headers?.['x-total-count'];
  const total = typeof count === 'string' && /^\d+$/.test(count) && Number.isSafeInteger(Number(count)) ? Number(count) : undefined;
  return { response, total };
}
export async function navidromeRequest(instance: IntegrationInstance, endpoint: Endpoint, params: Record<string, string> = {}) {
  return (await navidromeReply(instance, endpoint, params)).response;
}
/** Only a previously returned, credential-free getCoverArt path can reach this transport. */
export function navidromeCoverBytes(instance: IntegrationInstance, path: string) {
  if (!/^\/rest\/getCoverArt\?id=[^&]+&size=600$/.test(path)) throw new ServiceError('widgets.error.notFound', 404);
  return serviceBytes(instance, navidromeAuthenticatedPath(instance, path), {}, 8 * 1024 * 1024);
}
const cover = (id: unknown) => string(id) ? `/rest/getCoverArt?${new URLSearchParams({ id: string(id), size: '600' })}` : undefined;
const identity = (instance: IntegrationInstance) => ({ server: 'navidrome' as const, name: instance.name, fetchedAt: Date.now() });
export function toNavidromeTrack(value: unknown): MusicTrack | undefined {
  const item = object(value), id = string(item.id);
  if (!id) return undefined;
  return { id, title: string(item.title), artist: string(item.artist) || undefined, album: string(item.album) || undefined, albumId: string(item.albumId) || undefined, playedAt: date(item.played),
    durationMs: optionalMusicNumber(item.duration) === undefined ? undefined : number(item.duration) * 1000, cover: cover(item.coverArt) };
}
export function toNavidromeAlbum(value: unknown): MusicAlbum | undefined {
  const item = object(value), id = string(item.id);
  if (!id) return undefined;
  return { id, title: string(item.name) || string(item.title), artist: string(item.artist) || undefined, year: optionalMusicNumber(item.year),
    trackCount: optionalMusicNumber(item.songCount), cover: cover(item.coverArt), addedAt: date(item.created), playedAt: date(item.played), plays: optionalMusicNumber(item.playCount) };
}
async function albumList(instance: IntegrationInstance, type: 'newest' | 'frequent' | 'recent', size: number, offset = 0, onTotal?: (total: number) => void) {
  const { response: data, total } = await navidromeReply(instance, 'getAlbumList2', { type, size: String(size), offset: String(offset) });
  if (total !== undefined) onTotal?.(total);
  const list = object(data.albumList2);
  if (!data.albumList2 || list.album !== undefined && !Array.isArray(list.album)) throw new ServiceError('widgets.error.parse');
  return array(list.album).map(toNavidromeAlbum).filter((album): album is MusicAlbum => !!album);
}
/** Navidrome's own API (its web player's) keeps when each track was played; Subsonic does not. Tokens kept an hour. */
const nativeTokens = new TtlCache<string>(3_600_000);
async function navidromeNative(instance: IntegrationInstance, path: string): Promise<unknown> {
  const key = serviceIdentity(instance);
  const token = await nativeTokens.get(key, async () => {
    const login = await serviceBytes(instance, '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: instance.settings.username ?? '', password: instance.secrets?.password ?? '' }) }, 65536);
    if (login.status === 404 || login.status === 405) throw new ServiceError('widgets.music.error.noTrackHistory', 422);
    assertStatus(login.status);
    let data: unknown;
    try { data = JSON.parse(login.bytes.toString('utf8')); } catch { throw new ServiceError('widgets.error.parse'); }
    const value = object(data).token;
    // JWTs may exceed the display-string helper's 512-character limit.
    if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,8192}$/.test(value)) throw new ServiceError('widgets.music.error.noTrackHistory', 422);
    return value;
  });
  const answer = await serviceBytes(instance, path, { headers: { 'x-nd-authorization': `Bearer ${token}` } }, 2 * 1024 * 1024);
  if (answer.status === 401 || answer.status === 403) nativeTokens.delete(key);
  assertStatus(answer.status);
  try { return JSON.parse(answer.bytes.toString('utf8')); } catch { throw new ServiceError('widgets.error.parse'); }
}
/** Tracks played lately, newest first (Navidrome only). */
export async function navidromePlayedTracks(instance: IntegrationInstance, count: number): Promise<MusicTrack[]> {
  const data = await navidromeNative(instance, `/api/song?${new URLSearchParams({ _start: '0', _end: String(count), _sort: 'play_date', _order: 'DESC' })}`);
  if (!Array.isArray(data)) throw new ServiceError('widgets.error.parse');
  return data.map(object).filter(item => date(item.playDate) !== undefined).map(item => ({
    id: string(item.id), title: string(item.title), artist: string(item.artist) || undefined, album: string(item.album) || undefined, albumId: string(item.albumId) || undefined,
    durationMs: optionalMusicNumber(item.duration) === undefined ? undefined : number(item.duration) * 1000, playedAt: date(item.playDate), cover: cover(item.albumId || item.id),
  })).filter(track => !!track.id);
}
/** Tracks played most (Navidrome only: Subsonic counts albums, not tracks). */
export async function collectNavidromeTopTracks(instance: IntegrationInstance, count: number): Promise<MusicTrack[]> {
  const data = await navidromeNative(instance, `/api/song?${new URLSearchParams({ _start: '0', _end: String(count), _sort: 'play_count', _order: 'DESC' })}`);
  if (!Array.isArray(data)) throw new ServiceError('widgets.error.parse');
  return data.map(object).filter(item => number(item.playCount) > 0).map(item => ({
    id: string(item.id), title: string(item.title), artist: string(item.artist) || undefined, album: string(item.album) || undefined, albumId: string(item.albumId) || undefined,
    durationMs: optionalMusicNumber(item.duration) === undefined ? undefined : number(item.duration) * 1000, plays: number(item.playCount), cover: cover(item.albumId || item.id),
  })).filter(track => !!track.id);
}
/** Forget native sessions (tests). */
export function clearNavidromeSessions() { nativeTokens.clear(); }
export async function collectNavidromeRecent(instance: IntegrationInstance, count: number, content: 'added' | 'albums' | 'tracks' = 'added'): Promise<MusicRecentResponse> {
  // Subsonic exposes recent albums, not track history. Expanding those albums
  // would mislabel unplayed tracks as played, so report the unsupported mode.
  if (content === 'tracks') return { ...identity(instance), albums: [], tracks: await navidromePlayedTracks(instance, count) };
  return { ...identity(instance), albums: await albumList(instance, content === 'albums' ? 'recent' : 'newest', count) };
}
export async function collectNavidromeTop(instance: IntegrationInstance, count: number): Promise<MusicTopResponse> {
  return { ...identity(instance), albums: await albumList(instance, 'frequent', count) };
}
export function collectNavidromeHistory(instance: IntegrationInstance, count = 6) { return albumList(instance, 'recent', count); }
export async function collectNavidromeNowPlaying(instance: IntegrationInstance): Promise<MusicNowPlayingResponse> {
  const data = await navidromeRequest(instance, 'getNowPlaying');
  if (!data.nowPlaying || object(data.nowPlaying).entry !== undefined && !Array.isArray(object(data.nowPlaying).entry)) throw new ServiceError('widgets.error.parse');
  const entries = array(object(data.nowPlaying).entry).slice(0, 100).map(object);
  let queue: Record<string, unknown> = {};
  const own = entries.filter(entry => entry.username === instance.settings.username);
  if (own.length === 1) {
    try { queue = object((await navidromeRequest(instance, 'getPlayQueue')).playQueue); } catch { /* Not all clients save a queue. */ }
  }
  const sessions: MusicNowPlayingResponse['sessions'] = entries.flatMap((entry, index) => {
    const track = toNavidromeTrack(entry);
    if (!track) return [];
    // A saved queue may be stale: match both the account and current track, and
    // only attach it to one session (multiple clients for that user are ambiguous).
    const same = own.length === 1 && entry === own[0] && queue.current === track.id;
    const list = same ? array(queue.entry).map(toNavidromeTrack).filter((item): item is MusicTrack => !!item) : [];
    const at = list.findIndex(item => item.id === track.id), next = at < 0 ? [] : list.slice(at + 1, at + 6);
    return [{ id: `${track.id}:${index}`, track, user: string(entry.username) || undefined, player: string(entry.playerName) || undefined,
      state: 'playing' as const, ...(next.length ? { next } : {}) }];
  });
  return { ...identity(instance), sessions };
}
export async function collectNavidromeLibrary(instance: IntegrationInstance): Promise<MusicLibraryResponse> {
  let totalAlbums: number | undefined;
  const [scan, genresData, artistsData, week] = await Promise.all([
    navidromeRequest(instance, 'getScanStatus').catch(() => ({})), navidromeRequest(instance, 'getGenres'), navidromeRequest(instance, 'getArtists'),
    musicWeek((offset, size) => albumList(instance, 'newest', size, offset, total => { totalAlbums = total; })),
  ]);
  if (!artistsData.artists || !genresData.genres) throw new ServiceError('widgets.error.parse');
  const artists = array(object(artistsData.artists).index).flatMap(index => array(object(index).artist)).map(object);
  const unique = [...new Map(artists.filter(artist => string(artist.id)).map(artist => [string(artist.id), artist])).values()];
  const genres = array(object(genresData.genres).genre).map(object).flatMap(genre => {
    const count = optionalMusicNumber(genre.albumCount) ?? optionalMusicNumber(genre.songCount), name = string(genre.value);
    return name && count !== undefined ? [{ name, count }] : [];
  }).sort((a, b) => b.count - a.count).slice(0, 8);
  const status = object(object(scan).scanStatus);
  // Navidrome supplies x-total-count on the week read. Other Subsonic servers
  // need the bounded unique-ID fallback. Artist album counts are not summed:
  // multi-artist releases can occur under more than one artist. Count unique IDs.
  const albums = new Set<string>();
  let complete = false;
  for (let offset = 0; totalAlbums === undefined && offset < 10000; offset += 500) {
    const list = await albumList(instance, 'newest', 500, offset);
    list.forEach(album => albums.add(album.id));
    if (list.length < 500) { complete = true; break; }
  }
  return { ...identity(instance), artists: unique.length, ...(totalAlbums !== undefined ? { albums: totalAlbums } : complete ? { albums: albums.size } : {}),
    tracks: status.scanning === false ? optionalMusicNumber(status.count) : undefined, genres, ...week };
}

export function toNavidromePlaylist(value: unknown): MusicPlaylist | undefined {
  const item = object(value), id = string(item.id);
  if (!id) return undefined;
  return { id, name: string(item.name), trackCount: optionalMusicNumber(item.songCount),
    durationMs: optionalMusicNumber(item.duration) === undefined ? undefined : number(item.duration) * 1000,
    owner: string(item.owner) || undefined, changedAt: date(item.changed), cover: cover(item.coverArt) };
}
/** Empty lists may omit entries, but a missing endpoint envelope is malformed. */
function musicEntries(data: Record<string, unknown>, envelope: string, field: string) {
  const container = object(data[envelope]), entries = container[field];
  if (!data[envelope] || entries !== undefined && !Array.isArray(entries)) throw new ServiceError('widgets.error.parse');
  return array(entries);
}
export async function collectNavidromePlaylists(instance: IntegrationInstance, count: number) {
  const data = await navidromeRequest(instance, 'getPlaylists');
  return { ...identity(instance), playlists: musicEntries(data, 'playlists', 'playlist').map(toNavidromePlaylist).filter((item): item is MusicPlaylist => !!item).slice(0, count) };
}
export async function collectNavidromeTracks(instance: IntegrationInstance, kind: 'album' | 'playlist', id: string) {
  const data = await navidromeRequest(instance, kind === 'album' ? 'getAlbum' : 'getPlaylist', { id });
  return musicEntries(data, kind, kind === 'album' ? 'song' : 'entry').slice(0, 300).map(toNavidromeTrack).filter((item): item is MusicTrack => !!item);
}
export async function collectNavidromeSearch(instance: IntegrationInstance, query: string): Promise<MusicSearchResponse> {
  const [data, lists] = await Promise.all([navidromeRequest(instance, 'search3', { query, artistCount: '0', albumCount: '20', songCount: '20' }), collectNavidromePlaylists(instance, 1000)]);
  const songs = musicEntries(data, 'searchResult3', 'song'), albums = musicEntries(data, 'searchResult3', 'album');
  // search3 has no playlist results; search the accessible playlist names locally.
  return { tracks: songs.map(toNavidromeTrack).filter((item): item is MusicTrack => !!item).slice(0, 20),
    albums: albums.map(toNavidromeAlbum).filter((item): item is MusicAlbum => !!item).slice(0, 20),
    playlists: lists.playlists.filter(item => item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 20) };
}
