/** Subsonic-compatible servers. Authenticated URLs exist only inside the transport. */
import { createHash, randomBytes } from 'node:crypto';
import type { IntegrationInstance } from '@/lib/types';
import type { MusicAlbum, MusicLibraryResponse, MusicNowPlayingResponse, MusicRecentResponse, MusicTopResponse, MusicTrack } from '@/lib/widgetData/contracts';
import { array, assertStatus, date, number, object, serviceBytes, ServiceError, string } from '@/lib/widgetData/services';
import { musicWeek, optionalMusicNumber } from '@/lib/widgetData/music';

type Endpoint = 'ping' | 'getNowPlaying' | 'getAlbumList2' | 'getScanStatus' | 'getGenres' | 'getArtists' | 'getPlayQueue';
/** Never put this path in membership, a response or an error. No redirects, including same-origin ones. */
function authenticatedPath(instance: IntegrationInstance, path: string) {
  const url = new URL(path, 'http://subsonic.invalid');
  const salt = randomBytes(16).toString('hex');
  const token = createHash('md5').update((instance.secrets?.password ?? '') + salt).digest('hex');
  for (const [key, value] of Object.entries({ u: instance.settings.username ?? '', t: token, s: salt, v: '1.16.1', c: 'NasDash', f: 'json' })) url.searchParams.set(key, value);
  return `${url.pathname}?${url.searchParams}`;
}
export async function navidromeRequest(instance: IntegrationInstance, endpoint: Endpoint, params: Record<string, string> = {}) {
  const answer = await serviceBytes(instance, authenticatedPath(instance, `/rest/${endpoint}?${new URLSearchParams(params)}`), {}, 2 * 1024 * 1024);
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
  return response;
}
/** Only a previously returned, credential-free getCoverArt path can reach this transport. */
export function navidromeCoverBytes(instance: IntegrationInstance, path: string) {
  if (!/^\/rest\/getCoverArt\?id=[^&]+&size=600$/.test(path)) throw new ServiceError('widgets.error.notFound', 404);
  return serviceBytes(instance, authenticatedPath(instance, path), {}, 8 * 1024 * 1024);
}
const cover = (id: unknown) => string(id) ? `/rest/getCoverArt?${new URLSearchParams({ id: string(id), size: '600' })}` : undefined;
const identity = (instance: IntegrationInstance) => ({ server: 'navidrome' as const, name: instance.name, fetchedAt: Date.now() });
export function toNavidromeTrack(value: unknown): MusicTrack | undefined {
  const item = object(value), id = string(item.id);
  if (!id) return undefined;
  return { id, title: string(item.title), artist: string(item.artist) || undefined, album: string(item.album) || undefined,
    durationMs: optionalMusicNumber(item.duration) === undefined ? undefined : number(item.duration) * 1000, cover: cover(item.coverArt) };
}
export function toNavidromeAlbum(value: unknown): MusicAlbum | undefined {
  const item = object(value), id = string(item.id);
  if (!id) return undefined;
  return { id, title: string(item.name) || string(item.title), artist: string(item.artist) || undefined, year: optionalMusicNumber(item.year),
    trackCount: optionalMusicNumber(item.songCount), cover: cover(item.coverArt), addedAt: date(item.created), playedAt: date(item.played), plays: optionalMusicNumber(item.playCount) };
}
async function albumList(instance: IntegrationInstance, type: 'newest' | 'frequent' | 'recent', size: number, offset = 0) {
  const data = await navidromeRequest(instance, 'getAlbumList2', { type, size: String(size), offset: String(offset) });
  const list = object(data.albumList2);
  if (!data.albumList2 || list.album !== undefined && !Array.isArray(list.album)) throw new ServiceError('widgets.error.parse');
  return array(list.album).map(toNavidromeAlbum).filter((album): album is MusicAlbum => !!album);
}
export async function collectNavidromeRecent(instance: IntegrationInstance, count: number): Promise<MusicRecentResponse> {
  return { ...identity(instance), albums: await albumList(instance, 'newest', count) };
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
  const [scan, genresData, artistsData, week] = await Promise.all([
    navidromeRequest(instance, 'getScanStatus').catch(() => ({})), navidromeRequest(instance, 'getGenres'), navidromeRequest(instance, 'getArtists'),
    musicWeek((offset, size) => albumList(instance, 'newest', size, offset)),
  ]);
  if (!artistsData.artists || !genresData.genres) throw new ServiceError('widgets.error.parse');
  const artists = array(object(artistsData.artists).index).flatMap(index => array(object(index).artist)).map(object);
  const unique = [...new Map(artists.filter(artist => string(artist.id)).map(artist => [string(artist.id), artist])).values()];
  const genres = array(object(genresData.genres).genre).map(object).flatMap(genre => {
    const count = optionalMusicNumber(genre.albumCount) ?? optionalMusicNumber(genre.songCount), name = string(genre.value);
    return name && count !== undefined ? [{ name, count }] : [];
  }).sort((a, b) => b.count - a.count).slice(0, 8);
  const status = object(object(scan).scanStatus);
  // The standard API has no album total. Artist album counts are not summed:
  // multi-artist releases can occur under more than one artist. Count unique IDs.
  const albums = new Set<string>();
  let complete = false;
  for (let offset = 0; offset < 10000; offset += 500) {
    const list = await albumList(instance, 'newest', 500, offset);
    list.forEach(album => albums.add(album.id));
    if (list.length < 500) { complete = true; break; }
  }
  return { ...identity(instance), artists: unique.length, ...(complete ? { albums: albums.size } : {}),
    tracks: status.scanning === false ? optionalMusicNumber(status.count) : undefined, genres, ...week };
}
