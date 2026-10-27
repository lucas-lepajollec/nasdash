import { EventEmitter } from 'node:events';
import https from 'node:https';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MonitoringHttpError } from '@/lib/monitoringError';
import { collectProxmox, listProxmoxTargets } from './collect';
import type { CollectContext } from '../types';

const connection = { url: 'https://pve.example.com:8006/api2/json/nodes/orion/status', token: 'monitor@pve!nasdash=fictional-secret' };
const replies = new Map<string, { status?: number; data: unknown }>();
let paths: string[];
let context: CollectContext;

beforeEach(() => {
  paths = [];
  context = { memory: {}, warn: vi.fn(), clearWarning: vi.fn() };
  replies.clear();
  vi.spyOn(https, 'request').mockImplementation(((options: https.RequestOptions, callback: (response: EventEmitter) => void) => {
    const path = String(options.path);
    paths.push(path);
    const req = new EventEmitter() as EventEmitter & { end(): void };
    req.end = () => queueMicrotask(() => {
      const reply = replies.get(path) ?? { status: 403, data: null };
      const response = Object.assign(new EventEmitter(), { statusCode: reply.status ?? 200 });
      callback(response);
      response.emit('data', JSON.stringify({ data: reply.data }));
      response.emit('end');
    });
    return req;
  }) as typeof https.request);
});
afterEach(() => vi.restoreAllMocks());

it('distinguishes successful discovery from a denied node metrics request (#142)', async () => {
  replies.set('/api2/json/nodes', { data: [{ node: 'orion', status: 'online' }] });
  expect(await listProxmoxTargets(connection, context)).toEqual([{ values: { nodeName: 'orion' }, label: 'orion', detail: 'online' }]);
  await expect(collectProxmox(connection, context)).rejects.toMatchObject({
    message: 'integrations.proxmox.nodePermission',
    reason: expect.objectContaining({ status: 403 }),
  });
  expect(paths).toContain('/api2/json/nodes/orion/status');
  expect(paths).not.toContain('/api2/json/nodes/orion/storage');
});

it.each(['qemu', 'lxc'])('explains a denied %s metric request with the guest permission', async kind => {
  await expect(collectProxmox({ ...connection, url: `https://pve.example.com/api2/json/nodes/orion/${kind}/101/status/current`, vmid: '101' }, context))
    .rejects.toMatchObject({ message: 'integrations.proxmox.guestPermission', reason: expect.objectContaining({ status: 403 }) });
});

it.each([401, 404, 500])('keeps HTTP %s distinct from a permission denial', async status => {
  replies.set('/api2/json/nodes/orion/status', { status, data: null });
  await expect(collectProxmox(connection, context)).rejects.toMatchObject({ message: 'integrations.error.http', parameters: { service: 'Proxmox', status } });
});

it('keeps node CPU, RAM and uptime available when storage permission is missing', async () => {
  replies.set('/api2/json/nodes/orion/status', { data: { cpu: 0.25, memory: { used: 8, total: 32 }, uptime: 7200 } });
  expect(await collectProxmox(connection, context)).toEqual({
    metrics: [{ key: 'cpu.usage', kind: 'cpu', percent: 25 }, { key: 'memory.usage', kind: 'memory', percent: 25, totalBytes: 32 }],
    vitals: { uptimeSeconds: 7200 },
  });
  expect(context.warn).toHaveBeenCalledWith('Proxmox Storage', expect.any(MonitoringHttpError));
});
