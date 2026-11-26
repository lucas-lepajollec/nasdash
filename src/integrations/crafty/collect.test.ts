import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn(), serviceBytes: vi.fn() }));
import { serviceBytes, serviceJson, ServiceError } from '@/lib/widgetData/services';
import { craftyKit, memoryBytes, playerNames, plainMotd } from './collect';
import sample from './samples/service.json';

const json = vi.mocked(serviceJson);
const bytes = vi.mocked(serviceBytes);
const source: IntegrationInstance = { id: 'crafty-1', type: 'crafty', name: 'Crafty Controller', settings: { url: 'https://crafty.example.com:8443' }, secrets: { apiKey: 'fake-key' } };
const SURVIVAL = '6c7d0a2e-8f1b-4d3a-9e5c-1b2a3c4d5e6f';
beforeEach(() => {
  vi.resetAllMocks();
  json.mockImplementation(async (_instance, path) => {
    if (path === '/api/v2/servers') return sample.servers as never;
    const id = /\/servers\/([^/]+)\/stats/.exec(path)?.[1] ?? '';
    return (sample.stats as Record<string, unknown>)[decodeURIComponent(id)] as never;
  });
});

describe('Crafty Controller', () => {
  it('maps the servers and their live statistics', async () => {
    const summary = await craftyKit.collect(source);
    expect(summary.servers).toEqual([
      { id: SURVIVAL, name: 'Survival', state: 'online', motd: 'A fictional world', version: '1.21.4', players: 2, maxPlayers: 20, playerNames: ['Alex', 'Sam'], cpuPercent: 12.4, memoryPercent: 26.3, memoryBytes: Math.round(2.1 * 1024 ** 3), controllable: true },
      { id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', name: 'Creative', state: 'offline', controllable: true },
    ]);
    expect(json.mock.calls[0][2]?.headers).toEqual({ Authorization: 'Bearer fake-key' });
  });
  it('fails clearly on an answer that is not Crafty', async () => {
    json.mockResolvedValue({ message: 'not found' } as never);
    await expect(craftyKit.collect(source)).rejects.toThrow(ServiceError);
    json.mockResolvedValue({ status: 'error', error: 'NOT_AUTHORIZED' } as never);
    await expect(craftyKit.test(source)).rejects.toThrow(ServiceError);
  });
  it('acts only on a server it listed', async () => {
    await craftyKit.collect(source);
    bytes.mockResolvedValue({ bytes: Buffer.from('{"status":"ok"}'), contentType: 'application/json', status: 200 });
    await craftyKit.actions!.restart.run(source, SURVIVAL);
    expect(bytes.mock.calls[0][1]).toBe(`/api/v2/servers/${SURVIVAL}/action/restart_server`);
    expect(bytes.mock.calls[0][2]).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer fake-key' } });
    await expect(craftyKit.actions!.stop.run(source, 'other-server')).rejects.toThrow(ServiceError);
    await expect(craftyKit.actions!.stop.run(source, '../crafty')).rejects.toThrow(ServiceError);
  });
  it('reads Crafty values', () => {
    expect(memoryBytes('42.2MB')).toBe(Math.round(42.2 * 1024 ** 2));
    expect(memoryBytes(512)).toBe(512 * 1024 ** 2);
    expect(memoryBytes('')).toBeUndefined();
    expect(playerNames("['Alex', 'Sam']")).toEqual(['Alex', 'Sam']);
    expect(playerNames('[]')).toEqual([]);
    expect(plainMotd('§aHello §lworld')).toBe('Hello world');
  });
  it('has a fictional demo with actions', () => {
    craftyKit.actions!.stop.demo!(source, 'survival');
    expect(craftyKit.demo(source).servers.find(server => server.id === 'survival')?.state).toBe('offline');
  });
});
