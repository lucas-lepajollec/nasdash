import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
import sonarr from './sonarr/samples/service.json';
import radarr from './radarr/samples/service.json';
import lidarr from './lidarr/samples/service.json';
import prowlarr from './prowlarr/samples/service.json';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn() }));
import { serviceJson, ServiceError } from '@/lib/widgetData/services';
import { arrImage, collectArrRecent, toArrRecent, prowlarrActivity, collectArrUpcoming, collectArrQueue, collectArrStatus, collectProwlarrIndexers, etaMs, queueStatus, radarrRelease, safeArrMessage, toArrQueue, toArrUpcoming, toProwlarrIndexers } from './arr/collect';
const instance = (type: string): IntegrationInstance => ({ id: `${type}-fictional`, type, name: `Fictional ${type}`, settings: { url: `http://${type}.example.com` }, secrets: { apiKey: 'fictional-key' } });
const start = Date.parse('2026-10-21T00:00:00Z'), end = start + 14 * 86400000;
const json = vi.mocked(serviceJson);
beforeEach(() => vi.resetAllMocks());

describe('*arr calendars', () => {
  it('maps episode/album parents, identity, artwork, files and administrator links', () => {
    const episode = toArrUpcoming(instance('sonarr'), sonarr.calendar, start, end)[0];
    expect(episode).toMatchObject({ id: 'sonarr-fictional:101', sourceName: 'Fictional sonarr', kind: 'episode', season: 2, episode: 3, subtitle: 'The Weather Cartographers', hasFile: false,
      poster: '/api/v3/mediacover/12/poster.jpg?lastWrite=123', backdrop: '/api/v3/mediacover/12/fanart.jpg?lastWrite=123', link: 'http://sonarr.example.com/series/weather-cartographers' });
    expect(toArrUpcoming(instance('lidarr'), lidarr.calendar, start, end)[0]).toMatchObject({ kind: 'album', hasFile: true, subtitle: 'The Velvet Compasses', poster: '/api/v1/mediacover/12/poster.jpg?lastWrite=123', link: 'http://lidarr.example.com/artist/fictional-artist' });
    expect(toArrUpcoming(instance('radarr'), radarr.calendar, start, end)[0]).toMatchObject({ at: Date.parse(radarr.calendar[0].digitalRelease), release: 'digital', link: 'http://radarr.example.com/movie/424242' });
  });
  it('chooses the earliest movie release in the window with stable ties', () => {
    const item = radarr.calendar[0];
    expect(radarrRelease(item, Date.parse('2026-10-19'), end)?.release).toBe('cinema');
    expect(radarrRelease(item, Date.parse('2026-10-24'), end)?.release).toBe('physical');
    expect(radarrRelease({ ...item, digitalRelease: item.physicalRelease }, start, end)?.release).toBe('digital');
    expect(radarrRelease(item, Date.parse('2027-01-01'), Date.parse('2027-02-01'))).toBeUndefined();
    expect(toArrUpcoming(instance('radarr'), [item], 0, 100)).toEqual([]);
  });
  it.each(['//other.example.com/unrelated.jpg', '/api/v3/system/status', '/MediaCover/../secrets', '/MediaCover/12/%2e%2e', '/MediaCover/12/poster.jpg?apikey=secret', 'file:///etc/passwd', '/MediaCover/12/a\\b.jpg'])('ignores unsafe or unrelated artwork %s', url => {
    expect(arrImage(instance('sonarr'), [{ coverType: 'poster', url }], 'poster')).toBeUndefined();
  });
  it.each([['sonarr', '/api/v3', 'includeSeries'], ['radarr', '/api/v3', 'unmonitored'], ['lidarr', '/api/v1', 'includeArtist']])('requests the %s calendar with header-only authentication', async (type, prefix, include) => {
    json.mockResolvedValue([]);
    await collectArrUpcoming(instance(type), start, end);
    const [, path, options] = json.mock.calls[0];
    const url = new URL(path, 'http://fixture.invalid');
    expect(url.pathname).toBe(`${prefix}/calendar`); expect(url.searchParams.has(include)).toBe(true);
    expect(url.searchParams.get('start')).toBe(new Date(start).toISOString()); expect(url.searchParams.get('end')).toBe(new Date(end).toISOString());
    expect(path).not.toContain('fictional-key'); expect(options?.headers).toEqual({ 'X-Api-Key': 'fictional-key' });
    if (type !== 'lidarr') expect(url.searchParams.get('unmonitored')).toBe('false');
  });
});

describe('*arr queues', () => {
  it.each([
    ['downloading', 'downloading'], ['paused', 'paused'], ['queued', 'queued'], ['delay', 'queued'], ['completed', 'completed'], ['importPending', 'importing'], ['importing', 'importing'], ['warning', 'warning'], ['failed', 'failed'],
  ])('maps %s from every status field', (upstream, mapped) => {
    for (const field of ['status', 'trackedDownloadState', 'trackedDownloadStatus']) expect(queueStatus({ [field]: upstream })).toBe(mapped);
  });
  it('maps sizes, bounded progress, eta, quality, client and path-free messages', () => {
    const result = toArrQueue(instance('sonarr'), sonarr.queue);
    expect(result.total).toBe(8); expect(result.items[0]).toMatchObject({ title: 'A Lantern for the Tide', subtitle: 'The Weather Cartographers', progress: 75, etaMs: 93784000, quality: '1080p', protocol: 'torrent', client: 'Fictional downloads', message: 'Unable to import until ready' });
    expect(toArrQueue(instance('radarr'), radarr.queue).items[0].poster).toContain('/api/v3/mediacover');
    expect(toArrQueue(instance('lidarr'), lidarr.queue).items[0]).toMatchObject({ kind: 'album', subtitle: 'The Velvet Compasses', quality: 'FLAC' });
    for (const [size, sizeleft, expected] of [[0, 0, 0], [10, 20, 0], [10, -10, 100]]) {
      expect(toArrQueue(instance('sonarr'), { records: [{ size, sizeleft }] }).items[0].progress).toBe(expected);
    }
    expect(safeArrMessage('Bad C:\\Downloads\\secret.mkv and \\\\server\\share\\file plus https://private.example.com/path')).toBe('Bad and plus');
    expect(safeArrMessage("Cannot import '/downloads/The Glass Orchard/file.mkv' or relative/folder/file.mkv until ready")).toBe('Cannot import or until ready');
    expect(safeArrMessage('a'.repeat(300))).toHaveLength(160);
  });
  it('parses both duration formats, completion dates and missing/invalid values', () => {
    expect(etaMs('02:03:04')).toBe(7384000); expect(etaMs('1.02:03:04')).toBe(93784000);
    expect(etaMs('bad', '2026-10-21T00:01:00Z', start)).toBe(60000);
    expect(etaMs(null, '2026-10-20T00:00:00Z', start)).toBe(0);
    expect(etaMs('00:99:00')).toBeUndefined(); expect(etaMs('Unknown')).toBeUndefined();
  });
  it.each([['sonarr', '/api/v3', 'includeSeries=true&includeEpisode=true'], ['radarr', '/api/v3', 'includeMovie=true'], ['lidarr', '/api/v1', 'includeArtist=true&includeAlbum=true']])('requests the %s queue', async (type, prefix, include) => {
    json.mockResolvedValue({ records: [], totalRecords: 0 });
    await collectArrQueue(instance(type)); expect(json.mock.calls[0][1]).toBe(`${prefix}/queue?page=1&pageSize=50&${include}`);
  });
});

describe('*arr health and indexers', () => {
  it('maps healthy, failing and recovered indexers and totals', () => {
    const result = toProwlarrIndexers(instance('prowlarr'), prowlarr.indexers, prowlarr.statuses, prowlarr.stats, start);
    expect(result.indexers.map(item => [item.enabled, item.healthy])).toEqual([[true, true], [true, false], [false, true]]);
    expect(result.indexers[1]).toMatchObject({ retryAt: Date.parse('2026-10-25T10:00:00Z'), queries: 40, grabs: 6, failures: 3, averageMs: 240 });
    expect(result.totals).toEqual({ queries: 120, grabs: 18, failures: 3 });
  });
  it('reads the last 24 hours of Prowlarr stats', async () => {
    json.mockImplementation(async (_instance, path) => path.includes('/indexerstats?') ? prowlarr.stats : path.endsWith('/indexerstatus') ? prowlarr.statuses : prowlarr.indexers);
    const before = Date.now(); await collectProwlarrIndexers(instance('prowlarr'));
    const path = json.mock.calls.find(([, path]) => path.includes('/indexerstats?'))![1];
    expect(Date.parse(new URL(path, 'http://fixture').searchParams.get('startDate')!)).toBeGreaterThanOrEqual(before - 86400000);
  });
  it.each(['sonarr', 'radarr', 'lidarr', 'prowlarr'])('maps %s status and hides all failure details', async type => {
    json.mockImplementation(async (_instance, path) => path.endsWith('/system/status') ? sonarr.status : path.endsWith('/health') ? sonarr.health : path.endsWith('/queue/status') ? sonarr.queueStatus : path.includes('/wanted/missing') ? sonarr.missing : path.endsWith('/diskspace') ? sonarr.disks : path.endsWith('/indexerstatus') ? prowlarr.statuses : prowlarr.indexers);
    const app = await collectArrStatus(instance(type));
    expect(app).toMatchObject({ online: true, version: '4.0.0' });
    if (type === 'prowlarr') expect(app.indexers).toBe(2);
    else expect(app).toMatchObject({ queue: 8, missing: 12, freeBytes: 800000000000 });
    json.mockRejectedValue(new Error('http://private.example.com?apikey=secret'));
    expect(await collectArrStatus(instance(type))).toEqual({ id: `${type}-fictional`, name: `Fictional ${type}`, type, health: [], online: false });
  });
  it('rejects malformed payloads instead of showing an empty success', () => {
    expect(() => toArrUpcoming(instance('sonarr'), {}, start, end)).toThrow(ServiceError);
    expect(() => toArrQueue(instance('sonarr'), {})).toThrow(ServiceError);
    expect(() => toProwlarrIndexers(instance('prowlarr'), {}, [], {})).toThrow(ServiceError);
  });
});

describe('recent imports and search activity', () => {
  it.each([['sonarr', sonarr], ['radarr', radarr], ['lidarr', lidarr]])('maps %s import history with the correct API filter and local artwork', async (type, fixture) => {
    json.mockResolvedValue(fixture.history);
    const result = await collectArrRecent(instance(type));
    expect(result).toHaveLength(1); expect(result[0]).toMatchObject({ source: type, at: Date.parse('2026-10-20T22:00:00Z'), quality: type === 'lidarr' ? 'FLAC' : '1080p' });
    expect(result[0].poster).toContain('/mediacover/');
    expect(json.mock.calls[0][1]).toContain('page=1&pageSize=50&sortKey=date&sortDirection=descending&eventType=3');
    expect(json.mock.calls[0][2]?.headers).toEqual({ 'X-Api-Key': 'fictional-key' });
  });
  it('deduplicates Lidarr tracks into albums, ignores other events and bounds recent imports', () => {
    const row = lidarr.history.records[0];
    expect(toArrRecent(instance('lidarr'), { records: [row, { ...row, id: 802 }, { ...row, id: 803, eventType: 'grabbed' }] })).toHaveLength(1);
    const records = Array.from({ length: 12 }, (_, i) => ({ ...sonarr.history.records[0], id: i, seriesId: 100 + i, eventType: 3, date: new Date(start - i * 1000).toISOString() })).reverse();
    const result = toArrRecent(instance('sonarr'), { records }); expect(result).toHaveLength(6); expect(result[0].at).toBe(start);
    expect(toArrRecent(instance('sonarr'), { records: [{ ...records[0], date: 'bad' }] })).toEqual([]);
  });
  it('folds episodes of one series into its newest import, with how many and its local poster', () => {
    const base = { ...sonarr.history.records[0], seriesId: 58, series: { title: 'Fictional Series', images: [{ coverType: 'poster', remoteUrl: 'https://artworks.example.com/p.jpg' }] } };
    const records = [0, 1, 2].map(i => ({ ...base, id: i, date: new Date(start - i * 1000).toISOString() }));
    const [entry, ...rest] = toArrRecent(instance('sonarr'), { records });
    expect(rest).toEqual([]); expect(entry).toMatchObject({ count: 3, at: start, subtitle: 'Fictional Series' });
    expect(entry.poster).toMatch(/\/mediacover\/58\/poster\.jpg$/); expect(JSON.stringify(entry)).not.toContain('artworks.example.com');
  });
  it('buckets query and rss events, excludes grabs, old and future dates, and preserves latest time', () => {
    const result = prowlarrActivity(prowlarr.history, start);
    expect(result.hourly).toHaveLength(24); expect(result.hourly?.[0]).toBe(1); expect(result.hourly?.[23]).toBe(1);
    expect(result.hourly?.reduce((sum, n) => sum + n, 0)).toBe(2); expect(result.lastQueryAt).toBe(Date.parse('2026-10-20T23:30:00Z'));
    expect(prowlarrActivity({ records: [{ eventType: 2, date: new Date(start + 1).toISOString() }] }, start)).toEqual({ hourly: Array(24).fill(0) });
  });
  it('omits activity if the optional history endpoint fails', async () => {
    json.mockImplementation(async (_instance, path) => { if (path.includes('/history?')) throw new Error('denied'); return path.includes('/indexerstats?') ? prowlarr.stats : path.endsWith('/indexerstatus') ? prowlarr.statuses : prowlarr.indexers; });
    const result = await collectProwlarrIndexers(instance('prowlarr')); expect(result.indexers).toHaveLength(3); expect(result.hourly).toBeUndefined();
  });
});
