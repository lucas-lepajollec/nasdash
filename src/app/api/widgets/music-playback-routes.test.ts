import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { IntegrationInstance } from '@/lib/types';
import type { Page } from '@/lib/pages/types';
const state = vi.hoisted(() => ({ demo: false, role: 'admin', anonymous: false, authenticated: true, denied: false, csrf: false, instances: [] as IntegrationInstance[], pages: [] as Page[] }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ settings: { securityMode: 'public' }, integrations: state.instances }) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
vi.mock('@/lib/auth', async original => ({ ...await original<typeof import('@/lib/auth')>(), checkAdmin: () => state.csrf || state.role !== 'admin' ? new Response(null, { status: 403 }) : null }));
vi.mock('@/lib/access', async original => ({ ...await original<typeof import('@/lib/access')>(), resolveAccessPrincipal: () => state.authenticated ? { username: 'reader', role: state.role, allowedTabs: [], allowedWidgets: state.denied ? ['__nasdash_none__'] : [], isAnonymous: state.anonymous } : null }));
vi.mock('@/lib/pages/store', async original => ({ ...await original<typeof import('@/lib/pages/store')>(), readPagesDocument: () => ({ schemaVersion: 5, pages: state.pages }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceStream: vi.fn(), serviceJson: vi.fn(), serviceBytes: vi.fn() }));
vi.mock('@/integrations/navidrome/collect', async original => ({ ...await original<typeof import('@/integrations/navidrome/collect')>(), collectNavidromeNowPlaying: vi.fn(), collectNavidromeRecent: vi.fn(), collectNavidromeTracks: vi.fn(), collectNavidromePlaylists: vi.fn(), collectNavidromeSearch: vi.fn() }));
vi.mock('@/integrations/jellyfin/collect', async original => ({ ...await original<typeof import('@/integrations/jellyfin/collect')>(), controlJellyfinMusic: vi.fn(), collectJellyfinMusicNowPlaying: vi.fn(), jellyfinMusicStreamPath: vi.fn() }));
import { GET as now } from './music/now-playing/route';
import { GET as recent } from './music/recent/route';
import { GET as tracks } from './music/tracks/route';
import { GET as search } from './music/search/route';
import { GET as stream } from './music/stream/route';
import { GET as playlists } from './music/playlists/route';
import { POST as control } from './music/control/route';
import { serviceStream, serviceJson, serviceBytes } from '@/lib/widgetData/services';
import { collectNavidromeNowPlaying, collectNavidromeRecent, collectNavidromeTracks, collectNavidromePlaylists, collectNavidromeSearch } from '@/integrations/navidrome/collect';
import { collectJellyfinMusicNowPlaying, controlJellyfinMusic, jellyfinMusicStreamPath } from '@/integrations/jellyfin/collect';
import { knownMusicTrack, rememberMusicTrack } from '@/lib/widgetData/music';
const get = (query = '') => new NextRequest(`https://nasdash.example.com/api/widgets/music/stream?widgetId=w${query ? '&' + query : ''}`);
const post = (body: unknown) => new NextRequest('https://nasdash.example.com/api/widgets/music/control', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: 'https://nasdash.example.com' } });
const settings = () => state.pages[0].widgets[0].settings;
const type = (type: string) => { state.pages[0].widgets[0].type = type; };
let serial = 0;
beforeEach(() => {
  vi.resetAllMocks(); state.demo = false; state.role = 'admin'; state.anonymous = false; state.authenticated = true; state.denied = false; state.csrf = false;
  state.instances = [{ id: `playback-route-${++serial}`, type: 'navidrome', name: 'Fictional Music', settings: { url: 'https://music.example.com', username: 'alex' }, secrets: { password: 'fictional-password', apiKey: 'fictional-key', token: 'fictional-token' } }];
  state.pages = [{ id: 'dashboard', name: 'Dashboard', icon: '', revision: 1, widgets: [{ id: 'w', type: 'music-nowplaying', x: 0, y: 0, w: 12, h: 10, settings: { integrationId: state.instances[0].id } }] }];
  const track = { id: 'song', title: 'Glass', cover: '/rest/getCoverArt?id=art&size=600' };
  vi.mocked(collectNavidromeNowPlaying).mockResolvedValue({ server: 'navidrome', name: 'Fictional', fetchedAt: 1, sessions: [{ id: 'session', state: 'playing', track, next: [{ ...track, id: 'next' }] }] });
  vi.mocked(collectNavidromeRecent).mockResolvedValue({ server: 'navidrome', name: 'Fictional', fetchedAt: 1, albums: [], tracks: [track] });
  vi.mocked(collectNavidromeTracks).mockResolvedValue([track]);
  vi.mocked(collectNavidromeSearch).mockResolvedValue({ tracks: [track], albums: [{ id: 'album', title: 'Garden', cover: track.cover }], playlists: [{ id: 'playlist', name: 'Quiet', cover: track.cover }] });
  vi.mocked(collectNavidromePlaylists).mockResolvedValue({ server: 'navidrome', name: 'Fictional', fetchedAt: 1, playlists: [{ id: 'playlist', name: 'Quiet', cover: track.cover }] });
  vi.mocked(serviceStream).mockImplementation(async () => new Response(new Uint8Array([1, 2]), { status: 206, headers: { 'Content-Type': 'audio/flac', 'Content-Range': 'bytes 0-1/100', 'Content-Length': '2' } }));
});
it('allows signed-in media viewers to stream listed tracks only, within the widget, connection and preview', async () => {
  expect((await stream(get('id=song'))).status).toBe(404);
  await now(get()); state.role = 'viewer';
  expect((await stream(get('id=song'))).status).toBe(206); expect((await stream(get('id=next'))).status).toBe(206);
  state.pages[0].widgets.push({ ...state.pages[0].widgets[0], id: 'other' });
  expect((await stream(new NextRequest('https://nasdash.example.com/api/widgets/music/stream?widgetId=other&id=song'))).status).toBe(404);
  state.instances[0].secrets!.password = 'changed'; expect((await stream(get('id=song'))).status).toBe(404);
  state.role = 'admin'; const draft = new URLSearchParams({ draft: JSON.stringify({ integrationId: state.instances[0].id }) });
  await now(get(draft.toString())); expect((await stream(get('id=song&' + draft))).status).toBe(206);
  expect((await stream(get('id=song'))).status).toBe(404);
});
it('refuses anonymous, unauthenticated and media-denied readers before fetching audio', async () => {
  await now(get()); state.role = 'viewer'; state.anonymous = true;
  expect((await stream(get('id=song'))).status).toBe(401);
  state.anonymous = false; state.authenticated = false; expect((await stream(get('id=song'))).status).toBe(401);
  state.authenticated = true; state.denied = true; expect((await stream(get('id=song'))).status).toBe(403);
  expect(serviceStream).not.toHaveBeenCalled();
});
it('forwards a single byte range with server-only Subsonic auth and preserves the streaming response', async () => {
  await now(get()); const request = get('id=song'); request.headers.set('Range', 'bytes=0-1');
  const response = await stream(request); expect(response.status).toBe(206); expect(response.headers.get('content-range')).toBe('bytes 0-1/100');
  expect((await response.arrayBuffer()).byteLength).toBe(2);
  const [, path, headers] = vi.mocked(serviceStream).mock.calls[0];
  const url = new URL(path, 'https://fixture'); expect(url.pathname).toBe('/rest/stream'); expect(url.searchParams.get('format')).toBe('raw'); expect(url.searchParams.get('id')).toBe('song'); expect(url.searchParams.get('t')).toMatch(/^[a-f0-9]{32}$/); expect(headers.Range).toBe('bytes=0-1');
  const bad = get('id=song'); bad.headers.set('Range', 'bytes=0-1,4-5'); expect((await stream(bad)).status).toBe(400);
});
it('registers tracks from recent, search and album/playlist expansion, and proxies every cover', async () => {
  for (const route of [recent, search, tracks]) {
    state.instances[0].id += '-next'; settings().integrationId = state.instances[0].id;
    type(route === recent ? 'music-recent' : 'music-top'); settings().content = 'tracks';
    const result = await (await route(get(route === search ? 'q=Glass' : 'kind=playlist&id=playlist'))).json();
    expect(result.tracks[0].cover).toContain('/api/widgets/media/image?');
    expect(knownMusicTrack(state.instances[0], 'w', 'song')).toBe(true);
    expect((await stream(get('id=song'))).status).toBe(206);
  }
  type('music-playlists'); const lists = await (await playlists(get())).json(); expect(lists.playlists[0].cover).toContain('/media/image?');
  expect((await tracks(get('kind=album&id=album'))).status).toBe(200);
});
it('separates recent cache entries by content and validates bounded search, kinds and playlist counts', async () => {
  type('music-recent'); await recent(get()); settings().content = 'tracks'; await recent(get()); settings().content = 'albums'; await recent(get());
  expect(collectNavidromeRecent).toHaveBeenCalledTimes(3); settings().content = 'invalid'; expect((await recent(get())).status).toBe(400);
  for (const query of ['q=x', 'q=' + 'a'.repeat(81)]) expect((await search(get(query))).status).toBe(400);
  expect((await tracks(get('kind=video&id=x'))).status).toBe(400);
  type('music-playlists'); settings().count = 2; expect((await playlists(get())).status).toBe(400);
});
it('only advertises control to admins and checks admin, CSRF, server and action on POST', async () => {
  state.instances[0].type = 'jellyfin'; vi.mocked(jellyfinMusicStreamPath).mockResolvedValue('/Audio/song/universal?UserId=alex');
  vi.mocked(collectJellyfinMusicNowPlaying).mockResolvedValue({ server: 'jellyfin', name: 'Fictional', fetchedAt: 1, sessions: [{ id: 'session', track: { id: 'song', title: 'Glass' }, state: 'playing', canControl: true }] });
  expect((await (await now(get())).json()).sessions[0].canControl).toBe(true);
  state.role = 'viewer'; expect((await (await now(get())).json()).sessions[0].canControl).toBe(false);
  const body = { widgetId: 'w', sessionId: 'session', action: 'next' };
  expect((await control(post(body))).status).toBe(403); state.role = 'admin'; state.csrf = true; expect((await control(post(body))).status).toBe(403);
  state.csrf = false; expect((await control(post({ ...body, action: 'delete' }))).status).toBe(400);
  vi.mocked(controlJellyfinMusic).mockResolvedValue(); expect((await control(post(body))).status).toBe(200); expect(controlJellyfinMusic).toHaveBeenCalledWith(state.instances[0], 'session', 'next');
  expect((await stream(get('id=song'))).status).toBe(206); expect(vi.mocked(serviceStream).mock.calls.at(-1)![2]).toMatchObject({ 'X-Emby-Token': 'fictional-key' });
  state.instances[0].type = 'plex'; expect((await control(post(body))).status).toBe(422);
});
it('keeps demo playlists, search, history, audio and control offline, with valid WAV ranges', async () => {
  state.demo = true;
  type('music-playlists'); expect((await (await playlists(get())).json()).playlists.length).toBeGreaterThan(0);
  expect((await (await search(get('q=Glass'))).json()).tracks.length).toBeGreaterThan(0);
  type('music-recent'); settings().content = 'tracks'; const history = await (await recent(get())).json(); expect(history.tracks.length).toBeGreaterThan(0);
  const request = get('id=' + history.tracks[0].id); let response = await stream(request); const wav = Buffer.from(await response.arrayBuffer()); expect(wav.toString('ascii', 0, 4)).toBe('RIFF'); expect(wav.length).toBeLessThan(10000);
  request.headers.set('Range', 'bytes=0-43'); response = await stream(request); expect(response.status).toBe(206); expect(response.headers.get('content-range')).toBe(`bytes 0-43/${wav.length}`); expect((await response.arrayBuffer()).byteLength).toBe(44);
  request.headers.set('Range', 'bytes=-10'); expect((await (await stream(request)).arrayBuffer()).byteLength).toBe(10);
  request.headers.set('Range', 'bytes=999999-'); expect((await stream(request)).status).toBe(416);
  state.instances[0].type = 'emby'; type('music-nowplaying'); expect((await control(post({ widgetId: 'w', sessionId: 'demo-music-session', action: 'playpause' }))).status).toBe(200);
  for (const fn of [serviceStream, serviceJson, serviceBytes, collectNavidromeNowPlaying, collectNavidromeRecent, collectNavidromeSearch, collectNavidromeTracks, collectNavidromePlaylists, controlJellyfinMusic]) expect(fn).not.toHaveBeenCalled();
});

it('expires stream membership after a day and keeps preview membership separate', () => {
  vi.useFakeTimers();
  try {
    const source = state.instances[0];
    rememberMusicTrack(source, 'w', 'expiring');
    expect(knownMusicTrack(source, 'w', 'expiring')).toBe(true);
    expect(knownMusicTrack(source, 'other', 'expiring')).toBe(false);
    expect(knownMusicTrack(source, 'w', 'expiring', { count: 4 })).toBe(false);
    vi.advanceTimersByTime(86400000);
    expect(knownMusicTrack(source, 'w', 'expiring')).toBe(false);
  } finally { vi.useRealTimers(); }
});
it('opts in to playlist owner names without changing covers or stream membership', async () => {
  type('music-playlists');
  vi.mocked(collectNavidromePlaylists).mockResolvedValue({ server: 'navidrome', name: 'Fictional', fetchedAt: 1, playlists: [{ id: 'playlist', name: 'Quiet', owner: 'Alex' }] });
  expect((await (await playlists(get())).json()).playlists[0].owner).toBeUndefined();
  settings().showUsers = true; expect((await (await playlists(get())).json()).playlists[0].owner).toBe('Alex');
  expect(knownMusicTrack(state.instances[0], 'w', 'playlist')).toBe(false);
});
