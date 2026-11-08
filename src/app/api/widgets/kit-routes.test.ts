import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { IntegrationInstance } from '@/lib/types';
const state = vi.hoisted(() => ({ demo: false, admin: true, settings: { integrationId: 'speed-one' } as Record<string, unknown>, instances: [] as IntegrationInstance[], visible: true, types: [] as unknown[] }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: state.instances }) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
vi.mock('@/lib/auth', () => ({ checkAdmin: () => state.admin ? null : NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 401 }) }));
vi.mock('@/lib/widgetData/resolve', () => ({ resolveWidgetSettings: vi.fn((_req, _id, type, draft) => { state.types.push(type); return state.visible ? { ok: true, settings: state.admin && draft ? draft : state.settings, principal: { role: state.admin ? 'admin' : 'viewer' } } : { ok: false, status: 404, error: 'widgets.error.notFound' }; }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn(), serviceBytes: vi.fn() }));
import { GET, POST } from './kit/route';
import { serviceJson } from '@/lib/widgetData/services';
import results from '@/integrations/speedtest/samples/results.json';

const json = vi.mocked(serviceJson);
const instance = (id: string, type: string): IntegrationInstance => ({ id, type, name: `Fictional ${id}`, settings: { url: 'http://fixture.example.com:8080' }, secrets: { token: 'fake-token' } });
const get = (widget = 'speedtest', widgetId = 'w') => new NextRequest(`http://nasdash.example.com/api/widgets/kit?widget=${widget}&widgetId=${widgetId}`);
const post = (body: unknown) => new NextRequest('http://nasdash.example.com/api/widgets/kit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
let fresh = 0;
beforeEach(() => {
  vi.resetAllMocks();
  state.demo = false; state.admin = true; state.visible = true; state.types = [];
  state.instances = [instance('speed-one', 'speedtest'), instance('wud-one', 'wud'), instance('dns-one', 'pihole')];
  // Each test reads a fresh connection identity, out of the route's cache.
  state.instances[0].settings.url = `http://fixture-${++fresh}.example.com:8080`;
  state.settings = { integrationId: 'speed-one' };
});

describe('integration kit route', () => {
  it('reads the widget’s own connection, looked up as that widget type', async () => {
    json.mockResolvedValue(results);
    const answer = await (await GET(get())).json();
    expect(answer).toMatchObject({ provider: 'speedtest', name: 'Fictional speed-one', canControl: true });
    expect(answer.latest).toMatchObject({ downloadBps: 880_000_000, uploadBps: 410_000_000, pingMs: 8.2 });
    expect(state.types).toEqual(['speedtest']);
    expect(json.mock.calls[0][1]).toBe('/api/v1/results?sort=-created_at');
    state.admin = false;
    expect(await (await GET(get())).json()).toMatchObject({ canControl: false });
  });
  it('shares one reading per connection while it is fresh', async () => {
    json.mockResolvedValue(results);
    await GET(get()); await GET(get('speedtest', 'other'));
    expect(json).toHaveBeenCalledTimes(1);
  });
  it('refuses an unknown widget, another family’s connection and a hidden widget', async () => {
    expect((await GET(get('dns'))).status).toBe(400);
    state.settings = { integrationId: 'wud-one' };
    expect((await GET(get())).status).toBe(404);
    state.settings = { integrationId: 'dns-one' };
    expect((await GET(get())).status).toBe(404);
    state.settings = { integrationId: 'speed-one' }; state.visible = false;
    expect((await GET(get())).status).toBe(404);
    expect(json).not.toHaveBeenCalled();
  });
  it('runs an action for administrators only, then reads again', async () => {
    state.admin = false;
    expect((await POST(post({ widget: 'speedtest', widgetId: 'w', action: 'run' }))).status).toBe(403);
    state.admin = true;
    expect((await POST(post({ widget: 'speedtest', widgetId: 'w', action: 'delete' }))).status).toBe(400);
    expect((await POST(post({ widget: 'speedtest', widgetId: 'w', action: 'toString' }))).status).toBe(400);
    expect((await POST(post({ widget: 'speedtest', widgetId: 'w', action: 'run', target: '../../etc' }))).status).toBe(400);
    expect((await POST(post({ widget: 'speedtest', widgetId: 'w', action: 'run', target: 42 }))).status).toBe(400);
    state.settings = { integrationId: 'wud-one' };
    expect((await POST(post({ widget: 'container-updates', widgetId: 'w', action: 'run' }))).status).toBe(400);
    expect(json).not.toHaveBeenCalled();
    state.settings = { integrationId: 'speed-one' };
    json.mockResolvedValue(results);
    const response = await POST(post({ widget: 'speedtest', widgetId: 'w', action: 'run' }));
    expect(response.status).toBe(200);
    expect(json.mock.calls.map(([, path, options]) => [path, options?.method])).toEqual([['/api/v1/speedtests/run', 'POST'], ['/api/v1/results?sort=-created_at', undefined]]);
  });
  it('answers fictional data in the public demo, without any request', async () => {
    state.demo = true; state.admin = true;
    state.settings = { integrationId: 'syncthing-abc123' };
    const answer = await (await GET(get('syncthing'))).json();
    expect(answer).toMatchObject({ provider: 'syncthing', name: 'Syncthing' });
    expect(answer.folders.length).toBeGreaterThan(0);
    state.settings = { integrationId: 'speed-one' };
    expect(await (await POST(post({ widget: 'speedtest', widgetId: 'w', action: 'run' }))).json()).toMatchObject({ running: true });
    expect(json).not.toHaveBeenCalled();
  });
});
