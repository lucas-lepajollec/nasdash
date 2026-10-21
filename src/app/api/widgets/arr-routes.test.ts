import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { DashboardConfig, IntegrationInstance } from '@/lib/types';
import type { Page, PagesDocument } from '@/lib/pages/types';
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
vi.mock('@/integrations/arr/collect', async original => ({ ...await original<typeof import('@/integrations/arr/collect')>(), collectArrUpcoming: vi.fn(), collectArrQueue: vi.fn(), collectArrStatus: vi.fn(), collectProwlarrIndexers: vi.fn() }));
vi.mock('@/integrations/downloads/collect', () => ({ collectDownloadClient: vi.fn() }));
import { GET as upcomingGet } from './arr/upcoming/route';
import { GET as queueGet } from './arr/queue/route';
import { GET as statusGet } from './arr/status/route';
import { GET as indexersGet } from './arr/indexers/route';
import { GET as downloadsGet } from './downloads/route';
import { GET as imageGet } from './media/image/route';
import { collectArrUpcoming, collectArrQueue, collectArrStatus, collectProwlarrIndexers, toArrUpcoming, toArrQueue } from '@/integrations/arr/collect';
import { collectDownloadClient } from '@/integrations/downloads/collect';
import { demoArrStatus, demoDownloadClient, demoIndexers } from '@/lib/widgetData/arrDemo';
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
  vi.mocked(collectArrStatus).mockImplementation(async instance => demoArrStatus(instance));
  vi.mocked(collectProwlarrIndexers).mockImplementation(async instance => demoIndexers(instance));
  vi.mocked(collectDownloadClient).mockImplementation(async instance => demoDownloadClient(instance));
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
    widget().settings.integrationIds = [state.instances[2].id]; expect((await upcomingGet(get())).status).toBe(404);
    widget().settings.integrationIds = ['absent']; expect((await upcomingGet(get())).status).toBe(404);
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
    for (const collector of [collectArrUpcoming, collectArrQueue, collectArrStatus, collectProwlarrIndexers, collectDownloadClient, serviceBytes, serviceJson]) expect(collector).not.toHaveBeenCalled();
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
    const response = await downloadsGet(get());
    expect(response.status).toBe(200);
    expect((await response.json()).clients.length).toBeGreaterThan(0);
  });
});
