import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn(), serviceBytes: vi.fn() }));
import { serviceJson, serviceBytes, ServiceError } from '@/lib/widgetData/services';
import { collectImmichStats, toImmichStats } from './immich/stats';
import { collectPhotoprismStats, toPhotoprismStats } from './photoprism/stats';
import { clearPiwigoSessions, collectPiwigoStats, toPiwigoStats } from './piwigo/collect';
import { clearLibrephotosSessions, collectLibrephotosStats, librephotosRequest, toLibrephotosStats } from './librephotos/collect';
import immich from './immich/samples/stats.json';
import prism from './photoprism/samples/stats.json';
import piwigo from './piwigo/samples/service.json';
import libre from './librephotos/samples/service.json';
const instance = (type: string): IntegrationInstance => ({ id: `${type}-one`, type, name: 'Fictional Library', settings: { url: 'https://photos.example.com', username: 'fictional' }, secrets: { password: 'fake-password', apiKey: 'fake-key', token: 'fake-token' } });
const json = vi.mocked(serviceJson), bytes = vi.mocked(serviceBytes);
beforeEach(() => { vi.resetAllMocks(); clearPiwigoSessions(); clearLibrephotosSessions(); });
describe('provider photo stats', () => {
  it('maps only contract fields and keeps missing values absent', () => {
    expect(toImmichStats(instance('immich'), immich.statistics)).toMatchObject({ photos: 12400, videos: 380, libraryBytes: 184000000000, users: [{ name: 'Alex', photos: 7200, videos: 240, bytes: 112000000000 }, { name: 'Robin' }] });
    expect(toPhotoprismStats(instance('photoprism'), prism)).toEqual({ provider: 'photoprism', name: 'Fictional Library', photos: 12400, videos: 380, albums: 42, places: 126, people: 68, favorites: 840, fetchedAt: expect.any(Number) });
    expect(toPhotoprismStats(instance('photoprism'), { count: { photos: 0 } })).not.toHaveProperty('videos');
    expect(toPiwigoStats(instance('piwigo'), piwigo.result)).toEqual({ provider: 'piwigo', name: 'Fictional Library', items: 12400, albums: 42, fetchedAt: expect.any(Number) });
    expect(toPiwigoStats(instance('piwigo'), { infos: { nb_elements: '0', library_size_bytes: '123' } })).toMatchObject({ items: 0 });
    expect(toLibrephotosStats(instance('librephotos'), libre.stats, libre.months)).toMatchObject({ photos: 12400, videos: 380, albums: 42, people: 68, byYear: [{ year: 2024, count: 1000 }, { year: 2025, count: 840 }] });
  });
  it('rejects malformed primary responses', () => {
    expect(() => toImmichStats(instance('immich'), {})).toThrow();
    expect(() => toPhotoprismStats(instance('photoprism'), {})).toThrow();
    expect(() => toPiwigoStats(instance('piwigo'), {})).toThrow();
    expect(() => toLibrephotosStats(instance('librephotos'), {})).toThrow();
  });
  function mockImmich(admin = true) {
    json.mockImplementation(async (_source, path) => {
      if (path === '/api/server/statistics') { if (!admin) throw new ServiceError('integrations.error.authentication', 502, { status: 403 }); return immich.statistics; }
      if (path === '/api/assets/statistics') return immich.assets;
      if (path === '/api/server/storage') return immich.storage;
      if (path === '/api/albums') return immich.owned;
      if (path === '/api/albums?shared=true') return immich.shared;
      if (path.startsWith('/api/people')) return immich.people;
      if (path.startsWith('/api/timeline')) return immich.buckets;
      return { assets: { items: [{ id: 'one', createdAt: new Date().toISOString() }, { id: 'one', createdAt: new Date().toISOString() }, { id: 'bad', createdAt: 'invalid' }], nextPage: null } };
    });
  }
  it('collects Immich optional stats, deduplicates albums, groups years and daily additions', async () => {
    mockImmich();
    const result = await collectImmichStats(instance('immich'));
    expect(result).toMatchObject({ albums: 3, people: 68, disk: { usedBytes: 640000000000, totalBytes: 2000000000000 }, byYear: [{ year: 2024, count: 1000 }, { year: 2025, count: 840 }] });
    expect(result.added).toHaveLength(30); expect(result.added?.[29]).toBe(1);
    expect(json.mock.calls.find(([, path]) => path === '/api/search/metadata')?.[2]?.json).toMatchObject({ size: 1000, page: 1, createdAfter: expect.any(String) });
  });
  it('falls back for a non-admin Immich key and tolerates unavailable optional endpoints', async () => {
    mockImmich(false);
    const result = await collectImmichStats(instance('immich'));
    expect(result).toMatchObject({ photos: 7200, videos: 240 }); expect(result).not.toHaveProperty('users'); expect(result).not.toHaveProperty('libraryBytes');
    json.mockImplementation(async (_source, path) => { if (path === '/api/server/statistics') return immich.statistics; throw new ServiceError('widgets.error.http', 502, { status: 404 }); });
    const minimal = await collectImmichStats(instance('immich'));
    expect(minimal.photos).toBe(12400); expect(minimal).not.toHaveProperty('disk'); expect(minimal).not.toHaveProperty('added'); expect(minimal).not.toHaveProperty('albums');
  });
  it('retries older Immich timeline queries with their required size parameter', async () => {
    mockImmich(); const base = json.getMockImplementation()!;
    json.mockImplementation(async (source, path, options) => {
      if (path === '/api/timeline/buckets') throw new ServiceError('widgets.error.http', 502, { status: 400 });
      return base(source, path, options);
    });
    expect((await collectImmichStats(instance('immich'))).byYear).toEqual([{ year: 2024, count: 1000 }, { year: 2025, count: 840 }]);
    expect(json.mock.calls.some(([, path]) => path === '/api/timeline/buckets?size=MONTH')).toBe(true);
  });
  it('caps Immich daily search at five pages and years at twenty', async () => {
    mockImmich(); const base = json.getMockImplementation()!;
    json.mockImplementation(async (source, path, options) => path === '/api/search/metadata' ? { assets: { items: Array.from({ length: 1000 }, (_, i) => ({ id: `${objectPage(options)}-${i}`, createdAt: new Date().toISOString() })), nextPage: 'next' } } : base(source, path, options));
    const result = await collectImmichStats(instance('immich'));
    expect(result.added).toBeUndefined();
    expect(result.limited).toBeUndefined();
    expect(json.mock.calls.filter(([, path]) => path === '/api/search/metadata')).toHaveLength(5);
    const years = Array.from({ length: 40 }, (_, i) => ({ year: 1980 + i, count: 1 }));
    expect(toPhotoprismStats(instance('photoprism'), { count: { photos: 40 }, years }).byYear).toHaveLength(20);
  });
  it('reads PhotoPrism config only, with bearer auth', async () => {
    json.mockResolvedValue(prism);
    expect((await collectPhotoprismStats(instance('photoprism'))).photos).toBe(12400);
    expect(json).toHaveBeenCalledExactlyOnceWith(expect.anything(), '/api/v1/config', { headers: { Authorization: 'Bearer fake-token' } });
  });
  function piwigoLogin() { bytes.mockResolvedValue({ bytes: Buffer.from('{"stat":"ok","result":true}'), contentType: 'application/json', status: 200, headers: { 'set-cookie': ['pwg_id=fake-session; HttpOnly; Path=/'] } }); }
  it('caches Piwigo cookie login and retries an expired session once', async () => {
    piwigoLogin(); json.mockResolvedValue(piwigo);
    expect((await collectPiwigoStats(instance('piwigo'))).items).toBe(12400);
    await collectPiwigoStats(instance('piwigo')); expect(bytes).toHaveBeenCalledTimes(1);
    expect(bytes.mock.calls[0][1]).toContain('pwg.session.login'); expect(bytes.mock.calls[0][2]?.body).toContain('password=fake-password');
    expect(json.mock.calls[0][2]?.headers).toEqual({ Cookie: 'pwg_id=fake-session' });
    json.mockResolvedValueOnce({ stat: 'fail', err: 401 }).mockResolvedValue(piwigo);
    await collectPiwigoStats(instance('piwigo')); expect(bytes).toHaveBeenCalledTimes(2);
  });
  it('rejects a failed Piwigo login before fetching stats', async () => {
    bytes.mockResolvedValue({ bytes: Buffer.from('{"stat":"fail","err":999}'), contentType: 'application/json', status: 200 });
    await expect(collectPiwigoStats(instance('piwigo'))).rejects.toThrow('integrations.error.authentication'); expect(json).not.toHaveBeenCalled();
  });
  it('obtains and caches LibrePhotos JWTs, then refreshes on expiry', async () => {
    const access = 'a'.repeat(1024);
    json.mockImplementation(async (_source, path) => path.includes('obtain') ? { access, refresh: 'fake-refresh' } : path.includes('refresh') ? { access: 'new-access' } : path.includes('photomonthcounts') ? libre.months : libre.stats);
    const source = instance('librephotos');
    expect((await collectLibrephotosStats(source)).byYear).toHaveLength(2);
    await collectLibrephotosStats(source);
    expect(json.mock.calls.filter(([, path]) => path.includes('obtain'))).toHaveLength(1);
    expect(json.mock.calls.find(([, path]) => path === '/api/stats/')?.[2]?.headers).toEqual({ Authorization: `Bearer ${access}` });
    const base = json.getMockImplementation()!; let expired = true;
    json.mockImplementation(async (source, path, options) => { if (path === '/api/stats/' && expired) { expired = false; throw new ServiceError('integrations.error.authentication', 502, { status: 401 }); } return base(source, path, options); });
    await librephotosRequest(source, '/api/stats/');
    expect(json.mock.calls.find(([, path]) => path.includes('refresh'))?.[2]?.body).toBe(JSON.stringify({ refresh: 'fake-refresh' }));
    expect(json.mock.calls.at(-1)?.[2]?.headers).toEqual({ Authorization: 'Bearer new-access' });
  });
});
function objectPage(options: Parameters<typeof serviceJson>[2]) { return (options?.json as { page?: number })?.page; }

describe('Immich scoped API keys', () => {
  it('shows what a key without statistics access may read, flagged as partial', async () => {
    const json = vi.mocked(serviceJson);
    json.mockImplementation(async (_instance, path) => {
      if (path === '/api/albums' || path === '/api/albums?shared=true') return [{ id: 'a1' }];
      if (String(path).startsWith('/api/timeline/buckets')) return [{ timeBucket: '2026-10-01', count: 35 }, { timeBucket: '2025-09-01', count: 15 }];
      throw new ServiceError('integrations.error.authentication', 502, { status: 403 });
    });
    const result = await collectImmichStats({ id: 'immich-1', type: 'immich', name: 'Fictional photos', settings: { url: 'https://photos.example.com' }, secrets: { apiKey: 'fictional-key' } } as IntegrationInstance);
    expect(result).toMatchObject({ limited: true, items: 50, albums: 1 });
    expect(result.photos).toBeUndefined();
  });
});

it('uses Immich cursor pagination when provided, without mixing page and cursor', async () => {
  let reads = 0;
  json.mockImplementation(async (_source, path, options) => {
    if (path === '/api/server/statistics') return immich.statistics;
    if (path !== '/api/search/metadata') throw new ServiceError('widgets.error.http');
    const query = options?.json as { cursor?: string; page?: number };
    reads++;
    if (reads === 1) return { assets: { items: Array.from({ length: 1000 }, (_, n) => ({ id: `p-${n}`, createdAt: new Date().toISOString() })), nextCursor: 'fixture-cursor', nextPage: null } };
    expect(query).toMatchObject({ cursor: 'fixture-cursor' }); expect(query.page).toBeUndefined();
    return { assets: { items: [], nextCursor: null, nextPage: null } };
  });
  const result = await collectImmichStats(instance('immich'));
  expect(reads).toBe(2); expect(result.limited).toBeUndefined();
});
