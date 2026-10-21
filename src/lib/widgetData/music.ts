/** Shared music validation, image membership and offline fictional data. */
import type { IntegrationInstance } from '@/lib/types';
import type { MusicAlbum, MusicLibraryResponse, MusicNowPlayingResponse, MusicRecentResponse, MusicServer, MusicTopResponse, MusicTrack } from './contracts';
import { proxyMediaItem } from './media';
import { ServiceError } from './services';

export const MUSIC_WIDGET_TYPES = ['music-nowplaying', 'music-recent', 'music-library', 'music-top'] as const;
export type MusicWidgetType = typeof MUSIC_WIDGET_TYPES[number];
export const optionalMusicNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
export function musicCount(settings: Record<string, unknown>, top = false) {
  const count = settings.count ?? (top ? 6 : 12);
  if (typeof count !== 'number' || !Number.isInteger(count) || count < (top ? 3 : 4) || count > (top ? 20 : 40)) throw new ServiceError('widgets.error.invalidSettings', 400);
  return count;
}
export function proxyMusicItem<T extends MusicAlbum | MusicTrack>(instance: IntegrationInstance, widgetId: string, value: T, admin: boolean, draft?: Record<string, unknown>): T {
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
    track: { id: 'demo-track', title: 'The Glass Meridian', artist: artists[0], album: titles[0], durationMs: 234000, cover: 'demo:music:0' },
    next: [{ id: 'demo-next', title: 'Aerial Seeds', artist: artists[0], album: titles[0], durationMs: 198000, cover: 'demo:music:0' }] }] };
}
export function demoMusicRecent(instance: IntegrationInstance, count: number): MusicRecentResponse { return { ...identity(instance), albums: demoMusicAlbums(count) }; }
export function demoMusicTop(instance: IntegrationInstance, count: number): MusicTopResponse { return { ...identity(instance), albums: demoMusicAlbums(count) }; }
export function demoMusicLibrary(instance: IntegrationInstance): MusicLibraryResponse {
  return { ...identity(instance), artists: 96, albums: 210, tracks: 2640, durationMs: 601920000, genres: [{ name: 'Ambient', count: 72 }, { name: 'Jazz', count: 46 }, { name: 'Electronic', count: 39 }], week: demoMusicAlbums(7), weekCount: 7 };
}
