import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
import piholeSample from './pihole/samples/service.json';
import adguardSample from './adguard/samples/service.json';
import immichSample from './immich/samples/service.json';
import photoprismSample from './photoprism/samples/service.json';
vi.mock('@/lib/config', () => ({ readConfig: vi.fn(() => ({ integrations: [] })) }));
vi.mock('@/lib/widgetData/services', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn() }));
import { serviceJson, ServiceError, serviceIdentity, knownInstancePhoto, validPhotoId, photoSelection } from '@/lib/widgetData/services';
import { clearPiholeSessions, collectPihole, piholeRequest, toPiholeSummary, togglePihole } from './pihole/collect';
import { collectAdguard, toAdguardSummary, toggleAdguard } from './adguard/collect';
import { collectImmich, toImmichPhotos, immichAlbums } from './immich/collect';
import { collectPhotoprism, toPhotoprismPhotos, photoprismAlbums } from './photoprism/collect';
const now = Date.UTC(2026, 0, 15, 12);
const instance = (type: string, id = 'service-1'): IntegrationInstance => ({ id, type, name: 'Fictional Service', settings: { url: 'http://service.example.com', username: 'admin' }, secrets: { password: 'fake-password', apiKey: 'fake-key', token: 'fake-token' } });
const json = vi.mocked(serviceJson);
beforeEach(() => { vi.resetAllMocks(); clearPiholeSessions(); });

describe('Pi-hole v6', () => {
  it('maps summary, enum blocking, seconds history, and client IP fallback', () => {
    const s = piholeSample;
    const result = toPiholeSummary(instance('pihole'), s.summary, { blocking: 'disabled', timer: 30 }, s.history, s.blocked, s.queried, s.clients, now);
    expect(result).toMatchObject({ queries: 28400, blocked: 6248, blockedPercent: 22, listedDomains: 154000, clients: 8, blocking: false, blockingResumesAt: now + 30000 });
    expect(result.history).toHaveLength(24);
    expect(result.history[0]).toEqual([now - 23 * 3600000, 680, 150]);
    expect(result.topClients[1]).toEqual({ name: '192.0.2.20', count: 2100 });
  });
  it('reuses sessions for one instance and isolates another instance', async () => {
    json.mockImplementation(async (_instance, path) => path === '/api/auth' ? piholeSample.auth : piholeSample.summary);
    const first = instance('pihole');
    await Promise.all([piholeRequest(first, '/api/stats/summary'), piholeRequest(first, '/api/dns/blocking')]);
    await piholeRequest(first, '/api/stats/summary');
    expect(json.mock.calls.filter(([, path]) => path === '/api/auth')).toHaveLength(1);
    expect(json.mock.calls[1][2]?.headers).toEqual({ 'X-FTL-SID': 'fictional-pihole-session' });
    await piholeRequest(instance('pihole', 'second'), '/api/stats/summary');
    expect(json.mock.calls.filter(([, path]) => path === '/api/auth')).toHaveLength(2);
  });
  it('relogs once on 401, shares concurrent login, and never loops on refusal', async () => {
    let auth = 0;
    json.mockImplementation(async (_instance, path, options) => {
      if (path === '/api/auth') return { session: { sid: `fictional-${++auth}`, validity: 300 } };
      if (options?.headers?.['X-FTL-SID'] === 'fictional-1') throw new ServiceError('integrations.error.authentication', 502, { status: 401 });
      return piholeSample.summary;
    });
    await Promise.all([piholeRequest(instance('pihole'), '/api/stats/summary'), piholeRequest(instance('pihole'), '/api/dns/blocking')]);
    expect(auth).toBe(2);
    json.mockImplementation(async (_instance, path) => path === '/api/auth' ? piholeSample.auth : Promise.reject(new ServiceError('integrations.error.authentication', 502, { status: 401 })));
    await expect(piholeRequest(instance('pihole'), '/api/stats/summary')).rejects.toThrow('integrations.error.authentication');
  });
  it('expires SID and reauthenticates after credentials change', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(now);
      json.mockImplementation(async (_instance, path) => path === '/api/auth' ? piholeSample.auth : {});
      await piholeRequest(instance('pihole'), '/api/stats/summary');
      vi.setSystemTime(now + 301000);
      await piholeRequest(instance('pihole'), '/api/stats/summary');
      await piholeRequest({ ...instance('pihole'), secrets: { password: 'changed-fake-password' } }, '/api/stats/summary');
      expect(json.mock.calls.filter(([, path]) => path === '/api/auth')).toHaveLength(3);
    } finally { vi.useRealTimers(); }
  });
  it('uses documented collectors paths and boolean/timer toggle bodies', async () => {
    json.mockImplementation(async (_instance, path) => path === '/api/auth' ? piholeSample.auth : path === '/api/stats/summary' ? piholeSample.summary : path === '/api/dns/blocking' ? piholeSample.blocking : {});
    await collectPihole(instance('pihole'));
    expect(json.mock.calls.map(([, path]) => path)).toContain('/api/stats/top_domains?blocked=true&count=8');
    expect(json.mock.calls.map(([, path]) => path)).toContain('/api/history');
    await togglePihole(instance('pihole'), false, 60);
    expect(json.mock.lastCall?.[2]?.json).toEqual({ blocking: false, timer: 60 });
    await togglePihole(instance('pihole'), true);
    expect(json.mock.lastCall?.[2]?.json).toEqual({ blocking: true, timer: null });
  });
});

describe('AdGuard Home', () => {
  it('maps hourly statistics, milliseconds, pause duration and filters', () => {
    const s = adguardSample;
    const result = toAdguardSummary(instance('adguard'), { protection_enabled: false, protection_disabled_duration: 60000 }, s.stats, s.filtering, now);
    expect(result).toMatchObject({ queries: 28400, blocked: 6248, blockedPercent: 22, averageMs: 2.4, listedDomains: 154000, blockingResumesAt: now + 60000 });
    expect(result.history[0]).toEqual([now - 23 * 3600000, 680, 150]);
    expect(result.history[23][0]).toBe(now);
    expect(result.topQueried[0]).toEqual({ name: 'media.example.com', count: 3800 });
  });
  it('requests a 24 hour window with Basic auth and converts toggle seconds to ms', async () => {
    json.mockImplementation(async (_instance, path) => path === '/control/status' ? adguardSample.status : adguardSample.stats);
    await collectAdguard(instance('adguard'));
    expect(json.mock.calls[1][1]).toBe('/control/stats?recent=86400000');
    expect(json.mock.calls[1][2]?.headers).toEqual({ Authorization: `Basic ${Buffer.from('admin:fake-password').toString('base64')}` });
    await toggleAdguard(instance('adguard'), false, 120);
    expect(json.mock.lastCall?.[2]?.json).toEqual({ enabled: false, duration: 120000 });
    await toggleAdguard(instance('adguard'), true);
    expect(json.mock.lastCall?.[2]?.json).toEqual({ enabled: true, duration: 0 });
  });
});

describe('Photo libraries', () => {
  it('maps Immich photos and rejects unsupported IDs / duplicate assets', () => {
    const assets = [...immichSample.assets, immichSample.assets[0], { id: '../../secret' }];
    const result = toImmichPhotos(instance('immich'), assets, 'photos-1', 60);
    expect(result).toHaveLength(12);
    expect(result[0]).toMatchObject({ width: 1200, height: 800, place: 'Silver Lake, Example Country', link: `http://service.example.com/photos/${immichSample.assets[0].id}` });
    expect(result[0].preview).toContain('widgetId=photos-1');
    expect(result[0].preview).toContain('size=preview');
  });
  it('maps PhotoPrism UID/files and binds hashes to instance identity', () => {
    const source = instance('photoprism');
    const result = toPhotoprismPhotos(source, photoprismSample.photos, 'photos-2');
    expect(result).toHaveLength(12);
    expect(result[0]).toMatchObject({ id: 'pdemo00000000000', width: 1200, height: 800 });
    expect(result[0].link).toContain('q=uid%3A');
    expect(knownInstancePhoto(source, result[0].id)?.hash).toBe(photoprismSample.photos[0].Hash);
    expect(knownInstancePhoto(instance('photoprism', 'other'), result[0].id)).toBeUndefined();
    expect(serviceIdentity(source)).not.toContain('fake-token');
  });
  it('validates UUID, UID/hash, album IDs and bounded counts', () => {
    for (const id of ['../x', '%2e%2e', 'abc/def', 'p123', '00000000-0000-4000-8000-000000000000/']) {
      expect(validPhotoId('immich', id)).toBe(false);
      expect(validPhotoId('photoprism', id)).toBe(false);
    }
    expect(validPhotoId('immich', immichSample.assets[0].id)).toBe(true);
    expect(validPhotoId('photoprism', photoprismSample.photos[0].Hash)).toBe(true);
    expect(photoSelection({}, 'immich')).toEqual({ mode: 'random', count: 12 });
    expect(photoSelection({ count: 100 }, 'immich').count).toBe(60);
    expect(() => photoSelection({ mode: 'album', albumId: '../x' }, 'immich')).toThrow();
  });
  it.each(['random', 'recent', 'favorites', 'album', 'memories'] as const)('Immich %s selection follows its API and optional stats denial is harmless', async mode => {
    json.mockImplementation(async (_instance, path) => {
      if (path === '/api/server/statistics') throw new ServiceError('integrations.error.authentication', 502, { status: 403 });
      if (path.startsWith('/api/albums/')) return { assets: immichSample.assets };
      if (path.startsWith('/api/memories')) return [{ assets: immichSample.assets }];
      return path.endsWith('/random') ? immichSample.assets : { assets: { items: immichSample.assets } };
    });
    const response = await collectImmich(instance('immich'), { mode, count: 3, albumId: immichSample.albums[0].id }, 'photos-1');
    expect(response.photos).toHaveLength(3);
    expect(response.stats).toBeUndefined();
    if (mode === 'favorites') expect(json.mock.calls[0][2]?.json).toMatchObject({ isFavorite: true, type: 'IMAGE', order: 'desc' });
    if (mode === 'random') expect(json.mock.calls[0][2]?.json).toMatchObject({ withExif: true, size: 3 });
  });
  it('falls back from memories to prior-year day searches', async () => {
    json.mockImplementation(async (_instance, path) => {
      if (path.startsWith('/api/memories')) throw new ServiceError('widgets.error.http', 502, { status: 404 });
      if (path === '/api/server/statistics') return immichSample.statistics;
      return { assets: { items: immichSample.assets } };
    });
    expect((await collectImmich(instance('immich'), { mode: 'memories', count: 3 }, 'p')).photos).toHaveLength(3);
    expect(json.mock.calls[1][2]?.json).toMatchObject({ takenAfter: expect.any(String), takenBefore: expect.any(String), type: 'IMAGE' });
  });
  it.each(['random', 'recent', 'favorites', 'album', 'memories'] as const)('PhotoPrism %s query includes image filters', async mode => {
    json.mockResolvedValue(photoprismSample.photos);
    expect((await collectPhotoprism(instance('photoprism'), { mode, count: 3, albumId: photoprismSample.albums[0].UID }, 'photos-2')).photos).toHaveLength(3);
    const url = new URL(json.mock.calls[0][1], 'http://fixture');
    expect(url.searchParams.get('merged')).toBe('true');
    expect(url.searchParams.get('quality')).toBe('3');
    expect(url.searchParams.get('order')).toBe(mode === 'random' ? 'random' : 'newest');
    if (mode === 'favorites') expect(url.searchParams.get('favorite')).toBe('true');
    if (mode === 'album') expect(url.searchParams.get('s')).toBe(photoprismSample.albums[0].UID);
  });
  it('maps bounded albums', async () => {
    json.mockResolvedValueOnce(immichSample.albums).mockResolvedValueOnce(photoprismSample.albums);
    expect(await immichAlbums(instance('immich'))).toEqual([{ id: immichSample.albums[0].id, name: 'Summer Trails', count: 12 }]);
    expect(await photoprismAlbums(instance('photoprism'))).toEqual([{ id: 'ademo00000000001', name: 'Summer Trails', count: 12 }]);
  });
});
