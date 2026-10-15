import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { IntegrationInstance } from '@/lib/types';
const state = vi.hoisted(() => ({ demo: false, admin: true, instances: [] as IntegrationInstance[] }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: state.instances }) }));
vi.mock('@/lib/auth', () => ({ checkAdmin: () => state.admin ? null : NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 401 }) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn() }));
vi.mock('@/integrations/pihole/collect', () => ({ piholeRequest: vi.fn() }));
import { POST } from './route';
import { piholeRequest } from '@/integrations/pihole/collect';
import { serviceJson, ServiceError } from '@/lib/widgetData/services';
const request = (body: unknown) => new NextRequest('http://nasdash.example.com/api/integrations/test', { method: 'POST', body: JSON.stringify(body) });
const input = (type: string) => ({ type, settings: { url: 'http://service.example.com', username: 'admin' }, secrets: { password: 'fake-password', apiKey: 'fake-key', token: 'fake-token' } });
beforeEach(() => { vi.resetAllMocks(); state.admin = true; state.demo = false; state.instances = []; });
it.each(['pihole', 'adguard', 'immich', 'photoprism'])('tests %s with the existing success shape', async type => {
  vi.mocked(serviceJson).mockResolvedValue({}); vi.mocked(piholeRequest).mockResolvedValue({});
  const response = await POST(request(input(type)));
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true, message: 'integrations.test.ok', count: 1 });
  if (type === 'pihole') expect(vi.mocked(piholeRequest).mock.calls[0][1]).toBe('/api/stats/summary');
  else expect(vi.mocked(serviceJson).mock.calls[0][1]).toBe(type === 'adguard' ? '/control/status' : type === 'immich' ? '/api/users/me' : '/api/v1/config');
});
it('refuses non-admin tests', async () => {
  state.admin = false;
  expect((await POST(request(input('immich')))).status).toBe(401); expect(serviceJson).not.toHaveBeenCalled();
});
it.each(['pihole', 'adguard', 'immich', 'photoprism'])('never contacts %s in demo', async type => {
  state.demo = true;
  expect(await (await POST(request(input(type)))).json()).toEqual({ ok: true, message: 'integrations.test.demo' });
  expect(serviceJson).not.toHaveBeenCalled(); expect(piholeRequest).not.toHaveBeenCalled();
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
