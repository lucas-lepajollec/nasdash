import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
import jellyfin from './jellyfin/samples/service.json';
import plex from './plex/samples/service.json';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn() }));
vi.mock('./tvmaze/collect', () => ({ tvMazeShow: vi.fn() }));
import { serviceJson } from '@/lib/widgetData/services';
import { tvMazeShow } from './tvmaze/collect';
import { collectLibraryUpcoming } from '@/lib/widgetData/libraryUpcoming';
const instance = (type: string): IntegrationInstance => ({ id: `${type}-library`, type, name: 'Fictional library', settings: { url: 'https://media.example.com' }, secrets: { apiKey: 'fictional-key', token: 'fictional-token' } });
const json = vi.mocked(serviceJson), maze = vi.mocked(tvMazeShow);
beforeEach(() => { vi.resetAllMocks(); maze.mockResolvedValue({ status: 'Running', next: { season: 3, episode: 1, title: 'Next', at: 123456 } }); });
describe('media libraries for follow-ups', () => {
  it.each(['jellyfin', 'emby'])('reads %s series/provider ids and owned seasons using token headers', async type => {
    json.mockImplementation(async (_instance, path) => path.includes('/Shows/') ? jellyfin.seasons : jellyfin.upcoming);
    const result = await collectLibraryUpcoming(instance(type));
    expect(result[0]).toMatchObject({ title: 'Private library title', ownedSeason: 2, status: 'upcoming', poster: `${type === 'emby' ? '/emby' : ''}/Items/series-1/Images/Primary?fillHeight=480&quality=90` });
    expect(maze).toHaveBeenCalledWith({ tvdb: '12345', imdb: 'tt98765' });
    for (const [, path, options] of json.mock.calls) { expect(path.startsWith(type === 'emby' ? '/emby/' : '/')).toBe(true); expect(options?.headers).toEqual({ 'X-Emby-Token': 'fictional-key' }); expect(path).not.toContain('fictional-key'); }
    expect(json.mock.calls[0][1]).toContain('Limit=500');
  });
  it('reads only Plex show sections and uses Guid entries and actual season indices', async () => {
    json.mockImplementation(async (_instance, path) => path === '/' ? { MediaContainer: { machineIdentifier: 'fictional-machine' } } : path === '/library/sections' ? { MediaContainer: { Directory: [{ key: '1', type: 'show' }, { key: '2', type: 'movie' }] } } : path.includes('/children') ? plex.seasons : plex.upcoming);
    const result = await collectLibraryUpcoming(instance('plex'));
    expect(result[0]).toMatchObject({ status: 'upcoming', ownedSeason: 2 }); expect(result[0].link).toContain('fictional-machine');
    expect(maze).toHaveBeenCalledWith({ tvdb: '12345', imdb: 'tt98765' });
    expect(json.mock.calls.some(([, path]) => path.includes('/sections/2/all'))).toBe(false);
    expect(json.mock.calls.find(([, path]) => path.includes('/sections/1/all'))?.[1]).toContain('type=2&includeGuids=1');
    expect(json.mock.calls.every(([, , options]) => options?.headers?.['X-Plex-Token'] === 'fictional-token')).toBe(true);
  });
  it('isolates unknown and failing series, never reads ended seasons, bounds season concurrency to four and caps series', async () => {
    let active = 0, peak = 0;
    const rows = Array.from({ length: 350 }, (_, i) => ({ ...jellyfin.upcoming.Items[0], Id: `series-${i}`, ProviderIds: { Tvdb: String(i + 1) } }));
    json.mockImplementation(async (_instance, path) => {
      if (path.includes('/Items?')) return { Items: rows };
      active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 1)); active--;
      if (path.includes('/series-3/')) throw new Error('season unavailable'); return jellyfin.seasons;
    });
    maze.mockImplementation(async provider => { if (provider.tvdb === '1') return null; if (provider.tvdb === '2') throw new Error('unknown'); return { status: provider.tvdb === '3' ? 'Ended' : 'Running' }; });
    const result = await collectLibraryUpcoming(instance('jellyfin'));
    expect(maze).toHaveBeenCalledTimes(300); expect(result).toHaveLength(298); expect(peak).toBe(4);
    expect(json.mock.calls.some(([, path]) => path.includes('/Shows/series-2/'))).toBe(false);
    expect(result.find(item => item.id === 'series-3')?.status).toBe('announced');
  });
  it('propagates a failing or malformed media server', async () => {
    json.mockRejectedValue(new Error('unavailable')); await expect(collectLibraryUpcoming(instance('jellyfin'))).rejects.toThrow();
    json.mockResolvedValue({}); await expect(collectLibraryUpcoming(instance('plex'))).rejects.toThrow();
  });
});
