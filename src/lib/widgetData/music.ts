/** Shared music validation, image membership and offline fictional data. */
import { createHash } from 'node:crypto';
import type { IntegrationInstance } from '@/lib/types';
import type { MusicAlbum, MusicLibraryResponse, MusicNowPlayingResponse, MusicRecentResponse, MusicServer, MusicTopResponse, MusicTrack, MusicPlaylist, MusicSearchResponse } from './contracts';
import { proxyMediaItem } from './media';
import { serviceIdentity, ServiceError } from './services';

export const MUSIC_WIDGET_TYPES = ['music-nowplaying', 'music-recent', 'music-library', 'music-top', 'music-playlists'] as const;
export type MusicWidgetType = typeof MUSIC_WIDGET_TYPES[number];
export const optionalMusicNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
export function musicCount(settings: Record<string, unknown>, top = false) {
  const count = settings.count ?? (top ? 6 : 12);
  if (typeof count !== 'number' || !Number.isInteger(count) || count < (top ? 3 : 4) || count > (top ? 20 : 40)) throw new ServiceError('widgets.error.invalidSettings', 400);
  return count;
}
/** Playlist owners follow the same opt-in account-name policy as sessions. */
export function musicPlaylistPrivacy(item: MusicPlaylist, showUsers: boolean): MusicPlaylist {
  const { owner, ...safe } = item;
  return { ...safe, ...(showUsers && owner ? { owner } : {}) };
}
export function proxyMusicItem<T extends MusicAlbum | MusicTrack | MusicPlaylist>(instance: IntegrationInstance, widgetId: string, value: T, admin: boolean, draft?: Record<string, unknown>): T {
  const { cover, ...item } = value;
  const { poster, ...safe } = proxyMediaItem(instance, widgetId, { ...item, poster: cover }, admin, draft);
  return { ...safe, ...(poster ? { cover: poster } : {}) } as unknown as T;
}
/** Read until the seven-day boundary; never label a truncated window as a total. */
export async function musicWeek(read: (offset: number, size: number) => Promise<MusicAlbum[]>) {
  const since = Date.now() - 7 * 86400000, seen = new Set<string>(), week: MusicAlbum[] = [];
  for (let offset = 0; offset < 4000; offset += 200) {
    const list = await read(offset, 200);
    for (const album of list) if (album.addedAt !== undefined && album.addedAt >= since && !seen.has(album.id)) { seen.add(album.id); week.push(album); }
    if (list.some(album => album.addedAt === undefined)) break;
    if (list.length < 200 || list.some(album => album.addedAt !== undefined && album.addedAt < since)) return { week: week.slice(0, 8), weekCount: week.length };
  }
  return { week: week.slice(0, 8) };
}
const identity = (instance: IntegrationInstance) => ({ server: instance.type as MusicServer, name: instance.name, fetchedAt: Date.UTC(2026, 0, 15, 12) });
const artists = ['The Paper Satellites', 'Mira Vale', 'Cedar Echo', 'The Lantern Ensemble'];
const titles = ['Signals from the Garden', 'Tidal Letters', 'Copper Skies', 'A Small Observatory', 'Cloud Atlas Radio', 'Night Orchard'];
export const demoMusicAlbums = (count: number): MusicAlbum[] => Array.from({ length: count }, (_, n) => ({
  id: `demo-music-${n}`, title: titles[n % titles.length] + (n >= titles.length ? ` ${Math.floor(n / titles.length) + 1}` : ''), artist: artists[n % artists.length],
  year: 2025, trackCount: 8 + n % 5, cover: `demo:music:${n}`, addedAt: Date.UTC(2026, 0, 15, 12) - n * 86400000, playedAt: Date.UTC(2026, 0, 15, 11) - n * 3600000, plays: 82 - n,
}));
export function demoMusicNowPlaying(instance: IntegrationInstance): MusicNowPlayingResponse {
  return { ...identity(instance), sessions: [{ id: 'demo-music-session', user: 'Alex', player: 'Music Web · Study', state: 'playing', positionMs: 74000, quality: 'FLAC',
    canControl: instance.type === 'jellyfin' || instance.type === 'emby',
    track: { id: 'demo-track', albumId: 'demo-music-0', title: 'The Glass Meridian', artist: artists[0], album: titles[0], durationMs: 234000, cover: 'demo:music:0' },
    next: [{ id: 'demo-next', title: 'Aerial Seeds', artist: artists[0], album: titles[0], durationMs: 198000, cover: 'demo:music:0' }] }] };
}
export function demoMusicRecent(instance: IntegrationInstance, count: number, content: 'added' | 'albums' | 'tracks' = 'added'): MusicRecentResponse { return { ...identity(instance), albums: content === 'tracks' ? [] : demoMusicAlbums(count), ...(content === 'tracks' ? { tracks: demoMusicTracks(count) } : {}) }; }
export function demoMusicTop(instance: IntegrationInstance, count: number): MusicTopResponse { return { ...identity(instance), albums: demoMusicAlbums(count) }; }
export function demoMusicLibrary(instance: IntegrationInstance): MusicLibraryResponse {
  return { ...identity(instance), artists: 96, albums: 210, tracks: 2640, durationMs: 601920000, genres: [{ name: 'Ambient', count: 72 }, { name: 'Jazz', count: 46 }, { name: 'Electronic', count: 39 }], week: demoMusicAlbums(7), weekCount: 7 };
}

const tracks = new Map<string, number>();
function trackScope(instance: IntegrationInstance, widgetId: string, id: string, draft?: Record<string, unknown>) {
  return JSON.stringify([serviceIdentity(instance), widgetId, draft ? createHash('sha256').update(JSON.stringify(draft)).digest('hex') : '', id]);
}
export function rememberMusicTrack(instance: IntegrationInstance, widgetId: string, id: string, draft?: Record<string, unknown>) {
  const key = trackScope(instance, widgetId, id, draft);
  tracks.delete(key); tracks.set(key, Date.now() + 86400000);
  while (tracks.size > 20000) tracks.delete(tracks.keys().next().value!);
}
export function knownMusicTrack(instance: IntegrationInstance, widgetId: string, id: string, draft?: Record<string, unknown>) {
  const key = trackScope(instance, widgetId, id, draft), until = tracks.get(key);
  if (!until || until <= Date.now()) { tracks.delete(key); return false; }
  return true;
}
export function musicContent(settings: Record<string, unknown>): 'added' | 'albums' | 'tracks' | 'pages' {
  const content = settings.content ?? 'added';
  if (content !== 'added' && content !== 'albums' && content !== 'tracks' && content !== 'pages') throw new ServiceError('widgets.error.invalidSettings', 400);
  return content;
}
export const MUSIC_PAGES = ['added', 'albums', 'tracks'] as const;
/** The pages of the `pages` content, in the chosen order (default: all three). */
export function musicPages(settings: Record<string, unknown>): (typeof MUSIC_PAGES[number])[] {
  const pages = settings.pages ?? [...MUSIC_PAGES];
  if (!Array.isArray(pages) || !pages.length || pages.some(page => !(MUSIC_PAGES as readonly unknown[]).includes(page)) || new Set(pages).size !== pages.length) throw new ServiceError('widgets.error.invalidSettings', 400);
  return pages as (typeof MUSIC_PAGES[number])[];
}
export const demoMusicTracks = (count = 8): MusicTrack[] => Array.from({ length: count }, (_, n) => ({ id: `demo-song-${n}`, title: ['The Glass Meridian', 'Aerial Seeds', 'Soft Geometry', 'Moonlit Maps'][n % 4], artist: artists[n % 4], album: titles[n % 6], albumId: `demo-music-${n % 6}`, durationMs: 198000, playedAt: Date.UTC(2026, 0, 15, 11) - n * 3600000, cover: `demo:music:${n % 6}` }));
export const demoMusicPlaylists = (instance: IntegrationInstance, count: number) => ({ ...identity(instance), playlists: Array.from({ length: Math.min(count, 4) }, (_, n): MusicPlaylist => ({ id: `demo-playlist-${n}`, name: ['Quiet mornings', 'Night signals', 'Garden radio', 'Copper evenings'][n], trackCount: 8, durationMs: 1584000, cover: `demo:music:${n}`, owner: 'Alex' })) });
export function demoMusicSearch(instance: IntegrationInstance, query: string): MusicSearchResponse {
  const matches = (value: string) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  return { tracks: demoMusicTracks(20).filter(item => matches([item.title, item.artist, item.album].join(' '))), albums: demoMusicAlbums(20).filter(item => matches([item.title, item.artist].join(' '))), playlists: demoMusicPlaylists(instance, 4).playlists.filter(item => matches(item.name)) };
}
/** 250 ms of generated mono PCM silence: no network or shipped media file. */
export function demoMusicAudio(range: string | null): Response {
  const wav = Buffer.alloc(44 + 4000);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(4000, 40);
  const headers = new Headers({ 'Cache-Control': 'private, no-store', 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' });
  let start = 0, end = wav.length - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || !match[1] && !match[2]) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${wav.length}`, 'Cache-Control': 'private, no-store' } });
    start = match[1] ? Number(match[1]) : Math.max(0, wav.length - Number(match[2]));
    end = match[1] && match[2] ? Math.min(end, Number(match[2])) : end;
    if (start > end || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${wav.length}`, 'Cache-Control': 'private, no-store' } });
    headers.set('Content-Range', `bytes ${start}-${end}/${wav.length}`);
  }
  const data = new Uint8Array(wav.subarray(start, end + 1)); headers.set('Content-Length', String(data.length));
  return new Response(data, { status: range ? 206 : 200, headers });
}
