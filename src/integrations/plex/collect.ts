import type { IntegrationInstance } from '@/lib/types';
import type { MediaCounts, MediaItem, MediaKind, MediaLibrary, MediaLibraryResponse, MediaNowPlayingResponse, MediaRecentResponse, MediaSession, MediaWatched, MusicAlbum, MusicTrack, MusicNowPlayingResponse, MusicRecentResponse, MusicTopResponse, MusicLibraryResponse, MusicPlaylist, MusicSearchResponse } from '@/lib/widgetData/contracts';
import { array, number, object, string, serviceIdentity, serviceJson, serviceUrl, ServiceError } from '@/lib/widgetData/services';
import { TtlCache } from '@/lib/widgetData/cache';
import { musicWeek } from '@/lib/widgetData/music';
import type { MediaSelection } from '@/lib/widgetData/media';

export const plexHeaders = (instance: IntegrationInstance) => ({ 'X-Plex-Token': instance.secrets?.token ?? '', Accept: 'application/json' });
const request = async (instance: IntegrationInstance, path: string) => {
  const data = object(await serviceJson(instance, path, { headers: plexHeaders(instance) }));
  if (!data.MediaContainer || typeof data.MediaContainer !== 'object' || Array.isArray(data.MediaContainer)) throw new ServiceError('widgets.error.parse');
  return object(data.MediaContainer);
};
const machines = new TtlCache<string | null>(3600_000);
async function machineId(instance: IntegrationInstance): Promise<string | undefined> {
  return (await machines.get(serviceIdentity(instance), async () => {
    try { return string((await request(instance, '/')).machineIdentifier) || null; }
    catch { return null; } // Optional web-app links must not break a working media response.
  })) ?? undefined;
}
const kinds = new Map<string, MediaKind>([['movie', 'movie'], ['episode', 'episode'], ['season', 'episode'], ['track', 'track'], ['album', 'album'], ['show', 'series']]);
const optionalNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
function imagePath(value: unknown, kind: 'poster' | 'backdrop'): string | undefined {
  const path = string(value);
  // Plex transcodes only a local library image, never an arbitrary URL from metadata.
  if (!/^\/library\/metadata\/[A-Za-z0-9/_-]+$/.test(path)) return undefined;
  return `/photo/:/transcode?width=${kind === 'poster' ? 320 : 960}&height=${kind === 'poster' ? 480 : 540}&minSize=1&upscale=1&url=${encodeURIComponent(path)}`;
}
export function toPlexItem(instance: IntegrationInstance, value: unknown, machine?: string): MediaItem | undefined {
  const item = object(value), id = string(item.ratingKey), kind = kinds.get(string(item.type)) ?? 'other';
  if (!id) return undefined;
  return { id, kind, title: string(item.title),
    subtitle: kind === 'episode' ? string(item.grandparentTitle) || string(item.parentTitle) || undefined : kind === 'track' ? [string(item.grandparentTitle), string(item.parentTitle)].filter(Boolean).join(' · ') || undefined : kind === 'album' ? string(item.parentTitle) || undefined : undefined,
    season: optionalNumber(item.parentIndex), episode: optionalNumber(item.index), year: optionalNumber(item.year), durationMs: optionalNumber(item.duration),
    addedAt: optionalNumber(item.addedAt) === undefined ? undefined : number(item.addedAt) * 1000,
    poster: imagePath(kind === 'episode' ? item.grandparentThumb : item.thumb, 'poster'), backdrop: imagePath(item.art, 'backdrop'),
    link: machine ? serviceUrl(instance, `/web/index.html#!/server/${encodeURIComponent(machine)}/details?key=${encodeURIComponent(`/library/metadata/${id}`)}`) : undefined,
  };
}
export function toPlexSessions(instance: IntegrationInstance, value: unknown, machine?: string): MediaSession[] {
  return array(value).slice(0, 100).flatMap(entry => {
    const source = object(entry), item = toPlexItem(instance, source, machine);
    if (!item || !['movie', 'episode', 'track'].includes(item.kind)) return [];
    const player = object(source.Player), transcode = object(source.TranscodeSession), session = object(source.Session);
    const decisions = [transcode.videoDecision, transcode.audioDecision];
    const media = object(array(source.Media)[0]), resolution = string(media.videoResolution).toLowerCase();
    return [{ id: string(session.id) || string(source.sessionKey) || item.id, item,
      user: string(object(source.User).title) || undefined, player: [string(player.product), string(player.title)].filter(Boolean).join(' · ') || undefined,
      state: player.state === 'paused' ? 'paused' as const : player.state === 'buffering' ? 'buffering' as const : 'playing' as const,
      positionMs: optionalNumber(source.viewOffset), method: decisions.includes('transcode') ? 'transcode' as const : decisions.includes('copy') ? 'stream' as const : 'direct' as const,
      quality: item.kind === 'track' ? string(media.audioCodec).toUpperCase() || undefined : resolution === '4k' ? '4K' : /^\d+$/.test(resolution) ? `${resolution}p` : resolution.toUpperCase() || undefined,
      bitrateKbps: optionalNumber(session.bandwidth),
    }];
  });
}
const identity = (instance: IntegrationInstance) => ({ server: 'plex' as const, name: instance.name, fetchedAt: Date.now() });
export async function collectPlexNowPlaying(instance: IntegrationInstance): Promise<MediaNowPlayingResponse> {
  const [data, machine] = await Promise.all([request(instance, '/status/sessions'), machineId(instance)]);
  return { ...identity(instance), sessions: toPlexSessions(instance, data.Metadata, machine) };
}
export async function collectPlexRecent(instance: IntegrationInstance, selection: MediaSelection): Promise<MediaRecentResponse> {
  const [data, machine] = await Promise.all([request(instance, `/library/recentlyAdded?X-Plex-Container-Start=0&X-Plex-Container-Size=${selection.count}`), machineId(instance)]);
  const items = array(data.Metadata).map(value => toPlexItem(instance, value, machine)).filter((item): item is MediaItem => !!item && selection.kinds.some(kind => kind === item.kind)).slice(0, selection.count);
  return { ...identity(instance), items };
}
export async function collectPlexLibrary(instance: IntegrationInstance): Promise<MediaLibraryResponse> {
  const [data, machine] = await Promise.all([request(instance, '/library/sections'), machineId(instance)]);
  const sections = array(data.Directory).slice(0, 30).map(object);
  const counts: MediaCounts = {}, libraries: MediaLibrary[] = [];
  const week = Math.floor(Date.now() / 1000) - 7 * 86400;
  // Sequential sections bound concurrent work even for servers with many libraries.
  for (const section of sections) {
    const key = string(section.key), type = string(section.type);
    if (!/^[A-Za-z0-9_-]+$/.test(key)) continue;
    const total = async (filter = '') => optionalNumber((await request(instance, `/library/sections/${encodeURIComponent(key)}/all?X-Plex-Container-Start=0&X-Plex-Container-Size=0${filter}`)).totalSize);
    const add = (field: keyof MediaCounts, value: number | undefined) => { if (value !== undefined) counts[field] = (counts[field] ?? 0) + value; };
    const kind: MediaLibrary['kind'] = type === 'movie' ? 'movies' : type === 'show' ? 'series' : type === 'artist' ? 'music' : 'other';
    try {
      // Plex lists what arrived lately per section; episodes for shows, albums for music.
      const recentType = type === 'show' ? 4 : type === 'artist' ? 9 : undefined;
      const [count, episodes, albums, tracks, added, recent] = await Promise.all([
        total(), type === 'show' ? total('&type=4') : undefined, type === 'artist' ? total('&type=9') : undefined, type === 'artist' ? total('&type=10') : undefined,
        total(`${recentType ? `&type=${recentType}` : ''}&addedAt%3E%3E=${week}`),
        request(instance, `/library/sections/${encodeURIComponent(key)}/all?sort=addedAt:desc&X-Plex-Container-Start=0&X-Plex-Container-Size=8`).catch(() => ({})),
      ]);
      if (type === 'movie') add('movies', count);
      if (type === 'show') { add('series', count); add('episodes', episodes); }
      if (type === 'artist') { add('artists', count); add('albums', albums); add('tracks', tracks); }
      const posters = (data: unknown) => array(object(data).Metadata).map(value => toPlexItem(instance, value, machine)).filter((item): item is MediaItem => !!item?.poster);
      // A random window of the section, so covers vary beyond the latest batch.
      const offset = Math.floor(Math.random() * Math.max(0, (count ?? 0) - 24));
      const random = await request(instance, `/library/sections/${encodeURIComponent(key)}/all?X-Plex-Container-Start=${offset}&X-Plex-Container-Size=24`).catch(() => ({}));
      const art = posters(recent), sample = posters(random);
      libraries.push({ name: string(section.title), kind, count, episodes, albums, tracks, added, ...(art.length ? { art } : {}), ...(sample.length ? { sample } : {}) });
    } catch { libraries.push({ name: string(section.title), kind }); /* One section that cannot be read keeps its name. */ }
  }
  return { ...identity(instance), counts, libraries };
}

/** What was watched lately (the server's play history), with account names when Plex lists them. */
export async function collectPlexHistory(instance: IntegrationInstance, limit = 8): Promise<MediaWatched[]> {
  const [data, machine] = await Promise.all([request(instance, `/status/sessions/history/all?sort=viewedAt:desc&X-Plex-Container-Start=0&X-Plex-Container-Size=${limit * 2}`), machineId(instance)]);
  let names = new Map<string, string>();
  try { names = new Map(array((await request(instance, '/accounts')).Account).map(object).map(account => [String(account.id), string(account.name)])); }
  catch { /* Names are optional. */ }
  const seen = new Set<string>();
  return array(data.Metadata).map(object).flatMap(entry => {
    const item = toPlexItem(instance, entry, machine), viewed = number(entry.viewedAt);
    if (!item || !viewed || seen.has(item.id)) return [];
    seen.add(item.id);
    return [{ item, user: names.get(String(entry.accountID)) || undefined, watchedAt: viewed * 1000 }];
  }).slice(0, limit);
}

/* Dedicated music collectors; video session/recent behaviour stays unchanged. */
const musicImage = (value: unknown) => {
  const path = string(value);
  if (/^\/playlists\/[A-Za-z0-9_-]+\/composite(?:\/[A-Za-z0-9_-]+)*$/.test(path)) return `/photo/:/transcode?width=600&height=600&minSize=1&upscale=1&url=${encodeURIComponent(path)}`;
  return imagePath(value, 'poster')?.replace('width=320&height=480', 'width=600&height=600');
};
export function toPlexMusicAlbum(instance: IntegrationInstance, value: unknown, machine?: string): MusicAlbum | undefined {
  const raw = object(value), item = toPlexItem(instance, value, machine);
  if (!item || item.kind !== 'album') return undefined;
  return { id: item.id, title: item.title, artist: item.subtitle, year: item.year, trackCount: optionalNumber(raw.leafCount), cover: musicImage(raw.thumb),
    addedAt: item.addedAt, playedAt: optionalNumber(raw.lastViewedAt) === undefined ? undefined : number(raw.lastViewedAt) * 1000, plays: optionalNumber(raw.viewCount), link: item.link };
}
export function toPlexMusicTrack(value: unknown): MusicTrack | undefined {
  const item = object(value), id = string(item.ratingKey);
  if (!id || item.type !== 'track') return undefined;
  return { id, title: string(item.title), artist: string(item.grandparentTitle) || undefined, album: string(item.parentTitle) || undefined, albumId: string(item.parentRatingKey) || undefined,
    playedAt: optionalNumber(item.viewedAt ?? item.lastViewedAt) === undefined ? undefined : number(item.viewedAt ?? item.lastViewedAt) * 1000,
    durationMs: optionalNumber(item.duration), cover: musicImage(item.parentThumb) };
}
export async function collectPlexMusicNowPlaying(instance: IntegrationInstance): Promise<MusicNowPlayingResponse> {
  const data = await request(instance, '/status/sessions');
  const sessions: MusicNowPlayingResponse['sessions'] = array(data.Metadata).slice(0, 100).flatMap(value => {
    const item = object(value), track = toPlexMusicTrack(item);
    if (!track) return [];
    const player = object(item.Player), media = object(array(item.Media)[0]);
    return [{ id: string(object(item.Session).id) || string(item.sessionKey) || track.id, track,
      user: string(object(item.User).title) || undefined, player: [string(player.product), string(player.title)].filter(Boolean).join(' · ') || undefined,
      state: player.state === 'paused' ? 'paused' as const : 'playing' as const, positionMs: optionalNumber(item.viewOffset), quality: string(media.audioCodec).toUpperCase() || undefined }];
  });
  return { ...identity(instance), sessions };
}
async function plexMusicSections(instance: IntegrationInstance) {
  const sections = array((await request(instance, '/library/sections')).Directory).map(object).filter(section => section.type === 'artist' && /^[A-Za-z0-9_-]+$/.test(string(section.key)));
  if (sections.length > 100) throw new ServiceError('widgets.error.tooLarge');
  return sections;
}
async function plexMusicAlbums(instance: IntegrationInstance, key: string, sort: string, count: number, machine?: string, offset = 0) {
  const data = await request(instance, `/library/sections/${encodeURIComponent(key)}/all?type=9&sort=album.${sort}&X-Plex-Container-Start=${offset}&X-Plex-Container-Size=${count}`);
  return array(data.Metadata).map(value => toPlexMusicAlbum(instance, value, machine)).filter((album): album is MusicAlbum => !!album);
}
async function plexMusicList(instance: IntegrationInstance, count: number, sort: 'addedAt:desc' | 'viewCount:desc' | 'lastViewedAt:desc') {
  const [sections, machine] = await Promise.all([plexMusicSections(instance), machineId(instance)]);
  const albums: MusicAlbum[] = [];
  for (const section of sections) albums.push(...await plexMusicAlbums(instance, string(section.key), sort, count, machine));
  const field = sort === 'viewCount:desc' ? 'plays' : sort === 'lastViewedAt:desc' ? 'playedAt' : 'addedAt';
  const seen = new Set<string>();
  return albums.filter(album => field === 'addedAt' || (album[field] ?? 0) > 0).sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0))
    .filter(album => !seen.has(album.id) && !!seen.add(album.id)).slice(0, count);
}
export async function collectPlexMusicRecent(instance: IntegrationInstance, count: number, content: 'added' | 'albums' | 'tracks' = 'added'): Promise<MusicRecentResponse> {
  if (content === 'albums') return { ...identity(instance), albums: await collectPlexMusicHistory(instance, count) };
  if (content === 'tracks') return { ...identity(instance), albums: [], tracks: await plexMusicTrackHistory(instance, count) };
  return { ...identity(instance), albums: await plexMusicList(instance, count, 'addedAt:desc') };
}
/** Tracks played most, from each music section's own play counts. */
export async function collectPlexMusicTopTracks(instance: IntegrationInstance, count: number): Promise<MusicTrack[]> {
  const tracks: MusicTrack[] = [];
  for (const section of await plexMusicSections(instance)) {
    const data = await request(instance, `/library/sections/${encodeURIComponent(string(section.key))}/all?type=10&sort=track.viewCount:desc&X-Plex-Container-Start=0&X-Plex-Container-Size=${count}`);
    for (const value of array(data.Metadata)) {
      const track = toPlexMusicTrack(value), plays = optionalNumber(object(value).viewCount);
      if (track && plays) tracks.push({ ...track, plays });
    }
  }
  return tracks.sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0)).slice(0, count);
}
export async function collectPlexMusicTop(instance: IntegrationInstance, count: number): Promise<MusicTopResponse> {
  return { ...identity(instance), albums: await plexMusicList(instance, count, 'viewCount:desc') };
}
export async function collectPlexMusicHistory(instance: IntegrationInstance, count = 6) {
  const tracks = await plexMusicTrackHistory(instance, Math.min(300, count * 10));
  const albums = new Map<string, MusicAlbum>();
  for (const track of tracks) if (track.albumId && !albums.has(track.albumId)) albums.set(track.albumId, { id: track.albumId, title: track.album ?? '', artist: track.artist, cover: track.cover, playedAt: track.playedAt });
  return [...albums.values()].slice(0, count);
}
export async function collectPlexMusicLibrary(instance: IntegrationInstance): Promise<MusicLibraryResponse> {
  const [sections, machine] = await Promise.all([plexMusicSections(instance), machineId(instance)]);
  const counts: { artists?: number; albums?: number; tracks?: number } = {}, genreCounts = new Map<string, number>();
  let weekCount: number | undefined = 0;
  const week: MusicAlbum[] = [];
  const complete = { artists: true, albums: true, tracks: true };
  for (const section of sections) {
    const key = encodeURIComponent(string(section.key));
    const total = async (type: number) => optionalNumber((await request(instance, `/library/sections/${key}/all?type=${type}&X-Plex-Container-Start=0&X-Plex-Container-Size=0`)).totalSize);
    const [artists, albums, tracks, added, genres] = await Promise.all([
      total(8), total(9), total(10), musicWeek((offset, size) => plexMusicAlbums(instance, string(section.key), 'addedAt:desc', size, machine, offset)),
      request(instance, `/library/sections/${key}/genre?type=9`).catch(() => ({})),
    ]);
    for (const [field, value] of Object.entries({ artists, albums, tracks }) as [keyof typeof counts, number | undefined][]) {
      if (value === undefined) complete[field] = false;
      else counts[field] = (counts[field] ?? 0) + value;
    }
    week.push(...added.week);
    weekCount = weekCount === undefined || added.weekCount === undefined ? undefined : weekCount + added.weekCount;
    const genreItems = array(object(genres).Directory).map(object);
    for (const genre of genreItems) {
      const name = string(genre.title), genreKey = string(genre.key);
      if (!name) continue;
      let count = optionalNumber(genre.count) ?? optionalNumber(genre.leafCount);
      // Normal Plex genre directories have labels/keys but no counts. Ask for
      // an album total per genre instead of inventing zero-valued statistics.
      if (count === undefined && genreKey && genreItems.length <= 20) {
        count = await request(instance, `/library/sections/${key}/all?type=9&genre=${encodeURIComponent(genreKey)}&X-Plex-Container-Start=0&X-Plex-Container-Size=0`)
          .then(data => optionalNumber(data.totalSize), () => undefined);
      }
      if (count !== undefined) genreCounts.set(name, (genreCounts.get(name) ?? 0) + count);
    }
  }
  for (const field of Object.keys(complete) as (keyof typeof counts)[]) { if (!complete[field]) delete counts[field]; else counts[field] ??= 0; }
  const genres = [...genreCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  return { ...identity(instance), ...counts, ...(genres.length ? { genres } : {}), week: week.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0)).slice(0, 8), ...(weekCount === undefined ? {} : { weekCount }) };
}

async function plexMusicTrackHistory(instance: IntegrationInstance, count: number) {
  // Plex uses numeric library type 10 for tracks (the DTO type is "track").
  const data = await request(instance, `/status/sessions/history/all?type=10&sort=viewedAt:desc&X-Plex-Container-Start=0&X-Plex-Container-Size=${count}`);
  const seen = new Set<string>();
  return array(data.Metadata).map(toPlexMusicTrack).filter((item): item is MusicTrack => !!item && item.playedAt !== undefined)
    .sort((a, b) => b.playedAt! - a.playedAt!).filter(item => !seen.has(item.id) && !!seen.add(item.id)).slice(0, count);
}
export function toPlexMusicPlaylist(value: unknown): MusicPlaylist | undefined {
  const item = object(value), id = string(item.ratingKey);
  if (!id || item.type !== 'playlist' || item.playlistType !== 'audio') return undefined;
  return { id, name: string(item.title), trackCount: optionalNumber(item.leafCount), durationMs: optionalNumber(item.duration), cover: musicImage(item.composite || item.thumb),
    changedAt: optionalNumber(item.updatedAt) === undefined ? undefined : number(item.updatedAt) * 1000 };
}
export async function collectPlexMusicPlaylists(instance: IntegrationInstance, count: number) {
  const data = await request(instance, `/playlists?playlistType=audio&X-Plex-Container-Start=0&X-Plex-Container-Size=${count}`);
  return { ...identity(instance), playlists: array(data.Metadata).map(toPlexMusicPlaylist).filter((item): item is MusicPlaylist => !!item).slice(0, count) };
}
export async function collectPlexMusicTracks(instance: IntegrationInstance, kind: 'album' | 'playlist', id: string) {
  const data = await request(instance, `${kind === 'album' ? `/library/metadata/${encodeURIComponent(id)}/children` : `/playlists/${encodeURIComponent(id)}/items`}?X-Plex-Container-Start=0&X-Plex-Container-Size=300`);
  return array(data.Metadata).map(toPlexMusicTrack).filter((item): item is MusicTrack => !!item).slice(0, 300);
}
export async function collectPlexMusicSearch(instance: IntegrationInstance, query: string): Promise<MusicSearchResponse> {
  const sections = await plexMusicSections(instance), tracks: MusicTrack[] = [], albums: MusicAlbum[] = [];
  for (const section of sections) {
    const read = async (type: number) => array((await request(instance, `/library/sections/${encodeURIComponent(string(section.key))}/all?title=${encodeURIComponent(query)}&type=${type}&X-Plex-Container-Size=20`)).Metadata);
    const [songs, releases] = await Promise.all([read(10), read(9)]);
    tracks.push(...songs.map(toPlexMusicTrack).filter((item): item is MusicTrack => !!item));
    albums.push(...releases.map(value => toPlexMusicAlbum(instance, value)).filter((item): item is MusicAlbum => !!item));
  }
  const lists = await collectPlexMusicPlaylists(instance, 1000);
  return { tracks: tracks.slice(0, 20), albums: albums.slice(0, 20), playlists: lists.playlists.filter(item => item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 20) };
}
export async function plexMusicStreamPath(instance: IntegrationInstance, id: string) {
  const data = await request(instance, `/library/metadata/${encodeURIComponent(id)}`);
  const track = array(data.Metadata).map(object).find(item => item.ratingKey === id && item.type === 'track');
  const part = string(object(array(object(array(track?.Media)[0]).Part)[0]).key);
  // No provider URL/query, arbitrary endpoint, or redirects can enter transport.
  if (!/^\/library\/parts\/[A-Za-z0-9/_%. -]+$/.test(part) || part.includes('..') || /%2[ef]/i.test(part)) throw new ServiceError('widgets.error.notFound', 404);
  return part;
}
