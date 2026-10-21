import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { IntegrationInstance } from '@/lib/types';
const state = vi.hoisted(() => ({ demo: false, role: 'admin' as 'admin' | 'viewer' | null, visible: true, type: 'photos-stats', settings: {} as Record<string, unknown>, instances: [] as IntegrationInstance[] }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ settings: {}, integrations: state.instances }) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
vi.mock('@/lib/access', () => ({ resolveAccessPrincipal: () => state.role ? { role: state.role } : null }));
vi.mock('@/lib/pages/store', () => ({ readPagesDocument: () => ({}), pagesForViewer: () => state.visible ? [{ widgets: [{ id: 'photo-stats', type: state.type, settings: state.settings }] }] : [] }));
vi.mock('@/integrations/immich/stats', () => ({ collectImmichStats: vi.fn() }));
vi.mock('@/integrations/photoprism/stats', () => ({ collectPhotoprismStats: vi.fn() }));
vi.mock('@/integrations/piwigo/collect', () => ({ collectPiwigoStats: vi.fn() }));
vi.mock('@/integrations/librephotos/collect', () => ({ collectLibrephotosStats: vi.fn() }));
import { GET } from './photos/stats/route';
import { collectImmichStats } from '@/integrations/immich/stats';
import { collectPhotoprismStats } from '@/integrations/photoprism/stats';
import { collectPiwigoStats } from '@/integrations/piwigo/collect';
import { collectLibrephotosStats } from '@/integrations/librephotos/collect';
import { demoPhotoStats } from '@/lib/widgetData/photoStatsDemo';
import { PHOTO_STATS_TYPES } from '@/lib/widgetData/contracts';
import { ServiceError } from '@/lib/widgetData/services';
const collectors = [collectImmichStats, collectPhotoprismStats, collectPiwigoStats, collectLibrephotosStats];
let serial = 0;
const request = (query = 'widgetId=photo-stats') => new NextRequest(`http://nasdash.example.com/api/widgets/photos/stats?${query}`);
beforeEach(() => {
  vi.resetAllMocks(); state.demo = false; state.role = 'admin'; state.visible = true; state.type = 'photos-stats'; state.settings = {};
  state.instances = PHOTO_STATS_TYPES.map(type => ({ id: `${type}-${++serial}`, type, name: 'Fictional Library', settings: { url: 'https://photos.example.com', username: 'private-account' }, secrets: { password: 'fake-password', apiKey: 'fake-key' } }));
  collectors.forEach((collect, i) => vi.mocked(collect).mockResolvedValue(demoPhotoStats(state.instances[i])));
});
describe('photo stats route', () => {
  it.each(PHOTO_STATS_TYPES)('selects the saved %s connection', async type => {
    const index = PHOTO_STATS_TYPES.indexOf(type); state.settings = { integrationId: state.instances[index].id };
    const response = await GET(request());
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect((await response.json()).provider).toBe(type); expect(collectors[index]).toHaveBeenCalledExactlyOnceWith(state.instances[index]);
  });
  it('defaults to the first compatible instance and caches ten minutes per credential identity', async () => {
    vi.useFakeTimers();
    try {
      state.instances.unshift({ id: 'wrong', type: 'jellyfin', name: 'Fictional', settings: {} });
      await GET(request()); await GET(request()); expect(collectImmichStats).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(599999); await GET(request()); expect(collectImmichStats).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1); await GET(request()); expect(collectImmichStats).toHaveBeenCalledTimes(2);
      state.instances[1].secrets = { apiKey: 'different-fake-key' }; await GET(request()); expect(collectImmichStats).toHaveBeenCalledTimes(3);
    } finally { vi.useRealTimers(); }
  });
  it.each(['admin', 'viewer'] as const)('strips account names unless explicitly enabled, for %s, without mutating the cache', async role => {
    state.role = role;
    for (const showUsers of [undefined, false, null, true, false]) {
      state.settings = { showUsers };
      const data = await (await GET(request())).json();
      expect(data.users[0].photos).toBe(7200);
      expect(data.users[0].name).toBe(showUsers === true ? 'Alex' : undefined);
      expect(JSON.stringify(data)).not.toMatch(/photos\.example|private-account|fake-key|fake-password/);
    }
    expect(collectImmichStats).toHaveBeenCalledTimes(1);
  });
  it.each([{ integrationId: '' }, { integrationId: 42 }, { integrationId: false }, { showUsers: 'true' }, { showUsers: 1 }])('validates settings %j before any upstream read', async settings => {
    state.settings = settings; expect((await GET(request())).status).toBe(400); collectors.forEach(collect => expect(collect).not.toHaveBeenCalled());
  });
  it('treats null selection as absent, and rejects missing/wrong-type connections', async () => {
    state.settings = { integrationId: null }; expect((await GET(request())).status).toBe(200);
    state.settings = { integrationId: 'unknown' }; expect((await GET(request())).status).toBe(404);
    state.instances.push({ id: 'wrong', type: 'jellyfin', name: 'Fictional', settings: {} }); state.settings = { integrationId: 'wrong' };
    expect((await GET(request())).status).toBe(404);
  });
  it('validates widget ids, visibility, type, authentication and draft size', async () => {
    expect((await GET(request(''))).status).toBe(400); expect((await GET(request('widgetId=../bad'))).status).toBe(400);
    state.visible = false; expect((await GET(request())).status).toBe(404);
    state.visible = true; state.type = 'photos'; expect((await GET(request())).status).toBe(404);
    state.role = null; expect((await GET(request())).status).toBe(401);
    state.role = 'admin'; expect((await GET(request('widgetId=photo-stats&draft=bad-json'))).status).toBe(400);
    expect((await GET(request(`widgetId=photo-stats&draft=${'x'.repeat(16385)}`))).status).toBe(400);
    collectors.forEach(collect => expect(collect).not.toHaveBeenCalled());
  });
  it('allows admin draft previews while ignoring viewer drafts', async () => {
    const draft = encodeURIComponent(JSON.stringify({ integrationId: state.instances[1].id, showUsers: true }));
    expect((await (await GET(request(`widgetId=photo-stats&draft=${draft}`))).json()).provider).toBe('photoprism');
    state.role = 'viewer'; const data = await (await GET(request(`widgetId=photo-stats&draft=${draft}`))).json();
    expect(data.provider).toBe('immich'); expect(data.users[0]).not.toHaveProperty('name');
  });
  it.each(PHOTO_STATS_TYPES)('serves all fictional fields without network for %s demos', async type => {
    state.demo = true; state.settings = { integrationId: state.instances.find(instance => instance.type === type)!.id, showUsers: true };
    const data = await (await GET(request())).json();
    for (const key of ['photos', 'videos', 'albums', 'people', 'places', 'favorites', 'libraryBytes', 'disk', 'byYear', 'added', 'users', 'fetchedAt']) expect(data).toHaveProperty(key);
    expect(data.added).toHaveLength(30); expect(data.users[0].name).toBe('Alex'); collectors.forEach(collect => expect(collect).not.toHaveBeenCalled());
  });
  it('accepts visitor-local demo instances and keeps errors private/no-store', async () => {
    state.demo = true; state.settings = { integrationId: 'librephotos-visitor' };
    expect((await (await GET(request())).json()).provider).toBe('librephotos');
    state.demo = false; state.settings = {};
    vi.mocked(collectImmichStats).mockRejectedValue(new ServiceError('widgets.error.timeout', 504));
    const response = await GET(request()); expect(response.status).toBe(504); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ error: 'widgets.error.timeout' });
  });
});
