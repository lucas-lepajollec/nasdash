/** Server-only media settings, image membership, and fictional demo data. */
import { createHash } from 'node:crypto';
import type { IntegrationInstance } from '@/lib/types';
import { MEDIA_IMAGE_ROUTE, type MediaItem, type MediaLibraryResponse, type MediaNowPlayingResponse, type MediaRecentResponse, type MediaServer } from './contracts';
import { serviceIdentity, ServiceError } from './services';

export const MEDIA_WIDGET_TYPES = ['media-nowplaying', 'media-recent', 'media-library'] as const;
export type MediaWidgetType = typeof MEDIA_WIDGET_TYPES[number];
export interface MediaSelection { kinds: ('movie' | 'episode' | 'album')[]; count: number }
export function mediaSelection(settings: Record<string, unknown>): MediaSelection {
  const kinds = settings.kinds === undefined ? ['movie', 'episode', 'album'] : settings.kinds;
  const count = settings.count === undefined ? 16 : settings.count;
  if (!Array.isArray(kinds) || !kinds.length || kinds.length > 3 || kinds.some(kind => !['movie', 'episode', 'album'].includes(kind)) || new Set(kinds).size !== kinds.length || typeof count !== 'number' || !Number.isInteger(count) || count < 4 || count > 40) throw new ServiceError('widgets.error.invalidSettings', 400);
  return { kinds: kinds as MediaSelection['kinds'], count };
}
export function mediaShowUsers(settings: Record<string, unknown>): boolean {
  if (settings.showUsers !== undefined && typeof settings.showUsers !== 'boolean') throw new ServiceError('widgets.error.invalidSettings', 400);
  return settings.showUsers === true;
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
/** Draft previews cannot grant image access to the widget's saved settings. */
function scope(widgetId: string, draft?: Record<string, unknown>) {
  return draft ? `${widgetId}:preview:${hash(JSON.stringify(draft))}` : widgetId;
}
const membership = new Map<string, { path: string; kind: 'poster' | 'backdrop'; expires: number }>();
export function knownMediaImage(instance: IntegrationInstance, widgetId: string, key: string, kind: 'poster' | 'backdrop', draft?: Record<string, unknown>): string | undefined {
  const id = `${serviceIdentity(instance)}:${scope(widgetId, draft)}:${key}`;
  const value = membership.get(id);
  if (!value || value.expires <= Date.now()) { membership.delete(id); return undefined; }
  return value.kind === kind ? value.path : undefined;
}
export function proxyMediaItem(instance: IntegrationInstance, widgetId: string, item: MediaItem, admin: boolean, draft?: Record<string, unknown>): MediaItem {
  const { link, poster, backdrop, ...safe } = item;
  const image = (path: string | undefined, kind: 'poster' | 'backdrop') => {
    if (!path) return undefined;
    const key = hash(JSON.stringify([kind, path]));
    const id = `${serviceIdentity(instance)}:${scope(widgetId, draft)}:${key}`;
    membership.delete(id);
    membership.set(id, { path, kind, expires: Date.now() + 86400_000 });
    while (membership.size > 20_000) membership.delete(membership.keys().next().value!);
    const query = new URLSearchParams({ widgetId, id: key, kind });
    if (draft) query.set('draft', JSON.stringify(draft));
    return `${MEDIA_IMAGE_ROUTE}?${query}`;
  };
  return { ...safe, ...(admin && link ? { link } : {}), poster: image(poster, 'poster'), backdrop: image(backdrop, 'backdrop') };
}
const identity = (instance: IntegrationInstance) => ({ server: instance.type as MediaServer, name: instance.name, fetchedAt: Date.UTC(2026, 0, 15, 12) });
const demoItem = (n: number): MediaItem => {
  const kind = (['movie', 'episode', 'album'] as const)[n % 3];
  const titles = ['The Quiet Orbit', 'Harbor Lights', 'The Lantern Archive', 'A Map of Rain', 'The Copper Lighthouse', 'Signals from the Garden'];
  return { id: `demo-${n}`, kind, title: `${titles[n % titles.length]}${n >= titles.length ? ` ${Math.floor(n / titles.length) + 1}` : ''}`,
    subtitle: kind === 'episode' ? 'Harbor Lights' : kind === 'album' ? 'The Paper Satellites' : undefined,
    ...(kind === 'episode' ? { season: 2, episode: 5 + n % 4 } : {}),
    year: 2025, durationMs: kind === 'movie' ? 6840000 : 2640000, addedAt: Date.UTC(2026, 0, 15) - n * 86400000,
    poster: `demo:poster:${n}`, backdrop: `demo:backdrop:${n}` };
};
export function demoMediaNowPlaying(instance: IntegrationInstance): MediaNowPlayingResponse {
  return { ...identity(instance), sessions: [
    { id: 'demo-session-1', item: demoItem(0), user: 'Alex', player: 'Media Web · Living room', state: 'playing', positionMs: 2130000, method: 'direct', quality: '4K HDR', bitrateKbps: 24000 },
    { id: 'demo-session-2', item: demoItem(1), user: 'Robin', player: 'Media TV · Den', state: 'paused', positionMs: 930000, method: 'transcode', quality: '1080p', bitrateKbps: 8000 },
  ] };
}
export function demoMediaRecent(instance: IntegrationInstance, selection: MediaSelection): MediaRecentResponse {
  return { ...identity(instance), items: Array.from({ length: 120 }, (_, n) => demoItem(n)).filter(item => selection.kinds.some(kind => kind === item.kind)).slice(0, selection.count) };
}
export function demoMediaLibrary(instance: IntegrationInstance): MediaLibraryResponse {
  return { ...identity(instance), counts: { movies: 284, series: 42, episodes: 1280, artists: 96, albums: 210, tracks: 2640 },
    libraries: [{ name: 'Evening Cinema', kind: 'movies', count: 284 }, { name: 'Stories by the Harbor', kind: 'series', count: 42 }, { name: 'Paper Satellites Radio', kind: 'music', count: 96 }] };
}
/** Title-free, deterministic local artwork; untrusted text is never interpolated into SVG. */
export function demoMediaArt(id: string, kind: 'poster' | 'backdrop'): string {
  const hue = parseInt(hash(id).slice(0, 6), 16) % 360;
  const [w, h] = kind === 'poster' ? [320, 480] : [960, 540];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="hsl(${hue} 42% 12%)"/><stop offset="1" stop-color="hsl(${(hue + 55) % 360} 50% 38%)"/></linearGradient></defs><path fill="url(#g)" d="M0 0h${w}v${h}H0z"/><circle cx="${w * .68}" cy="${h * .32}" r="${w * .19}" fill="#fff1cc" opacity=".7"/><circle cx="${w * .62}" cy="${h * .3}" r="${w * .19}" fill="hsl(${hue} 35% 21%)"/><path d="M0 ${h * .8}L${w * .42} ${h * .48}L${w} ${h * .87}V${h}H0z" fill="#101d30" opacity=".7"/><path d="M0 ${h * .91}Q${w * .5} ${h * .65} ${w} ${h * .9}V${h}H0z" fill="#091423"/></svg>`;
}
