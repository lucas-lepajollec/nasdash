import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { DashboardConfig, IntegrationInstance } from '@/lib/types';
import type { Page, PagesDocument } from '@/lib/pages/types';
import type { AccessPrincipal } from '@/lib/access';
import jellyfin from '@/integrations/jellyfin/samples/service.json';
const state = vi.hoisted(() => ({ demo: false, admin: true, authenticated: true, instances: [] as IntegrationInstance[], pages: [] as Page[], allowedTabs: [] as string[], allowedWidgets: [] as string[] }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ settings: { securityMode: 'public' }, integrations: state.instances }) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
vi.mock('@/lib/access', async original => ({ ...await original<typeof import('@/lib/access')>(), resolveAccessPrincipal: () => state.authenticated ? { username: 'reader', role: state.admin ? 'admin' : 'viewer', allowedTabs: state.allowedTabs, allowedWidgets: state.allowedWidgets, isAnonymous: !state.admin } : null }));
vi.mock('@/lib/pages/store', async original => ({ ...await original<typeof import('@/lib/pages/store')>(), readPagesDocument: (): PagesDocument => ({ schemaVersion: 5, pages: state.pages }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn(), serviceBytes: vi.fn() }));
vi.mock('@/integrations/jellyfin/collect', async original => ({ ...await original<typeof import('@/integrations/jellyfin/collect')>(), collectJellyfinNowPlaying: vi.fn(), collectJellyfinRecent: vi.fn(), collectJellyfinLibrary: vi.fn() }));
vi.mock('@/integrations/plex/collect', async original => ({ ...await original<typeof import('@/integrations/plex/collect')>(), collectPlexNowPlaying: vi.fn(), collectPlexRecent: vi.fn(), collectPlexLibrary: vi.fn() }));
import { GET as nowGet } from './media/now-playing/route';
import { GET as recentGet } from './media/recent/route';
import { GET as libraryGet } from './media/library/route';
import { GET as imageGet } from './media/image/route';
import { collectJellyfinLibrary, collectJellyfinNowPlaying, collectJellyfinRecent, toJellyfinItem, toJellyfinSessions } from '@/integrations/jellyfin/collect';
import { collectPlexLibrary, collectPlexNowPlaying, collectPlexRecent } from '@/integrations/plex/collect';
import { serviceBytes, serviceJson, ServiceError } from '@/lib/widgetData/services';
import { buildConfigForPrincipal } from '@/lib/configAccess';
const get = (query = 'widgetId=w') => new NextRequest(`https://nasdash.example.com/api/widgets/media/recent?${query}`);
const image = (path: string) => new NextRequest(new URL(path, 'https://nasdash.example.com'));
const saved = () => state.pages[0].widgets[0].settings;
const setType = (type: string) => { state.pages[0].widgets[0].type = type; };
let serial = 0;
beforeEach(() => {
  vi.resetAllMocks(); state.demo = false; state.admin = true; state.authenticated = true; state.allowedTabs = []; state.allowedWidgets = [];
  state.instances = [{ id: `jellyfin-test-${++serial}`, type: 'jellyfin', name: 'Fictional Library', settings: { url: 'https://media.example.com' }, secrets: { apiKey: 'fictional-secret' } },
    { id: 'wrong-type', type: 'immich', name: 'Photos', settings: {} }];
  state.pages = [{ id: 'dashboard', name: 'Dashboard', icon: '', revision: 1, widgets: [{ id: 'w', type: 'media-nowplaying', x: 0, y: 0, w: 12, h: 10, settings: { integrationId: state.instances[0].id } }] }];
  const source = state.instances[0];
  vi.mocked(collectJellyfinNowPlaying).mockResolvedValue({ server: 'jellyfin', name: source.name, sessions: toJellyfinSessions(source, jellyfin.sessions), fetchedAt: 1000 });
  vi.mocked(collectJellyfinRecent).mockResolvedValue({ server: 'jellyfin', name: source.name, items: jellyfin.recent.Items.map(value => toJellyfinItem(source, value)!), fetchedAt: 1000 });
  vi.mocked(collectJellyfinLibrary).mockResolvedValue({ server: 'jellyfin', name: source.name, counts: { movies: 284 }, libraries: [{ name: 'Evening Cinema', kind: 'movies' }], fetchedAt: 1000 });
  vi.mocked(serviceBytes).mockResolvedValue({ bytes: Buffer.from('fictional-raster'), contentType: 'image/webp', status: 200 });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('media data routes', () => {
  it('filters links and users after the shared cache, with showUsers applied only to users', async () => {
    const admin = await nowGet(get());
    expect(admin.headers.get('cache-control')).toBe('private, no-store');
    const full = await admin.json();
    expect(full.sessions[0].user).toBe('Alex'); expect(full.sessions[0].item.link).toContain('media.example.com');
    state.admin = false;
    let result = await (await nowGet(get())).json();
    expect(result.sessions[0].user).toBeUndefined(); expect(result.sessions[0].item.link).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/media\.example\.com|fictional-secret|\/Items\//);
    saved().showUsers = true;
    result = await (await nowGet(get())).json();
    expect(result.sessions[0].user).toBe('Alex'); expect(result.sessions[0].item.link).toBeUndefined();
    expect(collectJellyfinNowPlaying).toHaveBeenCalledTimes(1);
  });
  it('uses saved recent settings, defaults, and administrator drafts, ignoring viewer drafts', async () => {
    setType('media-recent');
    await recentGet(get());
    expect(collectJellyfinRecent).toHaveBeenLastCalledWith(state.instances[0], { kinds: ['movie', 'episode', 'album'], count: 16 });
    const draft = encodeURIComponent(JSON.stringify({ integrationId: state.instances[0].id, kinds: ['album'], count: 4 }));
    const preview = await (await recentGet(get(`widgetId=w&draft=${draft}`))).json();
    expect(collectJellyfinRecent).toHaveBeenLastCalledWith(state.instances[0], { kinds: ['album'], count: 4 });
    expect(preview.items[0].poster).toContain('draft=');
    state.admin = false;
    const visitor = await (await recentGet(get(`widgetId=w&draft=${draft}&url=https://other.example.com`))).json();
    expect(visitor.items[0].poster).not.toContain('draft='); expect(visitor.items[0].link).toBeUndefined();
    expect(collectJellyfinRecent).toHaveBeenCalledTimes(2);
  });
  it.each([
    ['count', 3], ['count', 41], ['count', 4.5], ['count', '16'], ['count', null],
    ['kinds', []], ['kinds', ['track']], ['kinds', ['movie', 'movie']], ['kinds', 'movie'], ['kinds', null],
    ['integrationId', 3], ['integrationId', null], ['integrationId', ''],
  ])('rejects invalid recent %s=%j without contacting a server', async (field, value) => {
    setType('media-recent'); saved()[field] = value;
    const response = await recentGet(get());
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: 'widgets.error.invalidSettings' });
    expect(collectJellyfinRecent).not.toHaveBeenCalled();
  });
  it('rejects non-boolean showUsers and malformed or oversized draft settings', async () => {
    saved().showUsers = 'true';
    expect((await nowGet(get())).status).toBe(400);
    expect((await nowGet(get('widgetId=w&draft=%7Bbad'))).status).toBe(400);
    expect((await nowGet(get(`widgetId=w&draft=${'x'.repeat(16385)}`))).status).toBe(400);
    expect(collectJellyfinNowPlaying).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated, wrong-type, hidden, disallowed and missing widgets and connections', async () => {
    state.authenticated = false; expect((await nowGet(get())).status).toBe(401); state.authenticated = true;
    expect((await nowGet(get('widgetId=absent'))).status).toBe(404);
    setType('photos'); expect((await nowGet(get())).status).toBe(404);
    expect((await imageGet(get('widgetId=w&id=' + 'a'.repeat(64) + '&kind=poster'))).status).toBe(404);
    setType('media-nowplaying'); saved().integrationId = 'wrong-type'; expect((await nowGet(get())).status).toBe(404);
    saved().integrationId = 'missing'; expect((await nowGet(get())).status).toBe(404);
    saved().integrationId = state.instances[0].id; state.admin = false;
    state.pages[0].widgets[0].hidden = true; expect((await nowGet(get())).status).toBe(404); state.pages[0].widgets[0].hidden = false;
    state.allowedWidgets = ['photos']; expect((await nowGet(get())).status).toBe(404); state.allowedWidgets = [];
    state.allowedTabs = ['docker']; expect((await nowGet(get())).status).toBe(404);
    expect(collectJellyfinNowPlaying).not.toHaveBeenCalled(); expect(serviceBytes).not.toHaveBeenCalled();
  });
  it.each([
    ['media-nowplaying', nowGet, collectJellyfinNowPlaying, 5000],
    ['media-recent', recentGet, collectJellyfinRecent, 120000],
    ['media-library', libraryGet, collectJellyfinLibrary, 300000],
  ] as const)('expires %s at its TTL and invalidates credential changes', async (type, route, collect, ttl) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-16T12:00:00Z')); setType(type);
    await route(get()); vi.advanceTimersByTime(ttl - 1); await route(get()); expect(collect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1); await route(get()); expect(collect).toHaveBeenCalledTimes(2);
    state.instances[0].secrets!.apiKey = 'changed-fictional-key'; await route(get()); expect(collect).toHaveBeenCalledTimes(3);
  });
  it('dispatches Plex and Emby to the matching collector', async () => {
    state.instances[0].type = 'plex';
    vi.mocked(collectPlexNowPlaying).mockResolvedValue({ server: 'plex', name: 'Fictional Plex', sessions: [], fetchedAt: 1000 });
    vi.mocked(collectPlexRecent).mockResolvedValue({ server: 'plex', name: 'Fictional Plex', items: [], fetchedAt: 1000 });
    vi.mocked(collectPlexLibrary).mockResolvedValue({ server: 'plex', name: 'Fictional Plex', counts: {}, libraries: [], fetchedAt: 1000 });
    await nowGet(get()); setType('media-recent'); await recentGet(get()); setType('media-library'); await libraryGet(get());
    expect(collectPlexNowPlaying).toHaveBeenCalledWith(state.instances[0]); expect(collectPlexRecent).toHaveBeenCalled(); expect(collectPlexLibrary).toHaveBeenCalled();
    state.instances[0].type = 'emby'; setType('media-nowplaying'); await nowGet(get());
    expect(collectJellyfinNowPlaying).toHaveBeenCalledWith(state.instances[0]);
  });
  it('sanitizes upstream failures', async () => {
    vi.mocked(collectJellyfinNowPlaying).mockRejectedValue(new Error('https://private.example.com?token=secret'));
    expect(await (await nowGet(get())).json()).toEqual({ error: 'widgets.error.network' });
  });
});

describe('media image proxy', () => {
  it('serves listed paths only, with per-widget, per-kind, per-instance and credential membership', async () => {
    state.admin = false;
    const data = await (await nowGet(get())).json(), poster = data.sessions[0].item.poster;
    state.pages[0].widgets.push({ ...state.pages[0].widgets[0], id: 'other' });
    expect((await imageGet(image(poster.replace('widgetId=w', 'widgetId=other')))).status).toBe(404);
    expect((await imageGet(image(poster.replace('kind=poster', 'kind=backdrop')))).status).toBe(404);
    expect((await imageGet(get(`widgetId=w&id=${'a'.repeat(64)}&kind=poster`))).status).toBe(404);
    const response = await imageGet(image(poster + '&url=https://attacker.example.com/secret'));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, max-age=86400');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff'); expect(response.headers.get('content-type')).toBe('image/webp');
    expect(serviceBytes).toHaveBeenCalledWith(state.instances[0], '/Items/movie-1/Images/Primary?fillHeight=480&quality=90', { headers: { 'X-Emby-Token': 'fictional-secret' } }, 8 * 1024 * 1024);
    state.instances[0].secrets!.apiKey = 'rotated-fictional-key'; expect((await imageGet(image(poster))).status).toBe(404);
    state.instances[0].secrets!.apiKey = 'fictional-secret'; state.instances[0].id = 'another-connection'; saved().integrationId = 'another-connection';
    expect((await imageGet(image(poster))).status).toBe(404);
    expect(serviceBytes).toHaveBeenCalledTimes(1);
  });
  it.each(['media-nowplaying', 'media-recent'] as const)('resolves images from %s widgets', async type => {
    setType(type); const data = await (await (type === 'media-recent' ? recentGet : nowGet)(get())).json();
    expect((await imageGet(image(type === 'media-recent' ? data.items[0].backdrop : data.sessions[0].item.backdrop))).status).toBe(200);
  });
  it('remembers cached responses separately for each widget and accepts all three media widget types', async () => {
    const poster = (await (await nowGet(get())).json()).sessions[0].item.poster;
    state.pages[0].widgets.push({ ...state.pages[0].widgets[0], id: 'other' });
    const other = (await (await nowGet(get('widgetId=other'))).json()).sessions[0].item.poster;
    expect(collectJellyfinNowPlaying).toHaveBeenCalledTimes(1);
    expect((await imageGet(image(other))).status).toBe(200);
    setType('media-library');
    expect((await imageGet(image(poster))).status).toBe(200);
  });
  it('isolates draft image membership from saved widgets and viewers', async () => {
    const draft = encodeURIComponent(JSON.stringify({ integrationId: state.instances[0].id, showUsers: true }));
    const data = await (await nowGet(get(`widgetId=w&draft=${draft}`))).json(), poster = data.sessions[0].item.poster;
    expect((await imageGet(image(poster))).status).toBe(200);
    const noDraft = new URL(poster, 'https://nasdash.example.com'); noDraft.searchParams.delete('draft');
    expect((await imageGet(new NextRequest(noDraft))).status).toBe(404);
    state.admin = false; expect((await imageGet(image(poster))).status).toBe(404);
    expect(serviceBytes).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid ids, invalid kinds, active content and upstream failure', async () => {
    for (const query of ['id=../private&kind=poster', `id=${'a'.repeat(64)}&kind=thumb`]) expect((await imageGet(get(`widgetId=w&${query}`))).status).toBe(400);
    const data = await (await nowGet(get())).json(), poster = data.sessions[0].item.poster;
    for (const contentType of ['image/svg+xml', 'text/html', 'application/octet-stream']) {
      vi.mocked(serviceBytes).mockResolvedValue({ bytes: Buffer.from('<svg/>'), status: 200, contentType });
      expect((await imageGet(image(poster))).status).toBe(502);
    }
    vi.mocked(serviceBytes).mockResolvedValue({ bytes: Buffer.alloc(0), status: 302, contentType: 'image/jpeg' });
    expect((await imageGet(image(poster))).status).toBe(502);
    vi.mocked(serviceBytes).mockRejectedValue(new ServiceError('widgets.error.tooLarge'));
    expect(await (await imageGet(image(poster))).json()).toEqual({ error: 'widgets.error.tooLarge' });
  });
  it('expires membership after a day', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
    const poster = (await (await nowGet(get())).json()).sessions[0].item.poster;
    vi.advanceTimersByTime(86400000);
    expect((await imageGet(image(poster))).status).toBe(404); expect(serviceBytes).not.toHaveBeenCalled();
  });
});

it.each(['jellyfin', 'emby', 'plex'])('never fetches %s demo data or artwork and still checks membership', async type => {
  state.demo = true; state.admin = false; state.instances[0].type = type;
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Demo fetched'));
  expect((await (await nowGet(get())).json()).sessions[0].item.title).toBe('The Quiet Orbit');
  setType('media-recent'); saved().kinds = ['album']; saved().count = 4;
  const response = await recentGet(get()), data = await response.json();
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(data.items).toHaveLength(4); expect(data.items.every((item: { kind: string }) => item.kind === 'album')).toBe(true);
  const poster = await imageGet(image(data.items[0].poster));
  expect(poster.headers.get('content-type')).toBe('image/svg+xml'); expect(poster.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox");
  expect(await poster.text()).toContain('<linearGradient');
  expect((await imageGet(get(`widgetId=w&id=${'f'.repeat(64)}&kind=poster`))).status).toBe(404);
  setType('media-library'); expect((await (await libraryGet(get())).json()).counts.movies).toBe(284);
  expect(fetchSpy).not.toHaveBeenCalled(); expect(serviceBytes).not.toHaveBeenCalled(); expect(serviceJson).not.toHaveBeenCalled();
  for (const collect of [collectJellyfinNowPlaying, collectJellyfinRecent, collectJellyfinLibrary, collectPlexNowPlaying, collectPlexRecent, collectPlexLibrary]) expect(collect).not.toHaveBeenCalled();
});

it('strips media server addresses and credentials from viewer configuration', () => {
  const viewer: AccessPrincipal = { username: 'reader', role: 'viewer', allowedTabs: [], allowedWidgets: [], isAnonymous: true };
  const config = { version: 1, settings: { title: 'Lab', showMonitor: true }, categories: [], integrations: ['jellyfin', 'emby', 'plex'].map(type => ({ ...state.instances[0], type })) } as DashboardConfig;
  const output = buildConfigForPrincipal(config, viewer);
  expect(output.integrations?.every(instance => !Object.keys(instance.settings).length && !instance.secrets)).toBe(true);
  expect(JSON.stringify(output)).not.toMatch(/media\.example\.com|fictional-secret/);
  const admin = buildConfigForPrincipal(config, { ...viewer, role: 'admin' });
  expect(admin.integrations?.[0].settings.url).toBe('https://media.example.com'); expect(admin.integrations?.[0].secrets?.apiKey).toBe('********');
});
