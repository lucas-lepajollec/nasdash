import type { IntegrationInstance } from '@/lib/types';
import type { MediaCounts, MediaItem, MediaKind, MediaLibraryResponse, MediaNowPlayingResponse, MediaRecentResponse, MediaSession, MediaWatched } from '@/lib/widgetData/contracts';
import { array, number, object, string, serviceIdentity, serviceJson, serviceUrl, ServiceError } from '@/lib/widgetData/services';
import { TtlCache } from '@/lib/widgetData/cache';
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
  const sections = array((await request(instance, '/library/sections')).Directory).slice(0, 100).map(object);
  const counts: MediaCounts = {}, libraries: MediaLibraryResponse['libraries'] = [];
  // Sequential sections bound concurrent work even for servers with many libraries.
  for (const section of sections) {
    const key = string(section.key), type = string(section.type);
    if (!/^[A-Za-z0-9_-]+$/.test(key)) continue;
    const total = async (filter = '') => optionalNumber((await request(instance, `/library/sections/${encodeURIComponent(key)}/all?X-Plex-Container-Start=0&X-Plex-Container-Size=0${filter}`)).totalSize);
    const count = await total();
    const add = (field: keyof MediaCounts, value: number | undefined) => { if (value !== undefined) counts[field] = (counts[field] ?? 0) + value; };
    const kind = type === 'movie' ? 'movies' : type === 'show' ? 'series' : type === 'artist' ? 'music' : 'other';
    libraries.push({ name: string(section.title), kind, count });
    if (type === 'movie') add('movies', count);
    if (type === 'show') { add('series', count); add('episodes', await total('&type=4')); }
    if (type === 'artist') {
      add('artists', count);
      const [albums, tracks] = await Promise.all([total('&type=9'), total('&type=10')]);
      add('albums', albums); add('tracks', tracks);
    }
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
