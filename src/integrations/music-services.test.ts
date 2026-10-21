import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
import jellyfin from './jellyfin/samples/music.json';
import plex from './plex/samples/music.json';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn() }));
import { serviceJson } from '@/lib/widgetData/services';
import { collectJellyfinMusicHistory, collectJellyfinMusicLibrary, collectJellyfinMusicNowPlaying, collectJellyfinMusicRecent, collectJellyfinMusicTop, toJellyfinMusicTrack } from './jellyfin/collect';
import { collectPlexMusicHistory, collectPlexMusicLibrary, collectPlexMusicNowPlaying, collectPlexMusicRecent, collectPlexMusicTop, toPlexMusicTrack } from './plex/collect';
let serial = 0;
const instance = (type: string): IntegrationInstance => ({ id: `music-${++serial}`, type, name: 'Fictional Music', settings: { url: 'https://music.example.com' }, secrets: { apiKey: 'fictional-key', token: 'fictional-token' } });
const json = vi.mocked(serviceJson);
beforeEach(() => { vi.resetAllMocks(); vi.useRealTimers(); });

describe('Jellyfin/Emby music', () => {
  it.each(['jellyfin', 'emby'])('maps %s music separately, uses album covers and sums per-account plays', async type => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    const source = instance(type), prefix = type === 'emby' ? '/emby' : '';
    json.mockImplementation(async (_source, path) => {
      if ((path.includes('/Sessions?') || path.endsWith('/Sessions'))) return jellyfin.sessions;
      if (path.includes('/Users/Query?')) return { Items: jellyfin.users, TotalRecordCount: jellyfin.users.length };
      if (path.endsWith('/Users')) return jellyfin.users;
      if (path.endsWith('/Counts')) return jellyfin.counts;
      if (path.includes('/MusicGenres?')) return jellyfin.genres;
      return jellyfin.albums;
    });
    const now = await collectJellyfinMusicNowPlaying(source);
    expect(now.sessions).toHaveLength(1);
    expect(now.sessions[0]).toMatchObject({ state: 'paused', positionMs: 74000, quality: 'FLAC', track: { title: 'The Glass Meridian', artist: 'The Paper Satellites', album: 'Signals from the Garden', durationMs: 234000, cover: `${prefix}/Items/album-1/Images/Primary?maxWidth=600&quality=90` } });
    expect((await collectJellyfinMusicRecent(source, 12)).albums[0]).toMatchObject({ title: 'Signals from the Garden', trackCount: 10, year: 2025 });
    expect((await collectJellyfinMusicTop(source, 6)).albums.map(album => album.plays)).toEqual([24, 8]);
    expect((await collectJellyfinMusicHistory(source)).map(album => album.id)).toEqual(['album-1', 'album-2']);
    const library = await collectJellyfinMusicLibrary(source);
    expect(library).toMatchObject({ artists: 2, albums: 2, tracks: 18, weekCount: 1, week: [{ id: 'album-1' }], genres: [{ name: 'Electronic', count: 10 }, { name: 'Ambient', count: 2 }] });
    expect(library.durationMs).toBeUndefined();
    for (const [,path,options] of json.mock.calls) { expect(path.startsWith(prefix+'/')).toBe(true); expect(options?.headers).toEqual({ 'X-Emby-Token': 'fictional-key' }); expect(path).not.toContain('fictional-key'); }
    expect(json.mock.calls.some(([,path]) => path.includes('SortBy=PlayCount') && path.includes('/Users/robin/Items'))).toBe(true);
    expect(json.mock.calls.some(([,path]) => path.includes('SortBy=DatePlayed'))).toBe(true);
    expect(toJellyfinMusicTrack(source, { Id: 'no-album', Type: 'Audio', Name: 'Bare' })?.cover).toBeUndefined();
    vi.useRealTimers();
  });
  it('pages beyond each user top-N before summing, so a shared album is fully counted', async () => {
    const source = instance('jellyfin');
    json.mockImplementation(async (_source, path) => {
      if (path === '/Users') return jellyfin.users;
      const robin = path.includes('/robin/'), offset = Number(new URL(path, 'http://fixture').searchParams.get('StartIndex'));
      const item = (id: string, plays: number) => ({ Id: id, Type: 'MusicAlbum', Name: id, UserData: { PlayCount: plays } });
      if (offset === 0) return { Items: Array.from({length:200}, (_,i) => item(`${robin?'r':'a'}-${i}`, 10)) };
      return { Items: [item('shared', robin?8:9)] };
    });
    const top = await collectJellyfinMusicTop(source, 3);
    expect(top.albums[0]).toMatchObject({ id: 'shared', plays: 17 });
    expect(json.mock.calls.filter(([,path]) => path.includes('StartIndex=200'))).toHaveLength(2);
  });
});

describe('Plex music', () => {
  it('uses music sections and the album sort endpoints, with track sessions and album covers', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    const source = instance('plex');
    json.mockImplementation(async (_source, path) => {
      if (path === '/') return plex.identity;
      if (path === '/status/sessions') return plex.sessions;
      if (path.startsWith('/status/sessions/history/all')) return { MediaContainer: { Metadata: [{ ratingKey: 'track-1', type: 'track', title: 'The Glass Meridian', parentTitle: 'Signals from the Garden', parentRatingKey: 'album-1', viewedAt: 1768474800 }] } };
      if (path === '/library/sections') return plex.sections;
      if (path.includes('/genre?')) return plex.genres;
      if (path.includes('Size=0')) return { MediaContainer: { totalSize: path.includes('type=10') ? 18 : 2 } };
      return plex.albums;
    });
    const now = await collectPlexMusicNowPlaying(source);
    expect(now.sessions).toHaveLength(1);
    expect(now.sessions[0]).toMatchObject({ state: 'paused', user: 'Alex', player: 'Plexamp · Study', quality: 'FLAC', positionMs: 74000, track: { durationMs: 234000, title: 'The Glass Meridian', artist: 'The Paper Satellites', album: 'Signals from the Garden' } });
    expect(new URL(now.sessions[0].track.cover!, 'http://fixture').searchParams.get('url')).toBe('/library/metadata/album-1/thumb/1');
    expect((await collectPlexMusicRecent(source, 12)).albums[0]).toMatchObject({ trackCount: 10, year: 2025 });
    expect((await collectPlexMusicTop(source, 6)).albums[0].plays).toBe(24);
    expect((await collectPlexMusicHistory(source))[0].playedAt).toBe(1768474800000);
    expect(await collectPlexMusicLibrary(source)).toMatchObject({ artists: 2, albums: 2, tracks: 18, weekCount: 1, week: [{id:'album-1'}], genres: [{ name: 'Ambient', count: 2 }, { name: 'Electronic', count: 1 }] });
    expect(json.mock.calls.some(([,path]) => path.includes('/video/'))).toBe(false);
    for (const sort of ['addedAt:desc','viewCount:desc']) expect(json.mock.calls.some(([,path]) => path.includes(`/music/all?type=9&sort=album.${sort}`))).toBe(true);
    for (const [,path,options] of json.mock.calls) { expect(options?.headers).toEqual({ 'X-Plex-Token': 'fictional-token', Accept:'application/json' }); expect(path).not.toContain('fictional-token'); }
    expect(toPlexMusicTrack({ratingKey:'bad',type:'track',parentThumb:'https://outside.example.com/image'})?.cover).toBeUndefined();
    vi.useRealTimers();
  });
});


it('counts Plex genre albums when the usual genre directory has no counts', async () => {
  const source = instance('plex');
  json.mockImplementation(async (_source, path) => {
    if (path === '/') return plex.identity;
    if (path === '/library/sections') return plex.sections;
    if (path.includes('/genre?')) return { MediaContainer: { Directory:[{key:'ambient',title:'Ambient'}] } };
    if (path.includes('Size=0')) return { MediaContainer: { totalSize: path.includes('genre=ambient') ? 7 : 10 } };
    return plex.albums;
  });
  expect((await collectPlexMusicLibrary(source)).genres).toEqual([{name:'Ambient',count:7}]);
  expect(json.mock.calls.some(([,path]) => path.includes('/music/all?type=9&genre=ambient'))).toBe(true);
});

it('uses generic music genres when /MusicGenres is unavailable and fills absent genre counts', async () => {
  const source = instance('jellyfin');
  json.mockImplementation(async (_source,path) => {
    if (path.includes('/MusicGenres?')) throw new Error('not supported');
    if (path.includes('/Genres?')) return { Items:[{Name:'Ambient'}] };
    if (path.includes('Genres=Ambient')) return { TotalRecordCount:7 };
    if (path.endsWith('/Counts')) return jellyfin.counts;
    return jellyfin.albums;
  });
  expect((await collectJellyfinMusicLibrary(source)).genres).toEqual([{name:'Ambient',count:7}]);
  expect(json.mock.calls.some(([,path]) => path.startsWith('/Genres?IncludeItemTypes=MusicAlbum'))).toBe(true);
});

it('bounds simultaneous session queue enrichment to four upstream reads', async () => {
  let active = 0, peak = 0;
  const track = { Id: 'song', Type: 'Audio', Name: 'Quiet' };
  json.mockImplementation(async (_source, path) => {
    if (path.includes('/Sessions?')) return Array.from({ length: 12 }, (_, n) => ({ Id: `s-${n}`, NowPlayingItem: track, NowPlayingQueue: [{ Id: 'song' }, { Id: `next-${n}` }] }));
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    return { Items: [] };
  });
  expect((await collectJellyfinMusicNowPlaying(instance('jellyfin'))).sessions).toHaveLength(12);
  expect(peak).toBe(4);
});

it('caps aggregate per-user album scans instead of multiplying the page budget by account count', async () => {
  json.mockImplementation(async (_source, path) => path === '/Users' ? Array.from({ length: 100 }, (_, n) => ({ Id: `user-${n}` })) : { Items: [] });
  await expect(collectJellyfinMusicTop(instance('jellyfin'), 6)).rejects.toMatchObject({ key: 'widgets.error.tooLarge' });
  expect(json.mock.calls).toHaveLength(51); // One user list and fifty item pages.
});
