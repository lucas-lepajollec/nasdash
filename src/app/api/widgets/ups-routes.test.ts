import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { IntegrationInstance } from '@/lib/types';
const state = vi.hoisted(() => ({ demo: false, settings: { integrationId: 'nut-one' } as Record<string, unknown>, instances: [] as IntegrationInstance[], visible: true }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: state.instances }) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
vi.mock('@/lib/widgetData/resolve', () => ({ resolveWidgetSettings: vi.fn(() => state.visible ? { ok: true, settings: state.settings, principal: { role: 'viewer' } } : { ok: false, status: 404, error: 'widgets.error.notFound' }) }));
vi.mock('@/integrations/nut/collect', () => ({ collectNut: vi.fn() }));
vi.mock('@/integrations/apcupsd/collect', () => ({ collectApcupsd: vi.fn() }));
import { GET } from './ups/route';
import { collectNut } from '@/integrations/nut/collect';
import { collectApcupsd } from '@/integrations/apcupsd/collect';

let seq = 0;
const instance = (id: string, type: string): IntegrationInstance => ({ id, type, name: `Fictional ${id}`, settings: { host: `ups-${++seq}.example.com` }, secrets: {} });
const get = () => new NextRequest('http://nasdash.example.com/api/widgets/ups?widgetId=w');
const summary = { provider: 'nut' as const, name: 'x', power: 'mains' as const, fetchedAt: 1 };
beforeEach(() => {
  vi.resetAllMocks();
  state.demo = false; state.visible = true;
  state.instances = [instance('nut-one', 'nut'), instance('apc-one', 'apcupsd'), instance('dns-one', 'pihole')];
  state.settings = { integrationId: 'nut-one' };
});

describe('UPS route', () => {
  it('reads the chosen NUT UPS, or the server first one, and apcupsd without a UPS name', async () => {
    vi.mocked(collectNut).mockResolvedValue(summary);
    expect((await GET(get())).status).toBe(200);
    expect(collectNut).toHaveBeenLastCalledWith(state.instances[0], undefined);
    state.settings = { integrationId: 'nut-one', ups: 'rack' };
    state.instances[0] = instance('nut-one', 'nut');
    await GET(get());
    expect(collectNut).toHaveBeenLastCalledWith(state.instances[0], 'rack');
    vi.mocked(collectApcupsd).mockResolvedValue({ ...summary, provider: 'apcupsd' });
    state.settings = { integrationId: 'apc-one' };
    expect((await (await GET(get())).json()).provider).toBe('apcupsd');
    state.settings = { integrationId: 'apc-one', ups: 'rack' };
    expect((await GET(get())).status).toBe(400);
  });
  it('refuses another type of connection and a hidden widget', async () => {
    state.settings = { integrationId: 'dns-one' };
    expect((await GET(get())).status).toBe(404);
    state.visible = false;
    expect((await GET(get())).status).toBe(404);
    expect(collectNut).not.toHaveBeenCalled();
  });
  it('answers fictional data in the demo without contacting anything', async () => {
    state.demo = true;
    expect(await (await GET(get())).json()).toMatchObject({ provider: 'nut', power: 'mains', nominalWatts: 480 });
    expect(collectNut).not.toHaveBeenCalled();
  });
});
