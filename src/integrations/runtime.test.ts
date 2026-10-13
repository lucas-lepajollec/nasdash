import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '@/lib/types';
import { collectBeszel } from './beszel/collect';
import { devicesStatusCache, incrementActiveClients, decrementActiveClients, pollDevice } from './runtime';

const config = vi.hoisted(() => ({ settings: { tasks: { monitoringSeconds: 5, idleMonitoringSeconds: 60, backupSchedule: 'off' } }, devices: [] as Device[], integrations: [] }));
vi.mock('@/lib/config', () => ({ readConfig: () => config }));
vi.mock('@/lib/backups', () => ({ isBackupDue: () => false, createBackup: vi.fn(), pruneAutomaticBackups: vi.fn() }));
afterEach(() => { config.devices = []; vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

const device: Device = { id: 'fictional-cache', name: 'Test host', host: '', icon: '', api: { type: 'glances', url: 'http://a.example/api/4/all', token: 'test:old' } };

describe('monitoring connection and polling lifecycle', () => {
  it('never sends new credentials to the former Glances endpoint after reconfiguration', async () => {
    const fetch = vi.fn(async (url: string) => new Response(JSON.stringify({ cpu: { total: url.includes('b.example') ? 82 : 12 } })));
    vi.stubGlobal('fetch', fetch);
    await pollDevice(device, config);
    const fresh = await pollDevice({ ...device, api: { ...device.api!, url: 'http://b.example/api/4/all', token: 'test:new' } }, config);
    expect(fresh).toMatchObject({ online: true, metrics: [{ percent: 82 }] });
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['http://a.example/api/4/all', 'http://b.example/api/4/all']);
  });
  it('returns localizable HTTP failures with parameters instead of raw French copy', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })));
    expect(await pollDevice({ ...device, id: 'fictional-http-error' }, config)).toMatchObject({ online: false, error: 'integrations.error.http', errorParameters: { service: 'Glances', status: 403 } });
  });
  it('drops a Beszel session before contacting a changed server even outside background polling', async () => {
    const requests: Array<{ url: string; authorization?: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
      requests.push({ url, authorization: (options.headers as Record<string, string>)?.Authorization });
      if (url.endsWith('/auth-with-password')) return new Response(JSON.stringify({ token: url.includes('b.example') ? 'session-b' : 'session-a' }));
      return new Response(JSON.stringify({ items: [{ id: 'node', name: 'node', status: 'up', info: { cpu: 20 } }] }));
    }));
    const context = { memory: {} as Record<string, string>, warn: vi.fn(), clearWarning: vi.fn() };
    await collectBeszel({ url: 'http://a.example', token: 'test:old', target: 'node' }, context);
    await collectBeszel({ url: 'http://b.example', token: 'test:new', target: 'node' }, context);
    expect(requests.filter(request => request.url.includes('b.example')).map(request => request.authorization)).toEqual([undefined, 'session-b', 'session-b']);
  });
  it('discards a pending response after the configured connection is edited', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T00:00:00Z'));
    let release!: (response: Response) => void;
    const fetch = vi.fn(async () => fetch.mock.calls.length === 1 ? new Promise<Response>(resolve => { release = resolve; }) : new Response(JSON.stringify({ cpu: { total: 82 } })));
    vi.stubGlobal('fetch', fetch);
    const id = 'fictional-edit-during-poll';
    config.devices = [{ ...device, id }];
    try {
      incrementActiveClients();
      await vi.advanceTimersByTimeAsync(0);
      config.devices = [{ ...device, id, api: { ...device.api!, url: 'http://b.example/api/4/all', token: 'test:new' } }];
      release(new Response(JSON.stringify({ cpu: { total: 12 } })));
      await vi.advanceTimersByTimeAsync(0);
      expect(devicesStatusCache[id]).toBeUndefined();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(devicesStatusCache[id]?.metrics?.[0].percent).toBe(82);
    } finally {
      decrementActiveClients();
      const state = globalThis as typeof globalThis & { __monitoringInterval?: ReturnType<typeof setInterval>; __lastPollAt?: number };
      clearInterval(state.__monitoringInterval); state.__monitoringInterval = undefined; state.__lastPollAt = undefined;
    }
  });
  it('serializes slow polls so an old reading cannot overwrite a newer result', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T00:00:00Z'));
    let release!: (response: Response) => void;
    const fetch = vi.fn(async () => fetch.mock.calls.length === 1 ? new Promise<Response>(resolve => { release = resolve; }) : new Response(JSON.stringify({ cpu: { total: 80 } })));
    vi.stubGlobal('fetch', fetch);
    config.devices = [{ ...device, id: 'fictional-serialized-poll' }];
    try {
      incrementActiveClients();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetch).toHaveBeenCalledTimes(1);
      release(new Response(JSON.stringify({ cpu: { total: 10 } })));
      await vi.advanceTimersByTimeAsync(0);
      expect(devicesStatusCache[config.devices[0].id]?.metrics?.[0].percent).toBe(10);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(devicesStatusCache[config.devices[0].id]?.metrics?.[0].percent).toBe(80);
    } finally {
      decrementActiveClients();
      const state = globalThis as typeof globalThis & { __monitoringInterval?: ReturnType<typeof setInterval>; __pollRunning?: boolean; __lastPollAt?: number };
      clearInterval(state.__monitoringInterval); state.__monitoringInterval = undefined; state.__lastPollAt = undefined;
    }
  });
});
