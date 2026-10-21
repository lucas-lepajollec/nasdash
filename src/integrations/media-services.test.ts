import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
import type { MediaItem } from '@/lib/widgetData/contracts';
import jellyfin from './jellyfin/samples/service.json';
import plex from './plex/samples/service.json';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn() }));
import { serviceJson, ServiceError } from '@/lib/widgetData/services';
import { collectJellyfinLibrary, collectJellyfinNowPlaying, collectJellyfinRecent, toJellyfinItem, toJellyfinSessions } from './jellyfin/collect';
import { collectPlexLibrary, collectPlexNowPlaying, collectPlexRecent, toPlexItem, toPlexSessions } from './plex/collect';
let serial = 0;
const instance = (type: string): IntegrationInstance => ({ id: `media-${++serial}`, type, name: 'Fictional Media', settings: { url: 'http://media.example.com' }, secrets: { apiKey: 'fake-key', token: 'fake-token' } });
const json = vi.mocked(serviceJson);
beforeEach(() => vi.resetAllMocks());

describe('Jellyfin and Emby', () => {
  it('maps kinds, subtitles, quality, methods, ticks, bitrates, and episode artwork', () => {
    const source = instance('jellyfin');
    const sessions = toJellyfinSessions(source, jellyfin.sessions);
    expect(sessions[0]).toMatchObject({ user: 'Alex', player: 'Jellyfin Web · Living room', state: 'playing', method: 'direct', quality: '4K HDR', positionMs: 2130000, bitrateKbps: 24000,
      item: { kind: 'movie', title: 'The Quiet Orbit', year: 2025, durationMs: 6840000, addedAt: Date.parse('2026-01-15T12:00:00Z') } });
    expect(sessions[1]).toMatchObject({ state: 'paused', method: 'transcode', quality: '1080p', positionMs: 930000, bitrateKbps: 8000,
      item: { kind: 'episode', subtitle: 'Harbor Lights', season: 2, episode: 5, poster: '/Items/series-1/Images/Primary?fillHeight=480&quality=90', backdrop: '/Items/series-1/Images/Backdrop?fillWidth=960&quality=80' } });
    expect(sessions[2]).toMatchObject({ method: 'stream', quality: 'FLAC', item: { kind: 'track', subtitle: 'The Paper Satellites · Signals from the Garden', durationMs: 180000 } });
    expect(toJellyfinItem(source, jellyfin.recent.Items[2])).toMatchObject({ kind: 'album', subtitle: 'The Paper Satellites' });
    expect(toJellyfinSessions(source, [{ Id: 'idle' }])).toEqual([]);
    expect(() => toJellyfinSessions(source, {})).toThrow(ServiceError);
  });
  it.each([[2160, '4K'], [1080, '1080p'], [720, '720p'], [480, 'SD']])('maps video height %s to %s', (height, quality) => {
    const source = { ...jellyfin.sessions[0].NowPlayingItem, MediaStreams: [{ Type: 'Video', Height: height, VideoRange: 'SDR' }] };
    expect(toJellyfinSessions(instance('jellyfin'), [{ NowPlayingItem: source }])[0].quality).toBe(quality);
  });
  it('includes only tagged artwork and prefers an episode’s own backdrop', () => {
    const source = instance('emby');
    const item = toJellyfinItem(source, { ...jellyfin.recent.Items[1], BackdropImageTags: ['own'] })!;
    expect(item.backdrop).toBe('/emby/Items/episode-1/Images/Backdrop?fillWidth=960&quality=80');
    expect(item.link).toBe('http://media.example.com/web/index.html#!/item?id=episode-1');
    expect(toJellyfinItem(source, { Id: 'bare', Name: 'Bare' })).toMatchObject({ poster: undefined, backdrop: undefined });
    for (const type of ['MusicVideo', 'Video']) expect(toJellyfinItem(source, { Id: 'video', Type: type })?.kind).toBe('video');
  });
  it.each(['jellyfin', 'emby'])('uses the %s prefix and headers, never URL credentials, for every endpoint', async type => {
    const source = instance(type), prefix = type === 'emby' ? '/emby' : '';
    json.mockImplementation(async (_instance, path) => path.includes('/Sessions?') ? jellyfin.sessions : path.includes('/Items?') ? jellyfin.recent : path.endsWith('/Counts') ? jellyfin.counts : jellyfin.folders);
    expect((await collectJellyfinNowPlaying(source)).sessions).toHaveLength(3);
    const recent = await collectJellyfinRecent(source, { kinds: ['movie', 'album'], count: 4, group: false });
    expect(recent.items.map(item => item.kind)).toEqual(['movie', 'album']);
    const library = await collectJellyfinLibrary(source);
    expect(library.counts).toEqual({ movies: 284, series: 42, episodes: 1280, artists: 96, albums: 210, tracks: 2640, books: 8 });
    expect(library.libraries.map(entry => entry.kind)).toEqual(['movies', 'series', 'music', 'books']);
    expect(JSON.stringify(library)).not.toContain('/fictional/library');
    expect(json.mock.calls[0][1]).toBe(`${prefix}/Sessions?ActiveWithinSeconds=960`);
    expect(json.mock.calls[1][1]).toContain('IncludeItemTypes=Movie,MusicAlbum&Limit=4&Fields=');
    for (const [, path, options] of json.mock.calls) {
      expect(path.startsWith(`${prefix}/`)).toBe(true);
      expect(path).not.toMatch(/fake-key|api_key|apiKey/i);
      expect(options?.headers).toEqual({ 'X-Emby-Token': 'fake-key' });
    }
  });
});

describe('Plex', () => {
  it('maps sessions, episode posters, album artists, buffering, decisions and milliseconds', () => {
    const source = instance('plex'), sessions = toPlexSessions(source, plex.sessions.MediaContainer.Metadata, 'fictional-machine');
    expect(sessions[0]).toMatchObject({ user: 'Alex', player: 'Plex TV · Living room', quality: '4K', method: 'direct', positionMs: 2130000, bitrateKbps: 24000, item: { kind: 'movie', durationMs: 6840000, addedAt: 1768478400000 } });
    expect(sessions[1]).toMatchObject({ state: 'paused', method: 'transcode', quality: '1080p', item: { kind: 'episode', subtitle: 'Harbor Lights', season: 2, episode: 5 } });
    expect(new URL(sessions[1].item.poster!, 'http://fixture').searchParams.get('url')).toBe('/library/metadata/90/thumb/1');
    expect(sessions[2]).toMatchObject({ state: 'buffering', method: 'stream', quality: 'FLAC', item: { kind: 'track', subtitle: 'The Paper Satellites · Signals from the Garden' } });
    expect(sessions[0].item.link).toBe('http://media.example.com/web/index.html#!/server/fictional-machine/details?key=%2Flibrary%2Fmetadata%2F100');
    expect(toPlexItem(source, plex.recent.MediaContainer.Metadata[3])).toMatchObject({ kind: 'album', subtitle: 'The Paper Satellites' });
    for (const thumb of ['https://other.example.com/private', '//other.example.com/image', '/library/metadata/../secrets', '/library/metadata/1?X-Plex-Token=secret']) {
      expect(toPlexItem(source, { ratingKey: '1', thumb })?.poster).toBeUndefined();
    }
  });
  it('filters recent movie/season/album kinds and caches the machine id per instance', async () => {
    const source = instance('plex');
    json.mockImplementation(async (_instance, path) => path === '/' ? plex.identity : path === '/status/sessions' ? plex.sessions : plex.recent);
    await collectPlexNowPlaying(source);
    const recent = await collectPlexRecent(source, { kinds: ['episode', 'album'], count: 4, group: false });
    expect(recent.items.map(item => item.kind)).toEqual(['episode', 'episode', 'album']);
    expect(json.mock.calls.filter(([, path]) => path === '/')).toHaveLength(1);
    await collectPlexNowPlaying(instance('plex'));
    expect(json.mock.calls.filter(([, path]) => path === '/')).toHaveLength(2);
    expect(json.mock.calls.map(([, path]) => path)).toContain('/library/recentlyAdded?X-Plex-Container-Start=0&X-Plex-Container-Size=4');
    for (const [, path, options] of json.mock.calls) {
      expect(path).not.toContain('fake-token');
      expect(options?.headers).toEqual({ 'X-Plex-Token': 'fake-token', Accept: 'application/json' });
    }
  });
  it('omits links if optional machine discovery fails', async () => {
    json.mockImplementation(async (_instance, path) => { if (path === '/') throw new ServiceError('widgets.error.http'); return plex.sessions; });
    expect((await collectPlexNowPlaying(instance('plex'))).sessions[0].item.link).toBeUndefined();
  });
  it('counts section totals, episodes, albums and tracks without returning paths', async () => {
    json.mockImplementation(async (_instance, path) => {
      if (path === '/library/sections') return plex.sections;
      const count = path.includes('type=4') ? 1280 : path.includes('type=9') ? 210 : path.includes('type=10') ? 2640 : path.includes('/1/') ? 284 : path.includes('/2/') ? 42 : 96;
      return { MediaContainer: { totalSize: count } };
    });
    const result = await collectPlexLibrary(instance('plex'));
    expect(result.counts).toEqual({ movies: 284, series: 42, episodes: 1280, artists: 96, albums: 210, tracks: 2640 });
    expect(result.libraries.map(entry => [entry.kind, entry.count])).toEqual([['movies', 284], ['series', 42], ['music', 96]]);
    // Totals never page through titles; only the newest few per section are read.
    const reads = json.mock.calls.map(([, path]) => path).filter(path => path.includes('/all?'));
    expect(reads.every(path => path.includes('X-Plex-Container-Size=0') || path.includes('sort=addedAt:desc') && path.includes('X-Plex-Container-Size=8') || /X-Plex-Container-Start=\d+&X-Plex-Container-Size=24$/.test(path))).toBe(true);
    // A random window per section feeds varied covers.
    expect(reads.filter(path => path.endsWith('X-Plex-Container-Size=24'))).toHaveLength(3);
    expect(reads.filter(path => path.includes('addedAt%3E%3E='))).toHaveLength(3);
    expect(JSON.stringify(result)).not.toContain('/library/');
  });
});

describe('recently added, grouped by series', () => {
  const episode = (n: number, series: string, season = 1): MediaItem => ({ id: `e${n}`, kind: 'episode', title: `Episode ${n}`, subtitle: series, season, episode: n, addedAt: 100 - n });
  it('folds new episodes of a series into one card, newest first, keeping other titles', async () => {
    const { groupRecent } = await import('@/lib/widgetData/media');
    const movie: MediaItem = { id: 'm1', kind: 'movie', title: 'A Film', addedAt: 99 };
    const items = [episode(1, 'Harbor'), movie, episode(2, 'Harbor'), episode(3, 'harbor'), episode(4, 'Orbit', 2)];
    const grouped = groupRecent(items, 10);
    expect(grouped.map(item => [item.kind, item.title, item.count, item.season])).toEqual([
      ['series', 'Harbor', 3, 1], ['movie', 'A Film', undefined, undefined], ['episode', 'Episode 4', undefined, 2],
    ]);
    const mixed = groupRecent([episode(1, 'Harbor', 1), episode(2, 'Harbor', 2)], 10)[0];
    expect(mixed).toMatchObject({ kind: 'series', count: 2 }); expect(mixed).not.toHaveProperty('season');
    expect(groupRecent(items, 1)).toHaveLength(1);
  });
});

describe('Jellyfin play history', () => {
  it('merges accounts by last played date, newest first, one entry per title', async () => {
    const { collectJellyfinHistory } = await import('./jellyfin/collect');
    const source: IntegrationInstance = { id: 'jf', type: 'jellyfin', name: 'Fictional', settings: { url: 'https://media.example.com' }, secrets: { apiKey: 'fictional-secret' } };
    const entry = (id: string, played: string) => ({ Id: id, Type: 'Movie', Name: `Film ${id}`, UserData: { LastPlayedDate: played } });
    vi.mocked(serviceJson).mockImplementation(async (_instance, path) => {
      if (path === '/Users') return [{ Id: 'u1', Name: 'Alex' }, { Id: 'u2', Name: 'Robin' }];
      if (path.startsWith('/Users/u1/')) return { Items: [entry('a', '2026-01-10T10:00:00Z'), entry('b', '2026-01-09T10:00:00Z'), { Id: 'never', Type: 'Movie', Name: 'Unplayed', UserData: {} }] };
      return { Items: [entry('b', '2026-01-11T10:00:00Z')] };
    });
    const watched = await collectJellyfinHistory(source);
    expect(watched.map(({ item, user }) => [item.id, user])).toEqual([['b', 'Robin'], ['a', 'Alex']]);
    expect(vi.mocked(serviceJson).mock.calls.every(([, path, options]) => !String(path).includes('fictional-secret') && (options?.headers as Record<string, string>)['X-Emby-Token'] === 'fictional-secret')).toBe(true);
  });  it('reads how far each title was watched', async () => {
    const { collectJellyfinHistory } = await import('./jellyfin/collect');
    const hour = 36_000_000_000; // ticks
    vi.mocked(serviceJson).mockImplementation(async (_instance, path) => path === '/Users' ? [{ Id: 'u1', Name: 'Alex' }] : { Items: [
      { Id: 'half', Type: 'Movie', Name: 'Half', RunTimeTicks: 2 * hour, UserData: { LastPlayedDate: '2026-01-10T10:00:00Z', PlaybackPositionTicks: hour } },
      { Id: 'done', Type: 'Movie', Name: 'Done', RunTimeTicks: 2 * hour, UserData: { LastPlayedDate: '2026-01-09T10:00:00Z', Played: true, PlaybackPositionTicks: 0 } },
    ] });
    const watched = await collectJellyfinHistory(instance('jellyfin'));
    expect(watched.map(({ progress, remainingMs }) => [progress, remainingMs])).toEqual([[50, 3_600_000], [100, undefined]]);
  });
});
