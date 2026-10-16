import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { DashboardConfig, IntegrationInstance } from '@/lib/types';
import type { AccessPrincipal } from '@/lib/access';
import type { Page } from '@/lib/pages/types';
const state = vi.hoisted(() => ({ demo: false, admin: true, authenticated: true, instances: [] as IntegrationInstance[], pages: [] as Page[] }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ settings: { securityMode: 'public' }, integrations: state.instances }) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
vi.mock('@/lib/auth', () => ({ isAdmin: () => state.admin }));
vi.mock('@/lib/access', async original => ({ ...await original<typeof import('@/lib/access')>(), resolveAccessPrincipal: () => state.authenticated ? { username: 'reader', role: state.admin ? 'admin' : 'viewer', allowedTabs: [], allowedWidgets: [], isAnonymous: !state.admin } : null }));
vi.mock('@/lib/pages/store', () => ({ readPagesDocument: () => state.pages, pagesForViewer: (pages: Page[]) => pages }));
vi.mock('@/lib/widgetData/customApi', async original => ({ ...await original<typeof import('@/lib/widgetData/customApi')>(), customApiRequest: vi.fn() }));
import { GET } from './customapi/route';
import { GET as sampleGet } from './customapi/sample/route';
import { customApiRequest } from '@/lib/widgetData/customApi';
import { customApiDemo } from '@/lib/widgetData/customApiDemo';
import { buildConfigForPrincipal } from '@/lib/configAccess';
import { ServiceError } from '@/lib/widgetData/services';
const get = (query = 'widgetId=w') => new NextRequest(`https://nasdash.example.com/api/widgets/customapi?${query}`);
const sample = (id: string) => new NextRequest(`https://nasdash.example.com/api/widgets/customapi/sample?integrationId=${id}`);
const saved = () => state.pages[0].widgets[0].settings;
const viewer: AccessPrincipal = { username: 'reader', role: 'viewer', allowedTabs: [], allowedWidgets: [], isAnonymous: true };
let sequence = 0;
beforeEach(() => {
  vi.resetAllMocks();
  state.demo = false; state.admin = true; state.authenticated = true;
  const id = `customapi-test-${++sequence}`;
  state.instances = [{ id, type: 'customapi', name: 'Lab status API', settings: { url: 'https://status.example.com/api?key=fictional-url-secret', authType: 'bearer' }, secrets: { authValue: 'fictional-secret' } }, { id: 'photos-one', type: 'immich', name: 'Photos', settings: { url: 'https://photos.example.com' } }];
  state.pages = [{ id: 'dashboard', name: 'Dashboard', icon: '', revision: 1, widgets: [{ id: 'w', type: 'customapi', x: 0, y: 0, w: 12, h: 10, settings: { integrationId: id, display: 'figures', fields: [{ id: 'download', label: 'Download', path: 'download' }], refresh: 15 } }] }];
  vi.mocked(customApiRequest).mockResolvedValue({ download: 912.4, upload: 48.2, private: { token: 'unselected-secret' } });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('custom API widget routes', () => {
  it('returns only configured values with a private, no-store response', async () => {
    state.admin = false;
    const response = await GET(get());
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ name: 'Lab status API', values: [912.4], fetchedAt: expect.any(Number) });
    expect(customApiRequest).toHaveBeenCalledWith(state.instances[0]);
  });
  it('rejects unauthenticated, absent and wrong-type widgets, and wrong-type connections', async () => {
    state.authenticated = false;
    expect((await GET(get())).status).toBe(401);
    state.authenticated = true;
    expect((await GET(get('widgetId=absent'))).status).toBe(404);
    state.pages[0].widgets[0].type = 'photos';
    expect((await GET(get())).status).toBe(404);
    state.pages[0].widgets[0].type = 'customapi'; saved().integrationId = 'photos-one';
    expect((await GET(get())).status).toBe(404);
    saved().integrationId = 'missing';
    expect((await GET(get())).status).toBe(404);
    expect(customApiRequest).not.toHaveBeenCalled();
  });
  it('uses admin drafts but ignores visitor drafts and arbitrary query URLs', async () => {
    const draft = encodeURIComponent(JSON.stringify({ ...saved(), fields: [{ id: 'upload', label: 'Upload', path: 'upload' }] }));
    expect((await (await GET(get(`widgetId=w&draft=${draft}`))).json()).values).toEqual([48.2]);
    state.admin = false;
    expect((await (await GET(get(`widgetId=w&draft=${draft}&url=https://other.example.com`))).json()).values).toEqual([912.4]);
    expect(customApiRequest).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid drafts and settings before sending a request', async () => {
    expect((await GET(get('widgetId=w&draft=%7Bbroken'))).status).toBe(400);
    expect((await GET(get(`widgetId=w&draft=${'x'.repeat(16385)}`))).status).toBe(400);
    saved().fields = [{ id: 'x', label: 'X', path: 'constructor' }];
    expect((await GET(get())).status).toBe(400);
    expect(customApiRequest).not.toHaveBeenCalled();
  });
  it('caches JSON per connection while extracting separately for each widget', async () => {
    await GET(get());
    saved().fields = [{ id: 'upload', label: 'Upload', path: 'upload' }];
    expect((await (await GET(get())).json()).values).toEqual([48.2]);
    expect(customApiRequest).toHaveBeenCalledTimes(1);
    state.instances[0].secrets!.authValue = 'new-fictional-secret';
    await GET(get());
    expect(customApiRequest).toHaveBeenCalledTimes(2);
  });
  it.each([15, 30, 60, 300, 900])('expires the JSON cache after min(%s, 60) seconds', async refresh => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
    saved().refresh = refresh;
    const first = await (await GET(get())).json();
    vi.advanceTimersByTime(Math.min(refresh, 60) * 1000 - 1);
    expect((await (await GET(get())).json()).fetchedAt).toBe(first.fetchedAt);
    expect(customApiRequest).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    await GET(get());
    expect(customApiRequest).toHaveBeenCalledTimes(2);
  });
  it('uses a shorter refresh for a second widget sharing a connection', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
    saved().refresh = 300;
    await GET(get());
    vi.advanceTimersByTime(15000); saved().refresh = 15;
    await GET(get());
    expect(customApiRequest).toHaveBeenCalledTimes(2);
  });
  it('reports sanitized errors without exposing the address or credentials', async () => {
    vi.mocked(customApiRequest).mockRejectedValue(new ServiceError('widgets.error.timeout', 504));
    const response = await GET(get());
    expect(response.status).toBe(504); expect(await response.json()).toEqual({ error: 'widgets.error.timeout' });
    vi.mocked(customApiRequest).mockRejectedValue(new Error(`${state.instances[0].settings.url}&token=fictional-secret`));
    expect(await (await GET(get())).json()).toEqual({ error: 'widgets.error.network' });
  });
});

describe('custom API samples and configuration privacy', () => {
  it('requires an administrator before resolving the connection or fetching', async () => {
    state.admin = false;
    expect((await sampleGet(sample(state.instances[0].id))).status).toBe(401);
    expect(customApiRequest).not.toHaveBeenCalled();
  });
  it('returns 404 for a missing or wrong-type connection', async () => {
    expect((await sampleGet(sample('photos-one'))).status).toBe(404);
    expect((await sampleGet(sample('missing'))).status).toBe(404);
    expect(customApiRequest).not.toHaveBeenCalled();
  });
  it('returns a bounded sample to administrators', async () => {
    vi.mocked(customApiRequest).mockResolvedValue({ text: 'x'.repeat(201) });
    const response = await sampleGet(sample(state.instances[0].id));
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ sample: { text: 'x'.repeat(200) }, truncated: true, fetchedAt: expect.any(Number) });
  });
  it('keeps all connection settings and secrets out of visitor bootstrap data', () => {
    const config = { version: 1, categories: [], settings: { title: 'Lab', showMonitor: true }, integrations: state.instances } as DashboardConfig;
    const output = buildConfigForPrincipal(config, viewer);
    expect(output.integrations?.[0]).toEqual({ id: state.instances[0].id, type: 'customapi', name: 'Lab status API', settings: {} });
    expect(JSON.stringify(output)).not.toMatch(/status\.example\.com|fictional-url-secret|fictional-secret|bearer/);
    const admin = buildConfigForPrincipal(config, { ...viewer, role: 'admin' });
    expect(admin.integrations?.[0].settings.url).toBe(state.instances[0].settings.url);
    expect(admin.integrations?.[0].secrets?.authValue).toBe('********');
  });
  it('uses only the fictional fixture in demo widget and sample routes', async () => {
    state.demo = true; state.admin = false;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Demo fetched'));
    expect((await (await GET(get())).json()).values).toEqual([customApiDemo.download]);
    saved().display = 'table'; saved().listPath = 'disks'; saved().limit = 2;
    saved().fields = [{ id: 'name', label: 'Name', path: 'name' }];
    expect((await (await GET(get())).json()).rows).toEqual([['nvme0'], ['nvme1']]);
    expect((await (await sampleGet(sample(state.instances[0].id))).json()).sample).toEqual(customApiDemo);
    saved().integrationId = 'customapi-visitor';
    expect((await GET(get())).status).toBe(200);
    expect(customApiRequest).not.toHaveBeenCalled(); expect(fetchSpy).not.toHaveBeenCalled();
  });
});
