import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn(), serviceBytes: vi.fn() }));
import { serviceBytes, serviceJson, ServiceError } from '@/lib/widgetData/services';
import { coverPath, rommKit, toRetroLibrary } from './collect';
import sample from './samples/service.json';

const json = vi.mocked(serviceJson);
const source: IntegrationInstance = { id: 'romm-1', type: 'romm', name: 'RomM', settings: { url: 'https://romm.example.com' }, secrets: { apiKey: 'rmm_fake' } };
beforeEach(() => {
  vi.resetAllMocks();
  json.mockImplementation(async (_instance, path) => (path === '/api/stats' ? sample.stats : path === '/api/platforms' ? sample.platforms : sample.roms) as never);
});

describe('RomM', () => {
  it('maps the library, its platforms and the latest games', async () => {
    const summary = await rommKit.collect(source);
    expect(summary.totals).toEqual({ platforms: 3, games: 128, saves: 14, states: 5, screenshots: 22, sizeBytes: 9126805504 });
    expect(summary.platforms).toEqual([{ id: '2', name: 'NES', games: 70 }, { id: '1', name: 'Game Boy', games: 54 }, { id: '3', name: 'Nintendo 64', games: 4 }]);
    expect(summary.recent.map(game => [game.name, game.platform, game.cover])).toEqual([['Micro Mages', 'NES', 'romm-812'], ['Tobu Tobu Girl.gb', 'Game Boy', undefined], ['Odd path', 'NES', undefined]]);
    expect(json.mock.calls[0][2]?.headers).toEqual({ Authorization: 'Bearer rmm_fake' });
  });
  it('signs in with the account when chosen', async () => {
    await rommKit.collect({ ...source, settings: { ...source.settings, auth: 'login', username: 'player' }, secrets: { password: 'fake-password' } });
    expect(json.mock.calls[0][2]?.headers).toEqual({ Authorization: `Basic ${Buffer.from('player:fake-password').toString('base64')}` });
  });
  it('serves only the covers it listed, from RomM resources', async () => {
    await rommKit.collect(source);
    vi.mocked(serviceBytes).mockResolvedValue({ bytes: Buffer.from('img'), contentType: 'image/png', status: 200 });
    await rommKit.image!(source, 'romm-812');
    expect(vi.mocked(serviceBytes).mock.calls[0][1]).toBe('/assets/romm/resources/roms/2/812/cover/small.png?ts=2026-11-20 10:11:12');
    await expect(rommKit.image!(source, 'romm-999')).rejects.toThrow(ServiceError);
    expect(coverPath('../../etc/passwd')).toBeUndefined();
    expect(coverPath('/api/token')).toBeUndefined();
  });
  it('fails clearly on an answer that is not RomM', () => {
    expect(() => toRetroLibrary(source, {}, { detail: 'Not found' }, {})).toThrow(ServiceError);
  });
});
