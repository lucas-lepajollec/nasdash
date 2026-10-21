import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { IntegrationInstance } from '@/lib/types';
const state = vi.hoisted(() => ({ demo: false, admin: true, instances: [] as IntegrationInstance[] }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: state.instances }) }));
vi.mock('@/lib/auth', () => ({ checkAdmin: () => state.admin ? null : NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 401 }) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn(), serviceBytes: vi.fn() }));
vi.mock('@/integrations/pihole/collect', () => ({ piholeRequest: vi.fn() }));
vi.mock('@/lib/widgetData/customApi', () => ({ customApiRequest: vi.fn() }));
import { customApiRequest } from '@/lib/widgetData/customApi';
import { POST } from './route';
import { piholeRequest } from '@/integrations/pihole/collect';
import { serviceJson, serviceBytes, ServiceError } from '@/lib/widgetData/services';
const request = (body: unknown) => new NextRequest('http://nasdash.example.com/api/integrations/test', { method: 'POST', body: JSON.stringify(body) });
const input = (type: string) => ({ type, settings: { url: 'http://service.example.com', username: 'admin' }, secrets: { password: 'fake-password', apiKey: 'fake-key', token: 'fake-token' } });
beforeEach(() => { vi.resetAllMocks(); state.admin = true; state.demo = false; state.instances = []; });
it.each(['pihole', 'adguard', 'immich', 'photoprism', 'customapi'])('tests %s with the existing success shape', async type => {
  vi.mocked(serviceJson).mockResolvedValue({}); vi.mocked(piholeRequest).mockResolvedValue({});
  const response = await POST(request(input(type)));
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true, message: 'integrations.test.ok', count: 1 });
  if (type === 'customapi') expect(customApiRequest).toHaveBeenCalledWith(expect.objectContaining({ type: 'customapi' }));
  else if (type === 'pihole') expect(vi.mocked(piholeRequest).mock.calls[0][1]).toBe('/api/stats/summary');
  else expect(vi.mocked(serviceJson).mock.calls[0][1]).toBe(type === 'adguard' ? '/control/status' : type === 'immich' ? '/api/search/random' : '/api/v1/config');
});
it('refuses non-admin tests', async () => {
  state.admin = false;
  expect((await POST(request(input('immich')))).status).toBe(401); expect(serviceJson).not.toHaveBeenCalled();
});
it.each(['pihole', 'adguard', 'immich', 'photoprism', 'customapi', 'jellyfin', 'emby', 'plex', 'sonarr', 'radarr', 'lidarr', 'prowlarr', 'qbittorrent', 'transmission', 'deluge', 'sabnzbd', 'nzbget'])('never contacts %s in demo', async type => {
  state.demo = true;
  expect(await (await POST(request(input(type)))).json()).toEqual({ ok: true, message: 'integrations.test.demo' });
  expect(serviceJson).not.toHaveBeenCalled(); expect(piholeRequest).not.toHaveBeenCalled(); expect(customApiRequest).not.toHaveBeenCalled(); expect(serviceBytes).not.toHaveBeenCalled();
});
it('reuses a masked saved secret only at its saved URL and with matching type', async () => {
  state.instances = [{ id: 'photo-service', type: 'immich', name: 'Fictional Photos', settings: { url: 'http://service.example.com' }, secrets: { apiKey: 'fake-saved-key' } }];
  vi.mocked(serviceJson).mockResolvedValue({});
  expect((await POST(request({ id: 'photo-service', type: 'immich', settings: { url: 'http://service.example.com' }, secrets: { apiKey: '********' } }))).status).toBe(200);
  expect(vi.mocked(serviceJson).mock.calls[0][2]?.headers).toEqual({ 'x-api-key': 'fake-saved-key' });
  vi.mocked(serviceJson).mockClear();
  expect(await (await POST(request({ id: 'photo-service', type: 'immich', settings: { url: 'http://other.example.com' }, secrets: { apiKey: '********' } }))).json()).toEqual({ ok: false, message: 'integrations.secretRequired' });
  expect(serviceJson).not.toHaveBeenCalled();
  expect((await POST(request({ id: 'photo-service', type: 'photoprism', settings: { url: 'http://service.example.com' }, secrets: { token: '********' } }))).status).toBe(400);
});
it('uses the requested instance and bounds input', async () => {
  expect((await POST(request({ ...input('immich'), oversized: 'x'.repeat(17000) }))).status).toBe(400);
  expect(serviceJson).not.toHaveBeenCalled();
});
it('reports typed provider errors and parameters with 502/504', async () => {
  vi.mocked(serviceJson).mockRejectedValue(new ServiceError('widgets.error.http', 502, { status: 401 }));
  const response = await POST(request(input('immich')));
  expect(response.status).toBe(502); expect(await response.json()).toEqual({ ok: false, message: 'widgets.error.http', messageParameters: { status: 401 } });
});
it('tells an Immich key without the reading permission apart from a refused key', async () => {
  vi.mocked(serviceJson).mockRejectedValue(new ServiceError('integrations.error.authentication', 502, { status: 403 }));
  expect(await (await POST(request(input('immich')))).json()).toEqual({ ok: false, message: 'integrations.immich.missingPermission' });
  vi.mocked(serviceJson).mockRejectedValue(new ServiceError('integrations.error.authentication', 502, { status: 401 }));
  expect(await (await POST(request(input('immich')))).json()).toMatchObject({ ok: false, message: 'integrations.error.authentication' });
});
it('tests Technitium on the statistics the widget reads and names a missing permission', async () => {
  vi.mocked(serviceJson).mockResolvedValue({ status: 'ok', response: {} });
  expect(await (await POST(request(input('technitium')))).json()).toEqual({ ok: true, message: 'integrations.test.ok', count: 1 });
  expect(vi.mocked(serviceJson).mock.calls[0][1]).toBe('/api/dashboard/stats/get?type=LastHour&utc=true');
  expect(vi.mocked(serviceJson).mock.calls[0][2]?.headers).toEqual({ Authorization: 'Bearer fake-token' });
  vi.mocked(serviceJson).mockResolvedValue({ status: 'error', errorMessage: 'Access was denied.' });
  expect(await (await POST(request(input('technitium')))).json()).toMatchObject({ ok: false, message: 'integrations.technitium.missingPermission' });
});

it('reports a custom API response that is not JSON as a failed connection test', async () => {
  vi.mocked(customApiRequest).mockRejectedValue(new ServiceError('widgets.error.parse'));
  const response = await POST(request(input('customapi')));
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ ok: false, message: 'widgets.error.parse' });
});

it.each(['jellyfin', 'emby', 'plex'])('authenticates the %s media connection with header credentials', async type => {
  vi.mocked(serviceJson).mockResolvedValue({});
  const response = await POST(request(input(type)));
  expect(await response.json()).toEqual({ ok: true, message: 'integrations.test.ok', count: 1 });
  expect(vi.mocked(serviceJson).mock.calls.map(([, path]) => path)).toEqual(type === 'plex' ? ['/identity', '/library/sections'] : [type === 'emby' ? '/emby/System/Info' : '/System/Info']);
  for (const [, path, options] of vi.mocked(serviceJson).mock.calls) {
    expect(path).not.toMatch(/fake-key|fake-token/);
    expect(options?.headers).toEqual(type === 'plex' ? { 'X-Plex-Token': 'fake-token', Accept: 'application/json' } : { 'X-Emby-Token': 'fake-key' });
  }
});


it.each(['sonarr', 'radarr', 'lidarr', 'prowlarr'])('tests %s with its versioned system status and header key', async type => {
  vi.mocked(serviceJson).mockResolvedValue({ version: '1.0.0' });
  const response = await POST(request(input(type)));
  expect(await response.json()).toEqual({ ok: true, message: 'integrations.test.ok', count: 1 });
  expect(serviceJson).toHaveBeenCalledWith(expect.objectContaining({ type }), `/api/${type === 'sonarr' || type === 'radarr' ? 'v3' : 'v1'}/system/status`, { headers: { 'X-Api-Key': 'fake-key' } });
});

it.each(['qbittorrent', 'transmission', 'deluge', 'sabnzbd', 'nzbget'])('tests %s with its authenticated version or RPC endpoint', async type => {
  const { clearQbittorrentSessions } = await import('@/integrations/qbittorrent/collect'); clearQbittorrentSessions();
  const { clearDelugeSessions } = await import('@/integrations/deluge/collect'); clearDelugeSessions();
  const { clearTransmissionSessions } = await import('@/integrations/transmission/collect'); clearTransmissionSessions();
  vi.mocked(serviceBytes).mockImplementation(async (_instance, path, options) => {
    const method = (options?.json as { method?: string } | undefined)?.method;
    const body = path.endsWith('/auth/login') ? 'Ok.' : path.endsWith('/app/version') ? 'v5.0.0' : method === 'session-get' ? JSON.stringify({ result: 'success', arguments: {} }) : path.startsWith('/api?') ? JSON.stringify({ version: '4.0.0' }) : JSON.stringify({ result: method === 'version' ? '1.0.0' : true, error: null });
    return { bytes: Buffer.from(body), status: 200, contentType: 'application/json', headers: { 'set-cookie': ['SID=fictional-session; Path=/', '_session_id=fictional-session; Path=/'] } };
  });
  const response = await POST(request(input(type)));
  expect(await response.json()).toEqual({ ok: true, message: 'integrations.test.ok', count: 1 });
  const calls = vi.mocked(serviceBytes).mock.calls;
  if (type === 'qbittorrent') expect(calls.map(([, path]) => path)).toEqual(['/api/v2/auth/login', '/api/v2/app/version']);
  else if (type === 'transmission') expect(calls[0][2]?.json).toMatchObject({ method: 'session-get' });
  else if (type === 'deluge') expect(calls.map(([, , options]) => (options?.json as { method: string }).method)).toEqual(['auth.login', 'web.connected']);
  else if (type === 'sabnzbd') expect(calls[0][1]).toBe('/api?mode=version&output=json&apikey=fake-key');
  else expect(calls[0][2]?.json).toMatchObject({ method: 'version' });
  expect(JSON.stringify(await (await POST(request(input(type)))).json())).not.toMatch(/fake-key|fake-password|fictional-session/);
});
