import { beforeEach, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn() }));
import { serviceJson, ServiceError } from '@/lib/widgetData/services';
import { collectJellyfinLibrary, collectJellyfinMusicHistory, collectJellyfinMusicNowPlaying, jellyfinMusicStreamPath } from '../jellyfin/collect';
const instance: IntegrationInstance = { id: 'emby-fixture', type: 'emby', name: 'Fictional Emby', settings: { url: 'https://emby.example.com' }, secrets: { apiKey: 'fictional-key' } };
const json = vi.mocked(serviceJson);
beforeEach(() => vi.resetAllMocks());
it('reads current paged Emby users and virtual folders', async () => {
  json.mockImplementation(async (_source, path) => {
    if (path === '/emby/Users/Query?Limit=101') return { Items: [{ Id: 'listener' }], TotalRecordCount: 1 };
    if (path === '/emby/Library/VirtualFolders/Query?Limit=30') return { Items: [], TotalRecordCount: 0 };
    if (path === '/emby/Items/Counts') return { MovieCount: 2 };
    return { Items: [{ Id: 'album', Name: 'Quiet', Type: 'MusicAlbum', UserData: { LastPlayedDate: '2026-01-01T00:00:00Z', PlayCount: 2 } }] };
  });
  expect((await collectJellyfinMusicHistory(instance))[0].id).toBe('album');
  expect((await collectJellyfinLibrary(instance)).counts.movies).toBe(2);
  expect(json.mock.calls.some(([, path]) => path.includes('/Users/listener/Items'))).toBe(true);
  expect(json.mock.calls.some(([, path]) => path.includes('Fields=DateCreated,ProductionYear'))).toBe(false);
});
it('falls back only on 404 for older Emby users and folders', async () => {
  json.mockImplementation(async (_source, path) => {
    if (path.includes('/Query?')) throw new ServiceError('widgets.error.http', 502, { status: 404 });
    if (path.endsWith('/Users')) return [{ Id: 'listener' }];
    if (path.endsWith('/VirtualFolders')) return [];
    return { Items: [], MovieCount: 1 };
  });
  expect(await collectJellyfinMusicHistory(instance)).toEqual([]);
  expect((await collectJellyfinLibrary(instance)).counts.movies).toBe(1);
  json.mockRejectedValue(new ServiceError('integrations.error.authentication', 502, { status: 403 }));
  await expect(collectJellyfinMusicHistory(instance)).rejects.toMatchObject({ parameters: { status: 403 } });
});
it('reads the Emby session queue endpoint and uses container-in-path audio negotiation', async () => {
  const track = { Id: 'song', Name: 'Quiet', Type: 'Audio', PlaylistItemId: 'current' };
  json.mockImplementation(async (_source, path) => {
    if (path === '/emby/Sessions') return [{ Id: 'session', PlaylistItemId: 'current', NowPlayingItem: track }];
    if (path === '/emby/Sessions/PlayQueue?Id=session') return { Items: [track, { ...track, Id: 'next', PlaylistItemId: 'next' }] };
    return { Items: [{ ...track, Id: 'next' }] };
  });
  expect((await collectJellyfinMusicNowPlaying(instance)).sessions[0].next?.[0].id).toBe('next');
  expect(await jellyfinMusicStreamPath(instance, 'song')).toBe('/emby/Audio/song/universal.mp3?DeviceId=NasDash');
});
