import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
import type { DownloadClientType } from '@/lib/widgetData/contracts';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
vi.mock('../qbittorrent/collect', () => ({ qbittorrentRequest: vi.fn() }));
vi.mock('../transmission/collect', () => ({ transmissionRequest: vi.fn() }));
vi.mock('../deluge/collect', () => ({ delugeRequest: vi.fn() }));
vi.mock('../sabnzbd/collect', () => ({ sabnzbdRequest: vi.fn() }));
vi.mock('../nzbget/collect', () => ({ nzbgetRequest: vi.fn() }));
import { qbittorrentRequest } from '../qbittorrent/collect';
import { transmissionRequest } from '../transmission/collect';
import { delugeRequest } from '../deluge/collect';
import { sabnzbdRequest } from '../sabnzbd/collect';
import { nzbgetRequest } from '../nzbget/collect';
import { findQueueDownload, lookupDownloadId, queueClientCandidates, invalidateDownloadLookup } from './lookup';

const hash = 'abcdef0123'.repeat(4), other = '0'.repeat(40);
let serial = 0;
const source = (type: DownloadClientType, name: string = type): IntegrationInstance => ({ id: `lookup-${++serial}`, type, name, settings: { url: 'https://downloads.example.com' } });
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); });
afterEach(() => vi.useRealTimers());

describe('queue download ownership and native ids', () => {
  it('maps an uppercase qBittorrent hash to lowercase, verifying the returned hash', async () => {
    const instance = source('qbittorrent');
    vi.mocked(qbittorrentRequest).mockResolvedValue([{ hash }]);
    expect(await lookupDownloadId(instance, hash.toUpperCase())).toBe(hash);
    expect(qbittorrentRequest).toHaveBeenCalledWith(instance, `/api/v2/torrents/info?hashes=${hash}`);
    vi.mocked(qbittorrentRequest).mockResolvedValue([{ hash: other }]);
    expect(await lookupDownloadId(source('qbittorrent'), hash)).toBeNull();
  });
  it('looks up a Transmission hash and returns its numeric control id', async () => {
    const instance = source('transmission');
    vi.mocked(transmissionRequest).mockResolvedValue({ torrents: [{ id: 71, hashString: hash.toUpperCase() }] });
    expect(await lookupDownloadId(instance, hash.toUpperCase())).toBe('71');
    expect(transmissionRequest).toHaveBeenCalledWith(instance, 'torrent-get', { ids: [hash], fields: ['id', 'hashString'] });
    vi.mocked(transmissionRequest).mockResolvedValue({ torrents: [{ id: 71, hashString: other }] });
    expect(await lookupDownloadId(source('transmission'), hash)).toBeNull();
    vi.mocked(transmissionRequest).mockResolvedValue({ torrents: [{ id: 'unsafe', hashString: hash }] });
    expect(await lookupDownloadId(source('transmission'), hash)).toBeNull();
  });
  it('maps a Deluge hash to lowercase, without trusting an unrelated torrent', async () => {
    const instance = source('deluge');
    vi.mocked(delugeRequest).mockResolvedValue([hash]);
    expect(await lookupDownloadId(instance, hash.toUpperCase())).toBe(hash);
    expect(delugeRequest).toHaveBeenCalledWith(instance, 'core.get_session_state');
    vi.mocked(delugeRequest).mockResolvedValue([other]);
    expect(await lookupDownloadId(source('deluge'), hash)).toBeNull();
  });
  it('preserves SABnzbd nzo_id and filters by id rather than job name', async () => {
    const instance = source('sabnzbd');
    vi.mocked(sabnzbdRequest).mockResolvedValue({ queue: { slots: [{ nzo_id: 'SABnzbd_nzo_71' }] } });
    expect(await lookupDownloadId(instance, 'SABnzbd_nzo_71')).toBe('SABnzbd_nzo_71');
    expect(sabnzbdRequest).toHaveBeenCalledWith(instance, 'queue', { nzo_ids: 'SABnzbd_nzo_71', start: '0', limit: '1' });
    expect(await lookupDownloadId(instance, 'SABnzbd_nzo_72')).toBeNull();
  });
  it('maps NZBGet NZBID to its numeric control id beyond the displayed items', async () => {
    const instance = source('nzbget');
    vi.mocked(nzbgetRequest).mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({ NZBID: i + 1 })));
    expect(await lookupDownloadId(instance, '20')).toBe('20');
    expect(await lookupDownloadId(instance, '71')).toBeNull();
  });
  it.each<DownloadClientType>(['qbittorrent', 'transmission', 'deluge', 'sabnzbd', 'nzbget'])('rejects invalid upstream %s ids without a request', async type => {
    const instance = source(type);
    for (const id of ['', '../private', 'x&action=pause']) expect(await lookupDownloadId(instance, id)).toBeNull();
    for (const fn of [qbittorrentRequest, transmissionRequest, delugeRequest, sabnzbdRequest, nzbgetRequest]) expect(fn).not.toHaveBeenCalled();
  });
  it('shares concurrent lookups, caches misses briefly and supports invalidation', async () => {
    const instance = source('qbittorrent');
    vi.mocked(qbittorrentRequest).mockResolvedValue([]);
    expect(await Promise.all([lookupDownloadId(instance, hash), lookupDownloadId(instance, hash)])).toEqual([null, null]);
    expect(qbittorrentRequest).toHaveBeenCalledTimes(1);
    vi.mocked(qbittorrentRequest).mockResolvedValue([{ hash }]);
    expect(await lookupDownloadId(instance, hash)).toBeNull();
    vi.setSystemTime(Date.now() + 3001);
    expect(await lookupDownloadId(instance, hash)).toBe(hash);
    invalidateDownloadLookup(instance, hash);
    await lookupDownloadId(instance, hash);
    expect(qbittorrentRequest).toHaveBeenCalledTimes(3);
  });
  it('prioritizes matching connection names and kinds, then searches protocol peers despite failures', async () => {
    const unrelated = source('qbittorrent'), matching = source('qbittorrent', 'Main qBittorrent'), transmission = source('transmission'), usenet = source('sabnzbd');
    const download = { downloadId: hash.toUpperCase(), protocol: 'torrent' as const, clientName: 'Main qBittorrent' };
    expect(queueClientCandidates([transmission, unrelated, usenet, matching], download)).toEqual([matching, unrelated, transmission]);
    vi.mocked(qbittorrentRequest).mockRejectedValue(new Error('unavailable'));
    vi.mocked(transmissionRequest).mockResolvedValue({ torrents: [{ id: 71, hashString: hash }] });
    expect(await findQueueDownload([matching, transmission, usenet], download)).toEqual({ instance: transmission, itemId: '71' });
    expect(sabnzbdRequest).not.toHaveBeenCalled();
  });
  it('returns a clear 404 when no saved client owns the id', async () => {
    vi.mocked(qbittorrentRequest).mockResolvedValue([]);
    const download = { downloadId: hash, protocol: 'torrent' as const, clientName: 'qBittorrent' };
    for (const saved of [[], [source('sabnzbd')], [source('qbittorrent')]]) {
      await expect(findQueueDownload(saved, download)).rejects.toMatchObject({ key: 'widgets.error.noDownloadClient', status: 404 });
    }
  });
  it('bounds ownership lookup concurrency to four clients', async () => {
    let release!: () => void;
    const gate = new Promise<unknown>(resolve => { release = () => resolve([]); });
    vi.mocked(qbittorrentRequest).mockReturnValue(gate);
    const pending = findQueueDownload(Array.from({ length: 9 }, () => source('qbittorrent')), { downloadId: hash, protocol: 'torrent', clientName: '' });
    const rejected = expect(pending).rejects.toMatchObject({ status: 404 });
    expect(qbittorrentRequest).toHaveBeenCalledTimes(4);
    release(); await rejected;
    expect(qbittorrentRequest).toHaveBeenCalledTimes(9);
  });
});
