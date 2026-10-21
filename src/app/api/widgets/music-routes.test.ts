import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { DashboardConfig, IntegrationInstance } from '@/lib/types';
import type { Page, PagesDocument } from '@/lib/pages/types';
import type { AccessPrincipal } from '@/lib/access';
import jellyfinMusic from '@/integrations/jellyfin/samples/music.json';
import plexMusic from '@/integrations/plex/samples/music.json';
import type { MusicAlbum, MusicNowPlayingResponse } from '@/lib/widgetData/contracts';
const state = vi.hoisted(() => ({ demo: false, admin: true, authenticated: true, instances: [] as IntegrationInstance[], pages: [] as Page[], allowedWidgets: [] as string[] }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ settings: { securityMode: 'public' }, integrations: state.instances }) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
vi.mock('@/lib/access', async original => ({ ...await original<typeof import('@/lib/access')>(), resolveAccessPrincipal: () => state.authenticated ? { username: 'reader', role: state.admin ? 'admin' : 'viewer', allowedTabs: [], allowedWidgets: state.allowedWidgets, isAnonymous: !state.admin } : null }));
vi.mock('@/lib/pages/store', async original => ({ ...await original<typeof import('@/lib/pages/store')>(), readPagesDocument: (): PagesDocument => ({ schemaVersion: 5, pages: state.pages }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceBytes: vi.fn(), serviceJson: vi.fn() }));
vi.mock('@/integrations/navidrome/collect', async original => ({ ...await original<typeof import('@/integrations/navidrome/collect')>(), collectNavidromeNowPlaying: vi.fn(), collectNavidromeRecent: vi.fn(), collectNavidromeLibrary: vi.fn(), collectNavidromeTop: vi.fn(), collectNavidromeHistory: vi.fn() }));
import { GET as nowGet } from './music/now-playing/route';
import { GET as recentGet } from './music/recent/route';
import { GET as libraryGet } from './music/library/route';
import { GET as topGet } from './music/top/route';
import { GET as imageGet } from './media/image/route';
import { collectNavidromeHistory, collectNavidromeLibrary, collectNavidromeNowPlaying, collectNavidromeRecent, collectNavidromeTop } from '@/integrations/navidrome/collect';
import { buildConfigForPrincipal } from '@/lib/configAccess';
import { serviceBytes, serviceJson } from '@/lib/widgetData/services';
import { NO_ACCESS } from '@/lib/permissions';
import { MUSIC_WIDGET_TYPES, musicWeek } from '@/lib/widgetData/music';
const get = (query = 'widgetId=w') => new NextRequest(`https://nasdash.example.com/api/widgets/music/recent?${query}`);
const image = (path: string) => new NextRequest(new URL(path, 'https://nasdash.example.com'));
const saved = () => state.pages[0].widgets[0].settings;
const setType = (type: string) => { state.pages[0].widgets[0].type = type; };
const routes = [nowGet, recentGet, libraryGet, topGet];
let serial = 0;
let album: MusicAlbum;
let playing: MusicNowPlayingResponse;
beforeEach(() => {
  vi.resetAllMocks(); vi.useRealTimers(); state.demo = false; state.admin = true; state.authenticated = true; state.allowedWidgets = [];
  state.instances = [{ id: `navidrome-test-${++serial}`, type: 'navidrome', name: 'Fictional Music', settings: { url: 'https://music.example.com', username: 'alex' }, secrets: { password: 'fictional-password' } }, { id: 'wrong-type', type: 'immich', name: 'Photos', settings: {} }];
  state.pages = [{ id: 'dashboard', name: 'Dashboard', icon: '', revision: 1, widgets: [{ id: 'w', type: 'music-nowplaying', x: 0, y: 0, w: 12, h: 10, settings: { integrationId: state.instances[0].id } }] }];
  album = { id: 'album', title: 'Signals from the Garden', artist: 'The Paper Satellites', cover: '/rest/getCoverArt?id=album&size=600', link: 'https://music.example.com/album' };
  playing = { server: 'navidrome', name: 'Fictional Music', fetchedAt: 1, sessions: [{ id: 'session', user: 'Alex', state: 'playing', track: { id: 'track', title: 'The Glass Meridian', cover: album.cover }, next: [{ id: 'next', title: 'Aerial Seeds', cover: '/rest/getCoverArt?id=next&size=600' }] }] };
  vi.mocked(collectNavidromeNowPlaying).mockResolvedValue(playing);
  vi.mocked(collectNavidromeRecent).mockResolvedValue({ server: 'navidrome', name: 'Fictional Music', albums: [album], fetchedAt: 1 });
  vi.mocked(collectNavidromeTop).mockResolvedValue({ server: 'navidrome', name: 'Fictional Music', albums: [album], fetchedAt: 1 });
  vi.mocked(collectNavidromeLibrary).mockResolvedValue({ server: 'navidrome', name: 'Fictional Music', albums: 210, week: [album], weekCount: 1, fetchedAt: 1 });
  vi.mocked(collectNavidromeHistory).mockResolvedValue([album]);
  vi.mocked(serviceBytes).mockResolvedValue({ bytes: Buffer.from('fictional-raster'), contentType: 'image/webp', status: 200 });
});

describe('music routes and privacy', () => {
  it('removes names by default, even for admins, and applies privacy after the shared cache', async () => {
    let result = await (await nowGet(get())).json();
    expect(result.sessions[0].user).toBeUndefined();
    saved().showUsers = true;
    result = await (await nowGet(get())).json(); expect(result.sessions[0].user).toBe('Alex');
    state.admin = false;
    result = await (await nowGet(get())).json(); expect(result.sessions[0].user).toBe('Alex');
    saved().showUsers = false;
    result = await (await nowGet(get())).json(); expect(result.sessions[0].user).toBeUndefined();
    expect(collectNavidromeNowPlaying).toHaveBeenCalledTimes(1);
    expect(result.sessions[0].track.cover).toMatch(/^\/api\/widgets\/media\/image\?/);
    expect(result.sessions[0].next[0].cover).toMatch(/^\/api\/widgets\/media\/image\?/);
    expect(JSON.stringify(result)).not.toMatch(/music\.example\.com|fictional-password|\/rest\/|[?&](u|t|s|c|v|f)=/);
  });
  it('shows recently played albums when idle, with admin links and proxied covers', async () => {
    playing.sessions = [];
    let result = await (await nowGet(get())).json(); expect(result.recent[0].link).toBe(album.link);
    state.admin = false;
    result = await (await nowGet(get())).json(); expect(result.recent[0].link).toBeUndefined(); expect(result.recent[0].cover).toContain('/media/image?');
    expect(collectNavidromeHistory).toHaveBeenCalledTimes(1);
  });
  it('leaves idle history absent when unsupported', async () => {
    playing.sessions = []; vi.mocked(collectNavidromeHistory).mockRejectedValue(new Error('unsupported'));
    expect((await (await nowGet(get())).json()).recent).toBeUndefined();
  });
  it.each([['music-recent', recentGet], ['music-top', topGet], ['music-library', libraryGet]] as const)('filters album links for %s after caching', async (type, route) => {
    setType(type); const full = await route(get()); expect(full.headers.get('cache-control')).toBe('private, no-store');
    let result = await full.json(); expect((result.albums instanceof Array ? result.albums : result.week)[0].link).toBe(album.link);
    state.admin = false; result = await (await route(get())).json();
    const entry = (result.albums instanceof Array ? result.albums : result.week)[0];
    expect(entry.link).toBeUndefined(); expect(entry.cover).toContain('/media/image?');
    expect(JSON.stringify(result)).not.toMatch(/fictional-password|music\.example\.com|\/rest\//);
  });
  it.each([['music-recent', recentGet, 12], ['music-top', topGet, 6]] as const)('treats null settings as absent for %s', async (type, route, count) => {
    setType(type); saved().integrationId = null; saved().count = null;
    expect((await route(get())).status).toBe(200);
    expect(type === 'music-top' ? collectNavidromeTop : collectNavidromeRecent).toHaveBeenCalledWith(state.instances[0], count);
  });
  it.each([['count', 3], ['count', 41], ['count', '12'], ['count', 4.5], ['integrationId', 4], ['integrationId', '']])('rejects invalid recent %s=%s', async (field, value) => {
    setType('music-recent'); saved()[field as string] = value;
    const response = await recentGet(get()); expect(response.status).toBe(400); expect(collectNavidromeRecent).not.toHaveBeenCalled();
  });
  it.each([2,21,'6',6.1])('rejects invalid top count=%s', async count => {
    setType('music-top'); saved().count = count; expect((await topGet(get())).status).toBe(400); expect(collectNavidromeTop).not.toHaveBeenCalled();
  });
  it('validates showUsers before reading and accepts null as absent', async () => {
    saved().showUsers = 'true'; expect((await nowGet(get())).status).toBe(400); expect(collectNavidromeNowPlaying).not.toHaveBeenCalled();
    saved().showUsers = null; expect((await nowGet(get())).status).toBe(200);
  });
  it('rejects missing widgets, wrong types/connections, permissions and unauthenticated readers', async () => {
    expect((await nowGet(get(''))).status).toBe(400);
    expect((await nowGet(get('widgetId=missing'))).status).toBe(404);
    expect((await recentGet(get())).status).toBe(404);
    saved().integrationId = 'wrong-type'; expect((await nowGet(get())).status).toBe(404);
    saved().integrationId = state.instances[0].id; state.admin = false; state.allowedWidgets = [NO_ACCESS]; expect((await nowGet(get())).status).toBe(404);
    state.authenticated = false; expect((await nowGet(get())).status).toBe(401);
    expect(collectNavidromeNowPlaying).not.toHaveBeenCalled();
  });
  it('keeps the address, account and password out of visitor config', () => {
    const config = { settings: {}, integrations: state.instances } as DashboardConfig;
    const viewer = { role: 'viewer', allowedTabs: [], allowedWidgets: [] } as unknown as AccessPrincipal;
    const result = buildConfigForPrincipal(config, viewer);
    expect(result.integrations?.[0].settings).toEqual({}); expect(result.integrations?.[0].secrets).toBeUndefined();
  });
  it('caches current tracks for 10 seconds and other responses for five minutes', async () => {
    vi.useFakeTimers(); vi.setSystemTime(1000000);
    await nowGet(get()); await nowGet(get()); expect(collectNavidromeNowPlaying).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10001); await nowGet(get()); expect(collectNavidromeNowPlaying).toHaveBeenCalledTimes(2);
    for (const [type,route,collect] of [['music-recent',recentGet,collectNavidromeRecent],['music-top',topGet,collectNavidromeTop],['music-library',libraryGet,collectNavidromeLibrary]] as const) {
      setType(type); await route(get()); vi.advanceTimersByTime(299999); await route(get()); expect(collect).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(2); await route(get()); expect(collect).toHaveBeenCalledTimes(2);
    }
    vi.useRealTimers();
  });
});

describe('music cover membership', () => {
  it.each(MUSIC_WIDGET_TYPES)('serves only covers returned to that exact %s widget', async type => {
    setType(type); const route = routes[MUSIC_WIDGET_TYPES.indexOf(type)], result = await (await route(get())).json();
    const cover = type === 'music-nowplaying' ? result.sessions[0].track.cover : type === 'music-library' ? result.week[0].cover : result.albums[0].cover;
    const response = await imageGet(image(cover)); expect(response.status).toBe(200); expect(response.headers.get('content-type')).toBe('image/webp');
    const query = new URL(vi.mocked(serviceBytes).mock.calls[0][1], 'http://fixture').searchParams;
    expect(query.get('id')).toBe('album'); expect(query.get('u')).toBe('alex'); expect(query.get('t')).toMatch(/^[a-f0-9]{32}$/); expect(query.get('size')).toBe('600');
    state.pages[0].widgets.push({ ...state.pages[0].widgets[0], id: 'other' });
    expect((await imageGet(image(cover.replace('widgetId=w', 'widgetId=other')))).status).toBe(404);
    expect((await imageGet(image(cover.replace('kind=poster','kind=backdrop')))).status).toBe(404);
    expect((await imageGet(image(cover.replace(/id=[a-f0-9]{64}/,'id='+ 'a'.repeat(64))))).status).toBe(404);
    saved().integrationId = 'wrong-type'; expect((await imageGet(image(cover))).status).toBe(404);
    expect(serviceBytes).toHaveBeenCalledTimes(1);
  });
  it('keeps next-track and idle history covers in membership too', async () => {
    let result = await (await nowGet(get())).json(); expect((await imageGet(image(result.sessions[0].next[0].cover))).status).toBe(200);
    state.instances[0].id += '-idle'; saved().integrationId = state.instances[0].id; playing.sessions = [];
    result = await (await nowGet(get())).json(); expect((await imageGet(image(result.recent[0].cover))).status).toBe(200);
  });
  it('isolates admin preview membership from saved widget membership', async () => {
    setType('music-recent'); const query = new URLSearchParams({ widgetId:'w', draft: JSON.stringify({ integrationId: state.instances[0].id, count: 4 }) });
    const result = await (await recentGet(get(query.toString()))).json(), cover = result.albums[0].cover;
    expect((await imageGet(image(cover))).status).toBe(200);
    const stripped = new URL(cover,'https://nasdash.example.com'); stripped.searchParams.delete('draft');
    expect((await imageGet(new NextRequest(stripped))).status).toBe(404);
    state.admin = false; expect((await imageGet(image(cover))).status).toBe(404);
  });
  it.each(['image/svg+xml','text/html','application/json'])('rejects live %s despite valid membership', async contentType => {
    const result = await (await nowGet(get())).json(); vi.mocked(serviceBytes).mockResolvedValue({ bytes: Buffer.from('<svg/>'), contentType, status:200 });
    const response = await imageGet(image(result.sessions[0].track.cover)); expect(response.status).toBe(502); expect(await response.json()).toEqual({error:'widgets.error.parse'});
  });
});

describe('offline demos and week boundaries', () => {
  it.each(MUSIC_WIDGET_TYPES)('serves fictional %s data and art without any upstream requests', async type => {
    state.demo = true; setType(type);
    const result = await (await routes[MUSIC_WIDGET_TYPES.indexOf(type)](get())).json();
    expect(result.server).toBe('navidrome');
    const cover = type === 'music-nowplaying' ? result.sessions[0].track.cover : type === 'music-library' ? result.week[0].cover : result.albums[0].cover;
    expect((await imageGet(image(cover))).headers.get('content-type')).toBe('image/svg+xml');
    for (const collect of [collectNavidromeNowPlaying, collectNavidromeRecent, collectNavidromeLibrary, collectNavidromeTop, serviceJson, serviceBytes]) expect(collect).not.toHaveBeenCalled();
  });
  it('accepts demo visitor connections while remaining offline', async () => {
    state.demo = true; saved().integrationId = 'navidrome-visitor'; expect((await nowGet(get())).status).toBe(200); expect(serviceBytes).not.toHaveBeenCalled();
  });
  it('counts all albums in the week beyond the displayed eight, including pagination', async () => {
    const read = vi.fn(async (offset: number) => Array.from({length: offset === 0 ? 200 : 10}, (_,n) => ({ id:`album-${offset+n}`, title:'Fictional', addedAt:Date.now() - 1000 })));
    const result = await musicWeek(read); expect(result.week).toHaveLength(8); expect(result.weekCount).toBe(210); expect(read).toHaveBeenCalledTimes(2);
  });
  it('omits a total when dates or a complete window are unavailable', async () => {
    expect((await musicWeek(async () => [{id:'unknown',title:'Unknown'}])).weekCount).toBeUndefined();
    const result = await musicWeek(async offset => Array.from({length:200}, (_,n) => ({ id:`album-${offset+n}`,title:'Fictional',addedAt:Date.now() })));
    expect(result.week).toHaveLength(8); expect(result.weekCount).toBeUndefined();
  });
});


it.each(['jellyfin', 'emby', 'plex'])('dispatches all music routes and cover requests to the %s collector without changing video routes', async type => {
  const source = state.instances[0]; source.type = type; source.secrets = { apiKey:'fictional-key', token:'fictional-token' };
  vi.mocked(serviceJson).mockImplementation(async (_source, path) => {
    if (type === 'plex') {
      if (path === '/') return plexMusic.identity;
      if (path === '/status/sessions') return plexMusic.sessions;
      if (path === '/library/sections') return plexMusic.sections;
      if (path.includes('/genre?')) return plexMusic.genres;
      if (path.includes('Size=0')) return { MediaContainer:{totalSize:2} };
      return plexMusic.albums;
    }
    if (path.includes('/Sessions?')) return jellyfinMusic.sessions;
    if (path.endsWith('/Users')) return jellyfinMusic.users;
    if (path.endsWith('/Counts')) return jellyfinMusic.counts;
    if (path.includes('/MusicGenres?')) return jellyfinMusic.genres;
    return jellyfinMusic.albums;
  });
  for (const [index, widgetType] of MUSIC_WIDGET_TYPES.entries()) {
    setType(widgetType); const response = await routes[index](get()); expect(response.status).toBe(200);
    const result = await response.json(); expect(result.server).toBe(type);
    if (widgetType !== 'music-library') {
      const cover = index === 0 ? result.sessions[0].track.cover : result.albums[0].cover;
      expect((await imageGet(image(cover))).status).toBe(200);
    }
  }
  for (const [,path,options] of vi.mocked(serviceBytes).mock.calls) {
    expect(path).not.toMatch(/fictional-key|fictional-token|[?&](u|t|s)=/);
    expect(options?.headers).toEqual(type === 'plex' ? { 'X-Plex-Token':'fictional-token', Accept:'application/json' } : { 'X-Emby-Token':'fictional-key' });
  }
});
