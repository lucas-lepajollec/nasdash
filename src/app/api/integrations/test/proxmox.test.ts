import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { CollectError } from '@/integrations/types';
import { MonitoringHttpError } from '@/lib/monitoringError';

const state = vi.hoisted(() => ({ admin: true, demo: false }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [{
  id: 'fictional-pve', type: 'proxmox', name: 'Fictional PVE',
  settings: { ip: 'pve.example.com', port: '8006', username: 'monitor@pve!nasdash' },
  secrets: { password: 'fictional-secret' },
}] }) }));
vi.mock('@/lib/auth', () => ({ checkAdmin: () => state.admin ? null : NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
vi.mock('@/integrations/collectors', () => ({ DEVICE_COLLECTORS: { proxmox: vi.fn() }, TARGET_LISTERS: { proxmox: vi.fn() } }));
import { DEVICE_COLLECTORS, TARGET_LISTERS } from '@/integrations/collectors';
import { POST } from './route';
const request = (values?: Record<string, string>) => new NextRequest('http://nasdash.example.com/api/integrations/test', {
  method: 'POST', body: JSON.stringify({ type: 'proxmox', id: 'fictional-pve', ...(values ? { values } : {}) }),
});

beforeEach(() => { vi.resetAllMocks(); state.admin = true; state.demo = false; });

it('tests the selected node metrics with the saved credential instead of repeating discovery', async () => {
  vi.mocked(TARGET_LISTERS.proxmox).mockResolvedValue([{ values: { nodeName: 'orion' }, label: 'orion', detail: 'online' }]);
  expect(await (await POST(request())).json()).toMatchObject({ ok: true, count: 1 });
  vi.mocked(DEVICE_COLLECTORS.proxmox).mockRejectedValue(new CollectError('integrations.proxmox.nodePermission', new MonitoringHttpError('Proxmox', 403)));
  const response = await (await POST(request({ nodeName: 'orion' }))).json();
  expect(response).toEqual({ ok: false, message: 'integrations.proxmox.nodePermission' });
  expect(DEVICE_COLLECTORS.proxmox).toHaveBeenCalledWith(expect.objectContaining({
    url: 'https://pve.example.com:8006/api2/json/nodes/orion/status', token: 'monitor@pve!nasdash=fictional-secret', allowSelfSigned: false,
  }), expect.anything());
  expect(TARGET_LISTERS.proxmox).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(response)).not.toMatch(/fictional-secret|pve\.example\.com|monitor@/);
});

it.each(['qemu', 'lxc'])('tests the selected %s and returns the metric count', async vmType => {
  vi.mocked(DEVICE_COLLECTORS.proxmox).mockResolvedValue({ metrics: [{ key: 'cpu.usage', kind: 'cpu', percent: 25 }] });
  expect(await (await POST(request({ nodeName: 'orion', vmid: '101', vmType }))).json()).toEqual({ ok: true, message: 'integrations.test.ok', count: 1 });
  expect(DEVICE_COLLECTORS.proxmox).toHaveBeenCalledWith(expect.objectContaining({ url: `https://pve.example.com:8006/api2/json/nodes/orion/${vmType}/101/status/current`, vmid: '101', vmType }), expect.anything());
});

it('never tests a real machine in the public demo or for an anonymous user', async () => {
  state.demo = true;
  expect(await (await POST(request({ nodeName: 'orion' }))).json()).toMatchObject({ ok: true, message: 'integrations.test.demo' });
  state.admin = false;
  expect((await POST(request({ nodeName: 'orion' }))).status).toBe(401);
  expect(DEVICE_COLLECTORS.proxmox).not.toHaveBeenCalled();
  expect(TARGET_LISTERS.proxmox).not.toHaveBeenCalled();
});
