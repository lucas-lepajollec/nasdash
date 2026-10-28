import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { IntegrationInstance } from '@/lib/types';
const state = vi.hoisted(() => ({ hosts: [] as unknown[], demo: false, admin: true, settings: { integrationId: 'gluetun-one' } as Record<string, unknown>, instances: [] as IntegrationInstance[], visible: true }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: state.instances, dockerHosts: state.hosts }) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
vi.mock('@/lib/auth', () => ({ checkAdmin: () => state.admin ? null : NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 401 }), isAdmin: () => state.admin }));
vi.mock('@/lib/widgetData/resolve', () => ({ resolveWidgetSettings: vi.fn((_req, _id, _type, draft) => state.visible ? { ok: true, settings: state.admin && draft ? draft : state.settings, principal: { role: state.admin ? 'admin' : 'viewer' } } : { ok: false, status: 404, error: 'widgets.error.notFound' }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn(), serviceBytes: vi.fn() }));
vi.mock('@/integrations/gluetun/collect', () => ({ collectGluetun: vi.fn(), restartGluetun: vi.fn() }));
vi.mock('@/integrations/gluetun/dependents', async original => ({ ...await original<typeof import('@/integrations/gluetun/dependents')>(), tunnelContainers: vi.fn() }));
import { GET, POST } from './vpn/route';
import { collectGluetun, restartGluetun } from '@/integrations/gluetun/collect';
import { tunnelContainers } from '@/integrations/gluetun/dependents';
import { serviceBytes, serviceJson, ServiceError } from '@/lib/widgetData/services';

const instance = (id: string, type: string): IntegrationInstance => ({ id, type, name: `Fictional ${id}`, settings: { url: 'http://fixture.example.com:8000' }, secrets: { apiKey: 'fake-key' } });
const get = (widgetId = 'w') => new NextRequest(`http://nasdash.example.com/api/widgets/vpn?widgetId=${widgetId}`);
const post = (body: unknown) => new NextRequest('http://nasdash.example.com/api/widgets/vpn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const summary = (status: 'running' | 'stopped' = 'running') => ({ provider: 'gluetun' as const, name: 'Fictional gluetun-one', status, fetchedAt: 1 });
let widget = 0;
beforeEach(() => {
  vi.resetAllMocks();
  state.demo = false; state.admin = true; state.visible = true; state.hosts = [];
  state.instances = [instance('gluetun-one', 'gluetun'), instance('gluetun-two', 'gluetun'), instance('dns-one', 'pihole')];
  // Each test reads a fresh connection identity, out of the route's cache.
  state.instances[0].settings.url = `http://fixture-${++widget}.example.com:8000`;
  state.settings = { integrationId: 'gluetun-one' };
});

describe('VPN tunnel route', () => {
  it('reads the chosen Gluetun connection and tells viewers they cannot restart it', async () => {
    vi.mocked(collectGluetun).mockResolvedValue(summary());
    const admin = await (await GET(get())).json();
    expect(admin).toMatchObject({ status: 'running', canControl: true });
    expect(collectGluetun).toHaveBeenCalledWith(state.instances[0]);
    state.admin = false;
    expect(await (await GET(get())).json()).toMatchObject({ canControl: false });
  });
  it('refuses another type of connection, an unknown one and a hidden widget', async () => {
    state.settings = { integrationId: 'dns-one' };
    expect((await GET(get())).status).toBe(404);
    state.settings = { integrationId: 'unknown' };
    expect((await POST(post({ widgetId: 'w', action: 'restart' }))).status).toBe(404);
    state.visible = false;
    expect((await GET(get())).status).toBe(404);
    expect(collectGluetun).not.toHaveBeenCalled(); expect(restartGluetun).not.toHaveBeenCalled();
  });
  it('restarts for administrators only, then answers a fresh summary', async () => {
    state.admin = false;
    expect((await POST(post({ widgetId: 'w', action: 'restart' }))).status).toBe(403);
    expect(restartGluetun).not.toHaveBeenCalled();
    state.admin = true;
    expect((await POST(post({ widgetId: 'w', action: 'stop' }))).status).toBe(400);
    vi.mocked(collectGluetun).mockResolvedValueOnce(summary('running'));
    expect((await GET(get())).status).toBe(200);
    vi.mocked(collectGluetun).mockResolvedValueOnce(summary('stopped'));
    const response = await POST(post({ widgetId: 'w', action: 'restart' }));
    expect(restartGluetun).toHaveBeenCalledWith(state.instances[0]);
    expect(await response.json()).toMatchObject({ status: 'stopped', canControl: true });
    expect(collectGluetun).toHaveBeenCalledTimes(2);
  });
  it('adds the containers behind the tunnel for administrators, and never fails the widget over Docker', async () => {
    vi.mocked(collectGluetun).mockResolvedValue(summary());
    state.hosts = [{ id: 'h', name: 'NAS', icon: '', type: 'socket', url: '', socketPath: '/var/run/docker.sock' }];
    vi.mocked(tunnelContainers).mockResolvedValue([
      { Id: 'g1', Names: ['/gluetun'], Image: 'qmcgaw/gluetun', State: 'running' },
      { Id: 'q1', Names: ['/qbittorrent'], State: 'running', HostConfig: { NetworkMode: 'container:g1' } },
    ]);
    expect(await (await GET(get())).json()).toMatchObject({ status: 'running', services: [{ name: 'qbittorrent', running: true }], detached: [] });
    state.instances[0].settings.url = `http://fixture-${++widget}.example.com:8000`;
    vi.mocked(tunnelContainers).mockRejectedValue(new Error('docker down'));
    const failed = await (await GET(get())).json();
    expect(failed.status).toBe('running'); expect(failed).not.toHaveProperty('services');
  });
  it('returns provider errors with a private cache header', async () => {
    vi.mocked(collectGluetun).mockRejectedValue(new ServiceError('integrations.error.authentication', 502, { status: 401 }));
    const response = await GET(get());
    expect(response.status).toBe(502); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect((await response.json()).error).toBe('integrations.error.authentication');
  });
  it('answers fictional data in the demo, restart included, without contacting anything', async () => {
    state.demo = true;
    const read = await (await GET(get())).json();
    expect(read).toMatchObject({ provider: 'gluetun', status: 'running', publicIp: '198.51.100.24', canControl: true });
    const restarted = await (await POST(post({ widgetId: 'w', action: 'restart' }))).json();
    expect(restarted.status).toBe('starting'); expect(restarted).not.toHaveProperty('publicIp');
    expect(collectGluetun).not.toHaveBeenCalled(); expect(restartGluetun).not.toHaveBeenCalled();
    expect(serviceJson).not.toHaveBeenCalled(); expect(serviceBytes).not.toHaveBeenCalled();
  });
});
