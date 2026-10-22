import { beforeEach, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn(), serviceBytes: vi.fn() }));
import { serviceJson, serviceBytes } from '@/lib/widgetData/services';
import { collectJellyfinMusicNowPlaying, collectJellyfinMusicRecent, collectJellyfinMusicPlaylists, collectJellyfinMusicTracks, collectJellyfinMusicSearch, controlJellyfinMusic, jellyfinMusicStreamPath } from './jellyfin/collect';
import { collectPlexMusicRecent, collectPlexMusicPlaylists, collectPlexMusicTracks, collectPlexMusicSearch, plexMusicStreamPath } from './plex/collect';
import { clearNavidromeSessions, collectNavidromeRecent, collectNavidromeTopTracks, collectNavidromePlaylists, collectNavidromeTracks, collectNavidromeSearch } from './navidrome/collect';
const source = (type: string): IntegrationInstance => ({ id: `playback-${type}`, type, name: 'Fictional Music', settings: { url: 'https://music.example.com', username: 'alex' }, secrets: { apiKey: 'fictional-key', token: 'fictional-token', password: 'fictional-password' } });
const json = vi.mocked(serviceJson), bytes = vi.mocked(serviceBytes);
const song = { Id: 'song', Type: 'Audio', Name: 'Glass', AlbumId: 'album', Album: 'Garden', RunTimeTicks: 1200000000, UserData: { LastPlayedDate: '2026-01-15T12:00:00Z' } };
const playlist = { Id: 'playlist', Type: 'Playlist', MediaType: 'Audio', Name: 'Quiet', ChildCount: 4, RunTimeTicks: 4800000000, ImageTags: { Primary: 'art' } };
beforeEach(() => vi.resetAllMocks());

it.each(['jellyfin', 'emby'])('resolves ordered %s queue IDs, including repeated tracks, and remote control capability', async type => {
  const instance = source(type);
  json.mockImplementation(async (_instance, path) => {
    if ((path.includes('/Sessions?') || path.endsWith('/Sessions'))) return [{ Id: 'session', SupportsRemoteControl: true, PlaylistItemId: 'second', NowPlayingItem: song,
      NowPlayingQueue: [{ Id: 'song', PlaylistItemId: 'first' }, { Id: 'song', PlaylistItemId: 'second' }, { Id: 'next2' }, { Id: 'next1' }] }];
    return { Items: [{ ...song, Id: 'next1' }, { ...song, Id: 'next2' }] };
  });
  const session = (await collectJellyfinMusicNowPlaying(instance)).sessions[0];
  expect(session).toMatchObject({ canControl: true, track: { albumId: 'album', playedAt: Date.parse('2026-01-15T12:00:00Z') } });
  expect(session.next?.map(item => item.id)).toEqual(['next2', 'next1']);
  expect(json.mock.calls.some(([, path]) => path.includes('/Items?Ids=next2%2Cnext1'))).toBe(true);
  for (const [, path, options] of json.mock.calls) { expect(path.startsWith(type === 'emby' ? '/emby/' : '/')).toBe(true); expect(options?.headers).toEqual({ 'X-Emby-Token': 'fictional-key' }); }
});
it('merges per-user Jellyfin track history by last-play date and omits never-played tracks', async () => {
  json.mockImplementation(async (_instance, path) => path === '/Users' ? [{ Id: 'a' }, { Id: 'b' }] : { Items: [
    { ...song, UserData: { LastPlayedDate: path.includes('/b/') ? '2026-01-16T12:00:00Z' : '2026-01-15T12:00:00Z' } }, { ...song, Id: 'unplayed', UserData: {} },
  ] });
  const result = await collectJellyfinMusicRecent(source('jellyfin'), 12, 'tracks');
  expect(result.albums).toEqual([]); expect(result.tracks).toHaveLength(1); expect(result.tracks![0].playedAt).toBe(Date.parse('2026-01-16T12:00:00Z'));
  expect(json.mock.calls.filter(([, path]) => path.includes('SortBy=DatePlayed') && path.includes('IncludeItemTypes=Audio'))).toHaveLength(2);
});
it.each(['jellyfin', 'emby'])('maps %s playlists, album and playlist tracks, search, stream and checked control commands', async type => {
  const instance = source(type), prefix = type === 'emby' ? '/emby' : '';
  json.mockImplementation(async (_instance, path) => {
    if (path.includes('/Users/Query?')) return { Items: [{ Id: 'alex' }], TotalRecordCount: 1 };
    if (path.endsWith('/Users')) return [{ Id: 'alex' }];
    if ((path.includes('/Sessions?') || path.endsWith('/Sessions'))) return [{ Id: 'session', SupportsRemoteControl: true, NowPlayingItem: song }];
    if (path.includes('/Playing/')) return {};
    if (path.includes('IncludeItemTypes=Playlist')) return { Items: [playlist, { ...playlist, Id: 'video', MediaType: 'Video' }] };
    if (path.includes('IncludeItemTypes=MusicAlbum')) return { Items: [{ Id: 'album', Type: 'MusicAlbum', Name: 'Garden' }] };
    return { Items: [song] };
  });
  expect((await collectJellyfinMusicPlaylists(instance, 12)).playlists).toEqual([expect.objectContaining({ id: 'playlist', name: 'Quiet', trackCount: 4, durationMs: 480000 })]);
  expect(await collectJellyfinMusicTracks(instance, 'playlist', 'playlist')).toHaveLength(1);
  expect(await collectJellyfinMusicTracks(instance, 'album', 'album')).toHaveLength(1);
  const search = await collectJellyfinMusicSearch(instance, 'Glass & Garden');
  expect([search.tracks.length, search.albums.length, search.playlists.length]).toEqual([1, 1, 1]);
  expect(json.mock.calls.some(([, path]) => path.includes('searchTerm=Glass%20%26%20Garden'))).toBe(true);
  const path = await jellyfinMusicStreamPath(instance, 'song');
  expect(path).toContain(type === 'emby' ? '/emby/Audio/song/universal.mp3?DeviceId=NasDash' : '/Audio/song/universal?UserId=alex'); expect(path).not.toMatch(/api_key|fictional-key/);
  for (const [action, command] of [['playpause', 'PlayPause'], ['next', 'NextTrack'], ['previous', 'PreviousTrack']] as const) {
    await controlJellyfinMusic(instance, 'session', action);
    expect(json).toHaveBeenCalledWith(instance, `${prefix}/Sessions/session/Playing/${command}`, { method: 'POST', headers: { 'X-Emby-Token': 'fictional-key' }, json: { Command: command } });
  }
  await expect(controlJellyfinMusic(instance, 'unknown', 'next')).rejects.toMatchObject({ status: 403 });
});
it('maps Plex track and album history, audio playlists, music-scoped search, ordered tracks and local part paths', async () => {
  const instance = source('plex');
  const track = { ratingKey: 'song', type: 'track', title: 'Glass', parentRatingKey: 'album', parentTitle: 'Garden', viewedAt: 1768474800, Media: [{ Part: [{ key: '/library/parts/123/456/file.flac' }] }] };
  const list = { ratingKey: 'playlist', type: 'playlist', playlistType: 'audio', title: 'Quiet', leafCount: 4, duration: 480000, composite: '/playlists/123/composite/456' };
  json.mockImplementation(async (_instance, path) => ({ MediaContainer: path === '/library/sections' ? { Directory: [{ type: 'artist', key: 'music' }, { type: 'movie', key: 'video' }] }
    : { Metadata: path.includes('/playlists?') ? [list, { ...list, ratingKey: 'video', playlistType: 'video' }] : path.includes('type=9') ? [{ ratingKey: 'album', type: 'album', title: 'Garden' }] : [track] } }));
  expect((await collectPlexMusicRecent(instance, 12, 'tracks')).tracks![0]).toMatchObject({ albumId: 'album', playedAt: 1768474800000 });
  expect((await collectPlexMusicRecent(instance, 12, 'albums')).albums[0]).toMatchObject({ id: 'album', title: 'Garden', playedAt: 1768474800000 });
  expect((await collectPlexMusicPlaylists(instance, 12)).playlists).toEqual([expect.objectContaining({ id: 'playlist', trackCount: 4, durationMs: 480000, cover: expect.stringContaining('%2Fplaylists%2F123%2Fcomposite%2F456') })]);
  expect(await collectPlexMusicTracks(instance, 'album', 'album')).toHaveLength(1); expect(await collectPlexMusicTracks(instance, 'playlist', 'playlist')).toHaveLength(1);
  const search = await collectPlexMusicSearch(instance, 'Quiet');
  expect(json.mock.calls.filter(([, path]) => path.includes('title=Quiet')).map(([, path]) => path)).toEqual([expect.stringContaining('/all?title=Quiet&type=10'), expect.stringContaining('/all?title=Quiet&type=9')]);
  expect([search.tracks.length, search.albums.length, search.playlists.length]).toEqual([1, 1, 1]);
  expect(json.mock.calls.some(([, path]) => path.includes('/video/'))).toBe(false);
  expect(await plexMusicStreamPath(instance, 'song')).toBe('/library/parts/123/456/file.flac');
  track.Media[0].Part[0].key = 'https://outside.example.com/file';
  await expect(plexMusicStreamPath(instance, 'song')).rejects.toMatchObject({ status: 404 });
});
it('maps Subsonic playlists, playlist/album tracks and search3, with explicit unsupported track history', async () => {
  const instance = source('navidrome'), track = { id: 'song', title: 'Glass', albumId: 'album', duration: 120, coverArt: 'art' }, list = { id: 'playlist', name: 'Quiet', songCount: 4, duration: 480, coverArt: 'list-art', changed: '2026-01-15T12:00:00Z' };
  bytes.mockImplementation(async (_instance, path) => {
    const method = new URL(path, 'https://fixture').pathname.split('/').at(-1);
    return { status: 200, contentType: 'application/json', bytes: Buffer.from(JSON.stringify({ 'subsonic-response': { status: 'ok',
      ...(method === 'getPlaylists' ? { playlists: { playlist: [list] } } : method === 'getPlaylist' ? { playlist: { entry: [track] } } : method === 'getAlbum' ? { album: { song: [track] } } : method === 'search3' ? { searchResult3: { song: [track], album: [{ id: 'album', name: 'Garden' }] } } : { albumList2: { album: [{ id: 'album', name: 'Garden' }] } }) } })) };
  });
  expect((await collectNavidromePlaylists(instance, 12)).playlists[0]).toMatchObject({ trackCount: 4, durationMs: 480000, cover: '/rest/getCoverArt?id=list-art&size=600' });
  expect((await collectNavidromeTracks(instance, 'playlist', 'playlist'))[0]).toMatchObject({ albumId: 'album', durationMs: 120000 });
  expect(await collectNavidromeTracks(instance, 'album', 'album')).toHaveLength(1);
  const result = await collectNavidromeSearch(instance, 'Quiet'); expect([result.tracks.length, result.albums.length, result.playlists.length]).toEqual([1, 1, 1]);
  await collectNavidromeRecent(instance, 12, 'albums'); expect(bytes.mock.calls.at(-1)![1]).toContain('type=recent');
});

it('reads tracks played lately through Navidrome\'s own API, and refuses on servers without it', async () => {
  clearNavidromeSessions();
  const instance = source('navidrome');
  bytes.mockImplementation(async (_instance, path, options) => {
    if (path === '/auth/login') {
      expect(JSON.parse(String(options?.body))).toEqual({ username: 'alex', password: expect.any(String) });
      return { status: 200, contentType: 'application/json', bytes: Buffer.from(JSON.stringify({ token: 'fictional-jwt' })) } as never;
    }
    expect((options?.headers as Record<string, string>)['x-nd-authorization']).toBe('Bearer fictional-jwt');
    expect(path).toContain('_sort=play_date');
    return { status: 200, contentType: 'application/json', bytes: Buffer.from(JSON.stringify([{ id: 's1', title: 'Glass', artist: 'Mira', albumId: 'al1', duration: 120, playDate: '2026-01-15T12:00:00Z' }, { id: 's2', title: 'Never played' }])) } as never;
  });
  const result = await collectNavidromeRecent(instance, 12, 'tracks');
  expect(result.tracks).toEqual([expect.objectContaining({ id: 's1', durationMs: 120000, cover: '/rest/getCoverArt?id=al1&size=600', playedAt: Date.parse('2026-01-15T12:00:00Z') })]);
  expect(JSON.stringify(result)).not.toContain('fictional-jwt');
  clearNavidromeSessions();
  bytes.mockResolvedValue({ status: 404, contentType: 'text/plain', bytes: Buffer.from('') } as never);
  await expect(collectNavidromeRecent(instance, 12, 'tracks')).rejects.toMatchObject({ key: 'widgets.music.error.noTrackHistory', status: 422 });
});

it('reads the tracks played most through Navidrome\'s own API', async () => {
  clearNavidromeSessions();
  bytes.mockImplementation(async (_instance, path) => path === '/auth/login'
    ? { status: 200, contentType: 'application/json', bytes: Buffer.from(JSON.stringify({ token: 'fictional-jwt' })) } as never
    : { status: 200, contentType: 'application/json', bytes: Buffer.from(JSON.stringify([{ id: 's1', title: 'Glass', albumId: 'al1', playCount: 9 }, { id: 's2', title: 'Never', playCount: 0 }])) } as never);
  expect(await collectNavidromeTopTracks(source('navidrome'), 6)).toEqual([expect.objectContaining({ id: 's1', plays: 9 })]);
  expect(String(bytes.mock.calls.at(-1)![1])).toContain('_sort=play_count');
});
it('reads a Jellyfin playlist as an account allowed to: owner found after a refusal, remembered next time', async () => {
  const { ServiceError } = await import('@/lib/widgetData/services');
  const instance = { ...source('jellyfin'), id: 'playback-owner' };
  json.mockImplementation(async (_instance, path) => {
    if (path === '/Users') return [{ Id: 'first' }, { Id: 'owner' }];
    if (path.includes('/Playlists/') && !path.includes('UserId=owner')) throw new ServiceError('widgets.error.http', 502, { status: 403 });
    return { Items: [song] };
  });
  expect(await collectJellyfinMusicTracks(instance, 'playlist', 'shared')).toHaveLength(1);
  json.mockClear();
  expect(await collectJellyfinMusicTracks(instance, 'playlist', 'shared')).toHaveLength(1);
  expect(json.mock.calls.filter(([, path]) => path.includes('/Playlists/')).map(([, path]) => path.includes('UserId=owner'))).toEqual([true]);
  // Nobody may read it: the refusal comes through instead of an empty list.
  json.mockImplementation(async (_instance, path) => { if (path === '/Users') return [{ Id: 'first' }]; throw new ServiceError('widgets.error.http', 502, { status: 403 }); });
  await expect(collectJellyfinMusicTracks(instance, 'playlist', 'private')).rejects.toThrow();
});
