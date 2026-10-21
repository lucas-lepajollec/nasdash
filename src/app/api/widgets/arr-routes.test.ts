import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { DashboardConfig, IntegrationInstance } from '@/lib/types';
import type { Page, PagesDocument, WidgetSettings } from '@/lib/pages/types';
import type { AccessPrincipal } from '@/lib/access';
import { ARR_TYPES, DOWNLOAD_CLIENT_TYPES } from '@/lib/widgetData/contracts';
import sonarr from '@/integrations/sonarr/samples/service.json';
import radarr from '@/integrations/radarr/samples/service.json';
const state = vi.hoisted(() => ({ demo: false, admin: true, authenticated: true, instances: [] as IntegrationInstance[], pages: [] as Page[], allowedTabs: [] as string[], allowedWidgets: [] as string[] }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ settings: { securityMode: 'public' }, integrations: state.instances }) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
vi.mock('@/lib/access', async original => ({ ...await original<typeof import('@/lib/access')>(), resolveAccessPrincipal: () => state.authenticated ? { username: 'reader', role: state.admin ? 'admin' : 'viewer', allowedTabs: state.allowedTabs, allowedWidgets: state.allowedWidgets, isAnonymous: !state.admin } : null }));
vi.mock('@/lib/pages/store', async original => ({ ...await original<typeof import('@/lib/pages/store')>(), readPagesDocument: (): PagesDocument => ({ schemaVersion: 5, pages: state.pages }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn(), serviceBytes: vi.fn() }));
vi.mock('@/integrations/arr/collect', async original => ({ ...await original<typeof import('@/integrations/arr/collect')>(), collectArrUpcoming: vi.fn(), collectArrQueue: vi.fn(), collectArrRecent: vi.fn(), collectArrStatus: vi.fn(), collectProwlarrIndexers: vi.fn() }));
vi.mock('@/lib/widgetData/libraryUpcoming', () => ({ collectLibraryUpcoming: vi.fn() }));
vi.mock('@/integrations/downloads/collect', () => ({ collectDownloadClient: vi.fn() }));
vi.mock('@/integrations/catalog/collect', () => ({ collectExternal: vi.fn(), searchCatalog: vi.fn() }));
import { collectExternal, searchCatalog } from '@/integrations/catalog/collect';
import { GET as catalogGet } from './arr/catalog/route';
import { GET as upcomingGet } from './arr/upcoming/route';
import { GET as queueGet } from './arr/queue/route';
import { GET as statusGet } from './arr/status/route';
import { GET as indexersGet } from './arr/indexers/route';
import { GET as downloadsGet } from './downloads/route';
import { GET as imageGet } from './media/image/route';
import { collectArrUpcoming, collectArrQueue, collectArrRecent, collectArrStatus, collectProwlarrIndexers, toArrUpcoming, toArrQueue } from '@/integrations/arr/collect';
import { collectLibraryUpcoming } from '@/lib/widgetData/libraryUpcoming';
import { demoMediaUpcoming } from '@/lib/widgetData/media';
import { collectDownloadClient } from '@/integrations/downloads/collect';
import { demoArrRecent, demoArrStatus, demoDownloadClient, demoIndexers } from '@/lib/widgetData/arrDemo';
import { serviceBytes, serviceJson, ServiceError } from '@/lib/widgetData/services';
import { buildConfigForPrincipal } from '@/lib/configAccess';
const get = (query = 'widgetId=w') => new NextRequest(`https://nasdash.example.com/api/widgets/arr/upcoming?${query}`);
const image = (path: string) => new NextRequest(new URL(path, 'https://nasdash.example.com'));
const widget = () => state.pages[0].widgets[0];
let serial = 0;
const source = (type: string): IntegrationInstance => ({ id: `${type}-test-${++serial}`, type, name: `Fictional ${type}`, settings: { url: `https://${type}.example.com`, username: 'fictional-user', allowSelfSigned: 'false' }, secrets: { apiKey: 'fictional-key', password: 'fictional-password' } });
const start = Date.parse('2026-10-21T00:00:00Z');
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(start);
  state.demo = false; state.admin = true; state.authenticated = true; state.allowedTabs = []; state.allowedWidgets = [];
  state.instances = [source('sonarr'), source('radarr'), source('prowlarr'), source('qbittorrent'), source('sabnzbd'), source('immich')];
  state.pages = [{ id: 'dashboard', name: 'Dashboard', icon: '', revision: 1, widgets: [{ id: 'w', type: 'media-upcoming', x: 0, y: 0, w: 12, h: 10, settings: {} }] }];
  vi.mocked(collectArrUpcoming).mockImplementation(async instance => toArrUpcoming(instance, instance.type === 'radarr' ? radarr.calendar : sonarr.calendar, start, start + 14 * 86400000));
  vi.mocked(collectArrQueue).mockImplementation(async instance => toArrQueue(instance, instance.type === 'radarr' ? radarr.queue : sonarr.queue));
  vi.mocked(collectArrRecent).mockImplementation(async instance => demoArrRecent(instance));
  vi.mocked(collectLibraryUpcoming).mockImplementation(async () => demoMediaUpcoming());
  vi.mocked(collectArrStatus).mockImplementation(async instance => demoArrStatus(instance));
  vi.mocked(collectProwlarrIndexers).mockImplementation(async instance => demoIndexers(instance));
  vi.mocked(collectDownloadClient).mockImplementation(async instance => demoDownloadClient(instance));
  vi.mocked(collectExternal).mockResolvedValue({ external: [{ id: 'kitsu:77', provider: 'kitsu', kind: 'anime', title: 'The Cloud Observatory', status: 'airing', phase: 'current', poster: 'https://media.kitsu.app/art.jpg' }], failures: [] });
  vi.mocked(searchCatalog).mockResolvedValue([{ provider: 'tvmaze', id: '42', kind: 'series', title: 'The Cloud Observatory' }]);
  vi.mocked(serviceBytes).mockResolvedValue({ bytes: Buffer.from('fictional-raster'), contentType: 'image/webp', status: 200 });
});
afterEach(() => vi.useRealTimers());

describe('*arr and download data routes', () => {
  it('defaults to all allowed types, filters links after shared caches and proxies art', async () => {
    const response = await upcomingGet(get()), admin = await response.json();
    expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(admin.items).toHaveLength(2);
    expect(admin.items[0].link).toContain('sonarr.example.com'); expect(admin.items[0].poster).toMatch(/^\/api\/widgets\/media\/image\?/);
    expect(collectArrUpcoming).toHaveBeenCalledTimes(2);
    state.admin = false;
    const viewer = await (await upcomingGet(get())).json();
    expect(viewer.items).toHaveLength(2); expect(viewer.items.every((item: { link?: string }) => item.link === undefined)).toBe(true);
    expect(JSON.stringify(viewer)).not.toMatch(/example.com|fictional-key|mediacover|fictional-password/);
    expect(collectArrUpcoming).toHaveBeenCalledTimes(2);
  });
  it('keeps successful sources and lists safe error keys without upstream details', async () => {
    vi.mocked(collectArrUpcoming).mockImplementation(async instance => { if (instance.type === 'radarr') throw new Error('https://private.example.com?apikey=secret'); return toArrUpcoming(instance, sonarr.calendar, start, start + 86400000 * 14); });
    const result = await (await upcomingGet(get())).json();
    expect(result.items).toHaveLength(1); expect(result.failures).toEqual([{ id: state.instances[1].id, name: 'Fictional radarr', error: 'widgets.error.network' }]);
    expect(JSON.stringify(result.failures)).not.toMatch(/private|secret|apikey/);
  });
  it('starts independent source requests together', async () => {
    const started: string[] = []; let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(collectArrUpcoming).mockImplementation(async instance => { started.push(instance.id); await gate; return []; });
    const pending = upcomingGet(get());
    expect(started).toEqual(state.instances.slice(0, 2).map(instance => instance.id)); release();
    expect((await pending).status).toBe(200);
  });
  it('validates days and kinds before fetching, and filters calendars', async () => {
    widget().settings = { integrationIds: [state.instances[1].id], days: 5, kinds: ['movie'] };
    const result = await (await upcomingGet(get())).json(); expect(result.items).toHaveLength(1);
    expect(collectArrUpcoming).toHaveBeenCalledWith(state.instances[1], start, start + 5 * 86400000);
    widget().settings.kinds = ['album']; expect((await (await upcomingGet(get())).json()).items).toHaveLength(0);
  });
  it.each([
    ['days', 0], ['days', 61], ['days', '14'], ['days', 1.5], ['kinds', []], ['kinds', ['track']], ['kinds', ['movie', 'movie']],
    ['integrationIds', 'sonarr'], ['integrationIds', [null]], ['integrationIds', ['']], ['integrationIds', ['a', 'a']],
  ])('rejects invalid upcoming %s=%j', async (field, value) => {
    widget().settings = { [field]: value }; const response = await upcomingGet(get());
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: 'widgets.error.invalidSettings' }); expect(collectArrUpcoming).not.toHaveBeenCalled();
  });
  it('respects drafts for admins, ignores viewer drafts and bounds query input', async () => {
    widget().settings = { integrationIds: [state.instances[0].id] };
    const draft = encodeURIComponent(JSON.stringify({ integrationIds: [state.instances[1].id], days: 4 }));
    const admin = await (await upcomingGet(get(`widgetId=w&draft=${draft}`))).json();
    expect(admin.items[0].source).toBe('radarr'); expect(admin.items[0].poster).toContain('draft=');
    state.admin = false;
    const viewer = await (await upcomingGet(get(`widgetId=w&draft=${draft}`))).json();
    expect(viewer.items[0].source).toBe('sonarr'); expect(viewer.items[0].poster).not.toContain('draft=');
    expect((await upcomingGet(get('widgetId=w&draft={bad'))).status).toBe(400);
    expect((await upcomingGet(get(`widgetId=w&draft=${'x'.repeat(16385)}`))).status).toBe(400);
  });
  it('refuses missing, wrong, inaccessible widgets and wrong-type connections', async () => {
    state.authenticated = false; expect((await upcomingGet(get())).status).toBe(401); state.authenticated = true;
    expect((await upcomingGet(get('widgetId=absent'))).status).toBe(404);
    widget().type = 'media-queue'; expect((await upcomingGet(get())).status).toBe(404); widget().type = 'media-upcoming';
    widget().settings.integrationIds = [state.instances[2].id]; expect((await (await upcomingGet(get())).json()).failures).toMatchObject([{ id: state.instances[2].id, error: 'widgets.error.notFound' }]);
    widget().settings.integrationIds = ['absent']; expect((await (await upcomingGet(get())).json()).failures).toMatchObject([{ id: 'absent', error: 'widgets.error.notFound' }]);
    widget().settings = {}; state.admin = false; widget().hidden = true; expect((await upcomingGet(get())).status).toBe(404);
    widget().hidden = false; state.allowedTabs = ['docker']; expect((await upcomingGet(get())).status).toBe(404);
    expect(collectArrUpcoming).not.toHaveBeenCalled();
  });
  it('merges queue totals, caps items and preserves partial failures', async () => {
    widget().type = 'media-queue'; widget().settings.count = 3;
    const result = await (await queueGet(get())).json(); expect(result.total).toBe(16); expect(result.items).toHaveLength(2); expect(result.items[0].poster).toContain('/api/widgets/media/image?');
    widget().settings.count = '10'; expect((await queueGet(get())).status).toBe(400);
    widget().settings = {}; vi.mocked(collectArrQueue).mockRejectedValue(new ServiceError('widgets.error.timeout', 504));
    state.instances[0].secrets = { apiKey: 'changed' }; state.instances[1].secrets = { apiKey: 'changed' };
    const failed = await (await queueGet(get())).json(); expect(failed.failures).toHaveLength(2); expect(failed.total).toBe(0); expect(failed.items).toEqual([]);
  });
  it('returns every selected app, including offline sources with no error message', async () => {
    widget().type = 'media-arr';
    vi.mocked(collectArrStatus).mockImplementation(async instance => instance.type === 'radarr' ? { id: instance.id, name: instance.name, type: 'radarr', health: [], online: false } : demoArrStatus(instance));
    const response = await statusGet(get()), result = await response.json();
    expect(result.apps).toHaveLength(3); expect(result.apps[1]).toEqual({ id: state.instances[1].id, name: 'Fictional radarr', type: 'radarr', health: [], online: false });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('reads one Prowlarr, rejects wrong types and invalid selections', async () => {
    widget().type = 'media-indexers';
    const result = await (await indexersGet(get())).json(); expect(result.name).toBe('Fictional prowlarr'); expect(collectProwlarrIndexers).toHaveBeenCalledWith(state.instances[2]);
    widget().settings.integrationId = state.instances[0].id; expect((await indexersGet(get())).status).toBe(404);
    for (const id of [1, '']) { widget().settings.integrationId = id; expect((await indexersGet(get())).status).toBe(400); }
  });
  it('reads all clients, caps items, and keeps partial errors safe', async () => {
    widget().type = 'media-downloads'; widget().settings.items = 0;
    vi.mocked(collectDownloadClient).mockImplementation(async instance => { if (instance.type === 'sabnzbd') throw new ServiceError('integrations.error.authentication'); return demoDownloadClient(instance); });
    const result = await (await downloadsGet(get())).json(); expect(result.clients).toHaveLength(1); expect(result.clients[0].items).toEqual([]);
    expect(result.clients[0].active).toBe(3); expect(result.failures).toEqual([{ id: state.instances[4].id, name: 'Fictional sabnzbd', error: 'integrations.error.authentication' }]);
    expect(JSON.stringify(result)).not.toMatch(/example.com|fictional-key|fictional-password/);
    for (const items of [-1, 11, '5']) { widget().settings.items = items; expect((await downloadsGet(get())).status).toBe(400); }
  });
  it.each([
    ['media-upcoming', upcomingGet, collectArrUpcoming, 300000], ['media-queue', queueGet, collectArrQueue, 10000], ['media-arr', statusGet, collectArrStatus, 60000], ['media-indexers', indexersGet, collectProwlarrIndexers, 120000], ['media-downloads', downloadsGet, collectDownloadClient, 3000],
  ] as const)('uses the %s TTL and invalidates after credential changes', async (type, route, collector, ttl) => {
    widget().type = type;
    const relevant = type === 'media-indexers' ? state.instances[2] : type === 'media-downloads' ? state.instances[3] : state.instances[0];
    widget().settings = type === 'media-indexers' ? { integrationId: relevant.id } : { integrationIds: [relevant.id] };
    await route(get()); await route(get()); expect(collector).toHaveBeenCalledTimes(1);
    vi.setSystemTime(start + ttl - 1); await route(get()); expect(collector).toHaveBeenCalledTimes(1);
    vi.setSystemTime(start + ttl); await route(get()); expect(collector).toHaveBeenCalledTimes(2);
    relevant.secrets = { apiKey: 'changed-key', password: 'changed-password' }; await route(get()); expect(collector).toHaveBeenCalledTimes(3);
  });
});

describe('multi-source image membership', () => {
  it('uses the exact source credentials, and denies other widgets and removed sources', async () => {
    widget().settings = { integrationIds: [state.instances[0].id, state.instances[1].id] };
    const body = await (await upcomingGet(get())).json(); const first = body.items[0].poster, second = body.items[1].poster;
    expect(first).not.toBe(second); expect((await imageGet(image(first))).status).toBe(200);
    expect(serviceBytes).toHaveBeenLastCalledWith(state.instances[0], '/api/v3/mediacover/12/poster.jpg?lastWrite=123', { headers: { 'X-Api-Key': 'fictional-key' } }, 8 * 1024 * 1024);
    expect((await imageGet(image(second))).status).toBe(200); expect(vi.mocked(serviceBytes).mock.calls.at(-1)?.[0]).toBe(state.instances[1]);
    state.pages[0].widgets.push({ ...widget(), id: 'other' }); expect((await imageGet(image(first.replace('widgetId=w', 'widgetId=other')))).status).toBe(404);
    expect((await imageGet(image(first.replace('kind=poster', 'kind=backdrop')))).status).toBe(404);
    widget().settings.integrationIds = [state.instances[1].id]; expect((await imageGet(image(first))).status).toBe(404);
    state.instances[1].secrets = { apiKey: 'changed' }; expect((await imageGet(image(second))).status).toBe(404);
  });
  it('keeps identical artwork on two same-type instances separate', async () => {
    state.instances = [source('sonarr'), source('sonarr')];
    const result = await (await upcomingGet(get())).json(); expect(result.items[0].poster).not.toBe(result.items[1].poster);
    widget().settings.integrationIds = [state.instances[1].id]; expect((await imageGet(image(result.items[0].poster))).status).toBe(404);
    expect((await imageGet(image(result.items[1].poster))).status).toBe(200);
  });
  it('isolates draft image grants and rejects unrelated widget types and non-raster responses', async () => {
    widget().settings.integrationIds = [state.instances[0].id];
    const draft = encodeURIComponent(JSON.stringify({ integrationIds: [state.instances[1].id] }));
    const preview = await (await upcomingGet(get(`widgetId=w&draft=${draft}`))).json(), path = preview.items[0].poster;
    expect((await imageGet(image(path))).status).toBe(200);
    const savedPath = new URL(path, 'https://fixture'); savedPath.searchParams.delete('draft');
    expect((await imageGet(new NextRequest(savedPath))).status).toBe(404);
    state.admin = false; expect((await imageGet(image(path))).status).toBe(404); state.admin = true;
    widget().type = 'photos'; expect((await imageGet(new NextRequest(savedPath))).status).toBe(404);
    widget().type = 'media-upcoming'; const body = await (await upcomingGet(get())).json();
    vi.mocked(serviceBytes).mockResolvedValue({ bytes: Buffer.from('<svg/>'), status: 200, contentType: 'image/svg+xml' }); expect((await imageGet(image(body.items[0].poster))).status).toBe(502);
  });
});

describe('fictional demo and config privacy', () => {
  it.each([['media-upcoming', upcomingGet], ['media-queue', queueGet], ['media-arr', statusGet], ['media-indexers', indexersGet], ['media-downloads', downloadsGet]] as const)('never fetches for demo %s or its art', async (type, route) => {
    state.demo = true; widget().type = type;
    const response = await route(get()), result = await response.json(); expect(response.status).toBe(200);
    if (type === 'media-upcoming' || type === 'media-queue') { expect(result.items.length).toBeGreaterThan(0); expect((await imageGet(image(result.items[0].poster))).headers.get('content-type')).toBe('image/svg+xml'); }
    for (const collector of [collectArrUpcoming, collectArrQueue, collectArrRecent, collectArrStatus, collectProwlarrIndexers, collectDownloadClient, serviceBytes, serviceJson]) expect(collector).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/fictional-key|fictional-password|example.com/);
  });
  it('supports browser-local demo connections without outbound requests', async () => {
    state.demo = true; state.instances = []; widget().settings.integrationIds = ['sonarr-browser'];
    expect((await (await upcomingGet(get())).json()).items).toHaveLength(4); expect(collectArrUpcoming).not.toHaveBeenCalled();
  });
  it('strips all new service addresses, account settings and secrets for viewers', () => {
    const integrations = [...ARR_TYPES, ...DOWNLOAD_CLIENT_TYPES].map(source);
    const config = { settings: {}, integrations, categories: [] } as unknown as DashboardConfig;
    const principal = { role: 'viewer', allowedTabs: [], allowedWidgets: [] } as unknown as AccessPrincipal;
    const safe = buildConfigForPrincipal(config, principal);
    expect(safe.integrations?.every(instance => Object.keys(instance.settings).length === 0 && !instance.secrets)).toBe(true);
    expect(JSON.stringify(safe)).not.toMatch(/example.com|fictional-user|fictional-key|fictional-password/);
  });
});

describe('cleared settings', () => {
  it('reads null as absent (every source, default counts)', async () => {
    widget().type = 'media-downloads';
    widget().settings = { integrationIds: null, items: null, chart: null };
    vi.mocked(collectDownloadClient).mockImplementation(async instance => demoDownloadClient(instance));
  vi.mocked(collectExternal).mockResolvedValue({ external: [{ id: 'kitsu:77', provider: 'kitsu', kind: 'anime', title: 'The Cloud Observatory', status: 'airing', phase: 'current', poster: 'https://media.kitsu.app/art.jpg' }], failures: [] });
  vi.mocked(searchCatalog).mockResolvedValue([{ provider: 'tvmaze', id: '42', kind: 'series', title: 'The Cloud Observatory' }]);
    const response = await downloadsGet(get());
    expect(response.status).toBe(200);
    expect((await response.json()).clients.length).toBeGreaterThan(0);
  });
});

describe('upcoming library mode and idle data', () => {
  it.each([['source', 'other'], ['source', false], ['mediaId', ''], ['mediaId', 5], ['ended', 'true'], ['ended', 1]])('validates %s before any source read', async (field, value) => {
    widget().settings = { source: 'library', [field]: value };
    expect((await upcomingGet(get())).status).toBe(400); expect(collectLibraryUpcoming).not.toHaveBeenCalled(); expect(collectArrUpcoming).not.toHaveBeenCalled();
  });
  it('defaults to the first media server, filters ended after the shared cache and caps results', async () => {
    const server = source('jellyfin'); state.instances.push(server); widget().settings = { source: 'library', ended: null, mediaId: null };
    vi.mocked(collectLibraryUpcoming).mockResolvedValue([...demoMediaUpcoming(), ...Array.from({ length: 50 }, (_, n) => ({ id: `show-${n}`, title: `Show ${n}`, status: 'announced' as const }))]);
    const body = await (await upcomingGet(get())).json(); expect(body.items).toEqual([]); expect(body.followUps).toHaveLength(40); expect(body.followUps.some((item: { status: string }) => item.status === 'ended')).toBe(false);
    widget().settings.ended = true; await upcomingGet(get()); expect(collectLibraryUpcoming).toHaveBeenCalledTimes(1);
    expect(collectLibraryUpcoming).toHaveBeenCalledWith(server);
    vi.setSystemTime(start + 1800000); await upcomingGet(get()); expect(collectLibraryUpcoming).toHaveBeenCalledTimes(2);
    server.secrets = { apiKey: 'changed' }; await upcomingGet(get()); expect(collectLibraryUpcoming).toHaveBeenCalledTimes(3);
  });
  it('requires a saved media source, distinguishes missing servers and isolates failures', async () => {
    widget().settings = { source: 'library' }; expect((await (await upcomingGet(get())).json()).failures).toMatchObject([{ id: 'library', error: 'widgets.error.notFound' }]);
    const server = source('plex'); state.instances.push(server); widget().settings.mediaId = state.instances[0].id; expect((await (await upcomingGet(get())).json()).failures).toMatchObject([{ id: state.instances[0].id, error: 'widgets.error.notFound' }]);
    widget().settings.mediaId = server.id; vi.mocked(collectLibraryUpcoming).mockRejectedValue(new Error('https://private.example.com?token=secret'));
    const result = await (await upcomingGet(get())).json(); expect(result.failures).toEqual([{ id: server.id, name: server.name, error: 'widgets.error.network' }]); expect(result.followUps).toEqual([]);
  });
  it('proxies library art for the selected server with exact widget/draft membership and removes viewer links', async () => {
    const first = source('emby'), second = source('plex'); state.instances.push(first, second); widget().settings = { source: 'library', mediaId: first.id };
    vi.mocked(collectLibraryUpcoming).mockResolvedValue([{ id: 'local-series', title: 'Private library title', status: 'announced', poster: '/emby/Items/local-series/Images/Primary', link: 'https://media.example.com/web' }]);
    const body = await (await upcomingGet(get())).json(), path = body.followUps[0].poster;
    expect((await imageGet(image(path))).status).toBe(200); expect(vi.mocked(serviceBytes).mock.calls.at(-1)?.[0]).toBe(first);
    state.pages[0].widgets.push({ ...widget(), id: 'other' }); expect((await imageGet(image(path.replace('widgetId=w', 'widgetId=other')))).status).toBe(404);
    widget().settings.mediaId = second.id; expect((await imageGet(image(path))).status).toBe(404);
    const draft = encodeURIComponent(JSON.stringify({ source: 'library', mediaId: first.id }));
    const preview = await (await upcomingGet(get(`widgetId=w&draft=${draft}`))).json(); expect((await imageGet(image(preview.followUps[0].poster))).status).toBe(200);
    const stripped = new URL(preview.followUps[0].poster, 'https://fixture'); stripped.searchParams.delete('draft'); expect((await imageGet(new NextRequest(stripped))).status).toBe(404);
    state.admin = false; const viewer = await (await upcomingGet(get())).json(); expect(viewer.followUps[0].link).toBeUndefined(); expect(JSON.stringify(viewer)).not.toMatch(/fictional-key|example.com|\/emby\/Items/);
  });
  it('reads later only for an empty filtered window, caches it, sorts and bounds to three', async () => {
    state.instances = [state.instances[0]]; const server = state.instances[0];
    vi.mocked(collectArrUpcoming).mockImplementation(async (instance, from) => from === start ? [] : Array.from({ length: 6 }, (_, n) => ({ id: `later-${n}`, source: 'sonarr' as const, sourceName: instance.name, kind: 'episode' as const, hasFile: false, title: `Episode ${n}`, at: from + (6 - n) * 86400000, poster: '/api/v3/mediacover/12/poster.jpg' })));
    const result = await (await upcomingGet(get())).json(); expect(result.items).toEqual([]); expect(result.later).toHaveLength(3); expect(result.later[0].id).toBe('later-5'); expect(result.later[0].poster).toContain('/api/widgets/media/image?');
    expect(collectArrUpcoming).toHaveBeenLastCalledWith(server, start + 14 * 86400000, start + 134 * 86400000);
    await upcomingGet(get()); expect(collectArrUpcoming).toHaveBeenCalledTimes(2);
    server.secrets = { apiKey: 'changed' }; vi.mocked(collectArrUpcoming).mockResolvedValue(toArrUpcoming(server, sonarr.calendar, start, start + 14 * 86400000));
    expect((await (await upcomingGet(get())).json()).later).toBeUndefined(); expect(collectArrUpcoming).toHaveBeenCalledTimes(3);
  });
  it('reads recent imports only for an empty queue, caches for 60 seconds and merges newest six', async () => {
    widget().type = 'media-queue'; vi.mocked(collectArrQueue).mockResolvedValue({ items: [], total: 0 });
    const result = await (await queueGet(get())).json(); expect(result.recent).toHaveLength(6); expect(result.recent[0].poster).toContain('/api/widgets/media/image?');
    expect(collectArrRecent).toHaveBeenCalledTimes(2); await queueGet(get()); expect(collectArrRecent).toHaveBeenCalledTimes(2);
    vi.setSystemTime(start + 60000); await queueGet(get()); expect(collectArrRecent).toHaveBeenCalledTimes(4);
    state.instances[0].secrets = { apiKey: 'changed' }; state.instances[1].secrets = { apiKey: 'changed' }; vi.mocked(collectArrQueue).mockImplementation(async instance => toArrQueue(instance, sonarr.queue));
    expect((await (await queueGet(get())).json()).recent).toBeUndefined(); expect(collectArrRecent).toHaveBeenCalledTimes(4);
  });
  it('has fictional values for every new demo field and never fetches library metadata or TVMaze', async () => {
    state.demo = true; const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    try {
      state.instances.push(source('jellyfin')); widget().settings = { source: 'library', ended: true };
      const result = await (await upcomingGet(get())).json(); expect(result.followUps).toHaveLength(5); expect(new Set(result.followUps.map((item: { status: string }) => item.status)).size).toBe(4);
      expect((await imageGet(image(result.followUps[0].poster))).status).toBe(200);
      expect(demoArrRecent(state.instances[0])).toHaveLength(3); expect(demoIndexers(state.instances[2]).hourly).toHaveLength(24);
      expect(demoDownloadClient(state.instances[3])).toMatchObject({ sessionDownloaded: 48600000000, sessionUploaded: 12400000000, seeding: 1 }); expect(demoDownloadClient(state.instances[3]).completed?.length).toBeGreaterThan(0);
      expect(fetcher).not.toHaveBeenCalled(); expect(collectLibraryUpcoming).not.toHaveBeenCalled(); expect(serviceJson).not.toHaveBeenCalled(); expect(serviceBytes).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it('returns fictional later releases for an empty one-day album window without fetching', async () => {
    state.demo = true; state.instances = [source('lidarr')]; widget().settings = { days: 1, kinds: ['album'] };
    const result = await (await upcomingGet(get())).json(); expect(result.items).toEqual([]); expect(result.later).toHaveLength(3);
    expect(result.later[0].poster).toContain('/api/widgets/media/image?'); expect(collectArrUpcoming).not.toHaveBeenCalled();
  });
});


describe('combined upcoming catalogues', () => {
  it('reads all requested sources and preserves successful results when one fails', async () => {
    const server = source('plex'); state.instances.push(server);
    widget().settings = { sources: ['external', 'library', 'arr'], mediaId: server.id, watchlist: [{ provider: 'kitsu', id: '77', kind: 'anime', title: 'Followed title' }] };
    vi.mocked(collectLibraryUpcoming).mockRejectedValue(new Error('private-url-and-token'));
    const response = await upcomingGet(get()), body = await response.json();
    expect(response.status).toBe(200); expect(body.items).toHaveLength(2); expect(body.followUps).toEqual([]); expect(body.external).toHaveLength(1);
    expect(body.external[0].poster).toBe('https://media.kitsu.app/art.jpg'); expect(body.failures).toEqual([{ id: server.id, name: server.name, error: 'widgets.error.network' }]);
    expect(body.items.every((item: { phase?: string }) => ['current', 'announced'].includes(item.phase!))).toBe(true);
    expect(collectExternal).toHaveBeenCalledWith({ mode: 'watchlist', watchlist: widget().settings.watchlist, kinds: ['series', 'anime', 'movie'] }, false);
  });
  it('omits unrequested collections and preserves a surviving arr connection after another was removed', async () => {
    widget().settings = { sources: ['arr'], integrationIds: ['removed', state.instances[0].id] };
    const body = await (await upcomingGet(get())).json(); expect(body.items).toHaveLength(1); expect(body.failures).toMatchObject([{ id: 'removed' }]);
    expect(body).not.toHaveProperty('followUps'); expect(body).not.toHaveProperty('external'); expect(collectExternal).not.toHaveBeenCalled();
    widget().settings = { sources: ['external'] }; const external = await (await upcomingGet(get())).json();
    expect(external.items).toEqual([]); expect(external).not.toHaveProperty('later'); expect(external).not.toHaveProperty('followUps'); expect(collectLibraryUpcoming).not.toHaveBeenCalled();
  });
  it('authorizes images from both arr and library in saved and draft combined settings', async () => {
    const server = source('jellyfin'); state.instances.push(server); widget().settings = { sources: ['arr', 'library'], mediaId: server.id };
    const body = await (await upcomingGet(get())).json();
    expect((await imageGet(image(body.items[0].poster))).status).toBe(200); expect((await imageGet(image(body.followUps[0].poster))).status).toBe(200);
    expect(vi.mocked(serviceBytes).mock.calls.at(-1)?.[0]).toBe(server);
    widget().settings.sources = ['arr']; expect((await imageGet(image(body.followUps[0].poster))).status).toBe(404);
    const draft = encodeURIComponent(JSON.stringify({ sources: ['external', 'library', 'arr'], mediaId: server.id }));
    const preview = await (await upcomingGet(get(`widgetId=w&draft=${draft}`))).json();
    expect((await imageGet(image(preview.followUps[0].poster))).status).toBe(200); expect((await imageGet(image(preview.items[0].poster))).status).toBe(200);
  });
  it.each<WidgetSettings>([
    { sources: [] }, { sources: ['arr', 'arr'] }, { sources: ['other'] }, { externalMode: 'other' }, { catalogKinds: [] },
    { watchlist: [{ provider: 'tvmaze', kind: 'series', id: '1&token=secret', title: 'Title' }] }, { watchlist: false }, { integrationIds: ['a', 'a'] },
  ])('rejects all invalid settings before fetching %j', async settings => {
    widget().settings = { sources: ['external', 'arr', 'library'], ...settings };
    expect((await upcomingGet(get())).status).toBe(400);
    expect(collectArrUpcoming).not.toHaveBeenCalled(); expect(collectLibraryUpcoming).not.toHaveBeenCalled(); expect(collectExternal).not.toHaveBeenCalled();
  });
  it('treats null catalogue settings as absent and provides offline fictional demo items', async () => {
    state.demo = true; widget().settings = { sources: ['external'], externalMode: null, watchlist: null, catalogKinds: null };
    const body = await (await upcomingGet(get())).json(); expect(body.external.length).toBeGreaterThan(2);
    expect(body.external.every((item: { phase: string; poster: string }) => !!item.phase && item.poster.startsWith('data:image/svg+xml,'))).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/https?:|Private fallback/); expect(collectExternal).not.toHaveBeenCalled();
    widget().settings.ended = true; expect((await (await upcomingGet(get())).json()).external.some((item: { status: string }) => item.status === 'ended')).toBe(true);
  });
});

describe('admin catalogue search route', () => {
  const search = (params = 'q=cloud&kinds=series,anime,movie') => new NextRequest(`https://nasdash.example.com/api/widgets/arr/catalog?${params}`);
  it('denies viewers and unauthenticated callers even in public mode', async () => {
    state.admin = false; expect((await catalogGet(search())).status).toBe(403);
    state.authenticated = false; expect((await catalogGet(search())).status).toBe(403); expect(searchCatalog).not.toHaveBeenCalled();
  });
  it.each(['q=a', 'q=', `q=${'a'.repeat(81)}`, 'q=cloud&kinds=', 'q=cloud&kinds=anime,anime', 'q=cloud&kinds=other'])('validates query %s', async query => {
    expect((await catalogGet(search(query))).status).toBe(400); expect(searchCatalog).not.toHaveBeenCalled();
  });
  it('returns a bare hits array, private no-store, and enforces optional widget permissions', async () => {
    const response = await catalogGet(search('q=cloud&kinds=series&widgetId=w')); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toMatchObject([{ provider: 'tvmaze' }]); expect(searchCatalog).toHaveBeenCalledWith('cloud', ['series']);
    expect((await catalogGet(search('q=cloud&widgetId=absent'))).status).toBe(404); expect((await catalogGet(search('q=cloud&widgetId=!'))).status).toBe(400);
  });
  it('returns fictional demo hits without contacting any catalogue', async () => {
    state.demo = true; const response = await catalogGet(search('q=cloud&kinds=movie'));
    expect(await response.json()).toMatchObject([{ title: 'The Clockwork Aurora', kind: 'movie' }]); expect(searchCatalog).not.toHaveBeenCalled(); expect(collectExternal).not.toHaveBeenCalled();
  });
});
