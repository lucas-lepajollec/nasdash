/** Resolve *arr ids against the client's queue, independently of the ten displayed status items. */
import type { IntegrationInstance } from '@/lib/types';
import { DOWNLOAD_CLIENT_TYPES, type DownloadClientType } from '@/lib/widgetData/contracts';
import { TtlCache } from '@/lib/widgetData/cache';
import { array, object, string, serviceIdentity, ServiceError } from '@/lib/widgetData/services';
import type { ArrQueueDownload } from '../arr/collect';
import { validDownloadItemId } from './action';
import { qbittorrentRequest } from '../qbittorrent/collect';
import { transmissionRequest } from '../transmission/collect';
import { delugeRequest } from '../deluge/collect';
import { sabnzbdRequest } from '../sabnzbd/collect';
import { nzbgetRequest } from '../nzbget/collect';

const lookups = new TtlCache<string | null>(3000, 1000);
const normalized = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const torrent = (type: string) => ['qbittorrent', 'transmission', 'deluge'].includes(type);

/** Protocol is the cheap eligibility check; names/kinds prioritize the exact ownership lookup. */
export function queueClientCandidates(saved: IntegrationInstance[], download: ArrQueueDownload): IntegrationInstance[] {
  const name = normalized(download.clientName);
  const rank = (instance: IntegrationInstance) => normalized(instance.name) === name ? 0 : name.includes(instance.type) ? 1 : 2;
  return saved.filter(instance => (DOWNLOAD_CLIENT_TYPES as readonly string[]).includes(instance.type) && torrent(instance.type) === (download.protocol === 'torrent'))
    .sort((a, b) => rank(a) - rank(b));
}

async function lookup(instance: IntegrationInstance, downloadId: string): Promise<string | null> {
  const type = instance.type as DownloadClientType;
  const hash = downloadId.toLowerCase();
  // Transmission uses the hash for lookup, but requires its numeric id for control.
  if (type === 'transmission') {
    if (!validDownloadItemId('qbittorrent', hash)) return null;
    const body = object(await transmissionRequest(instance, 'torrent-get', { ids: [hash], fields: ['id', 'hashString'] }));
    const row = array(body.torrents).map(object).find(item => string(item.hashString).toLowerCase() === hash);
    const id = row ? String(row.id) : '';
    return validDownloadItemId(type, id) ? id : null;
  }
  const id = torrent(type) ? hash : downloadId;
  if (!validDownloadItemId(type, id)) return null;
  switch (type) {
    case 'qbittorrent': {
      const rows = await qbittorrentRequest(instance, `/api/v2/torrents/info?hashes=${encodeURIComponent(id)}`);
      return array(rows).some(raw => string(object(raw).hash).toLowerCase() === id) ? id : null;
    }
    case 'deluge': {
      // An id-filtered status can echo an absent id with an empty status. The session list proves ownership.
      const ids = await delugeRequest(instance, 'core.get_session_state');
      return array(ids).some(value => string(value).toLowerCase() === id) ? id : null;
    }
    case 'sabnzbd': {
      const body = object(await sabnzbdRequest(instance, 'queue', { nzo_ids: id, start: '0', limit: '1' }));
      return array(object(body.queue).slots).some(raw => object(raw).nzo_id === id) ? id : null;
    }
    case 'nzbget': {
      const rows = await nzbgetRequest(instance, 'listgroups');
      const row = array(rows).map(object).find(item => String(item.NZBID) === id);
      return row ? String(row.NZBID) : null;
    }
  }
}

export const lookupDownloadId = (instance: IntegrationInstance, downloadId: string) =>
  lookups.get(JSON.stringify([serviceIdentity(instance), downloadId]), () => lookup(instance, downloadId));
export const invalidateDownloadLookup = (instance: IntegrationInstance, downloadId: string) =>
  lookups.delete(JSON.stringify([serviceIdentity(instance), downloadId]));

export async function findQueueDownload(saved: IntegrationInstance[], download: ArrQueueDownload): Promise<{ instance: IntegrationInstance; itemId: string }> {
  const candidates = queueClientCandidates(saved, download);
  // Bounded concurrency, including when many clients are saved. A failed client must not hide a later match.
  for (let offset = 0; offset < candidates.length; offset += 4) {
    const batch = candidates.slice(offset, offset + 4);
    const results = await Promise.allSettled(batch.map(instance => lookupDownloadId(instance, download.downloadId)));
    for (const [i, result] of results.entries()) {
      if (result.status === 'fulfilled' && result.value) return { instance: batch[i], itemId: result.value };
    }
  }
  throw new ServiceError('widgets.error.noDownloadClient', 404);
}
