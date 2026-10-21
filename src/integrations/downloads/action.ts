import type { IntegrationInstance } from '@/lib/types';
import type { DownloadActionRequest, DownloadClientType } from '@/lib/widgetData/contracts';
import { ServiceError } from '@/lib/widgetData/services';
import { qbittorrentResponse } from '../qbittorrent/collect';
import { transmissionRequest } from '../transmission/collect';
import { delugeRequest } from '../deluge/collect';
import { sabnzbdRequest } from '../sabnzbd/collect';
import { nzbgetRequest } from '../nzbget/collect';

export function validDownloadItemId(type: DownloadClientType, id: unknown): id is string {
  if (typeof id !== 'string') return false;
  if (type === 'qbittorrent' || type === 'deluge') return /^[a-f0-9]{40}$/i.test(id);
  if (type === 'sabnzbd') return /^[A-Za-z0-9_]{1,128}$/.test(id);
  return /^\d{1,16}$/.test(id) && Number.isSafeInteger(Number(id));
}

/** Only validated native ids reach the existing authenticated client transports. */
export async function controlDownloadClient(instance: IntegrationInstance, action: DownloadActionRequest['action'], itemId?: string): Promise<void> {
  const pause = action === 'pause';
  switch (instance.type) {
    case 'qbittorrent': {
      const options = { method: 'POST' as const, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ hashes: itemId ?? 'all' }).toString() };
      try { await qbittorrentResponse(instance, `/api/v2/torrents/${pause ? 'stop' : 'start'}`, options); }
      catch (error) {
        if (!(error instanceof ServiceError) || error.parameters?.status !== 404) throw error;
        await qbittorrentResponse(instance, `/api/v2/torrents/${pause ? 'pause' : 'resume'}`, options);
      }
      break;
    }
    case 'transmission':
      await transmissionRequest(instance, pause ? 'torrent-stop' : 'torrent-start', itemId === undefined ? {} : { ids: [Number(itemId)] });
      break;
    case 'deluge':
      await delugeRequest(instance, itemId === undefined ? `core.${pause ? 'pause' : 'resume'}_session` : `core.${pause ? 'pause' : 'resume'}_torrent`, itemId === undefined ? [] : [[itemId]]);
      break;
    case 'sabnzbd': {
      const answer = await sabnzbdRequest(instance, itemId === undefined ? action : 'queue', itemId === undefined ? {} : { name: action, value: itemId });
      if (!answer || typeof answer !== 'object' || !('status' in answer) || answer.status !== true) throw new ServiceError('widgets.error.http');
      break;
    }
    case 'nzbget':
      if (await nzbgetRequest(instance, itemId === undefined ? pause ? 'pausedownload' : 'resumedownload' : 'editqueue', itemId === undefined ? [] : [pause ? 'GroupPause' : 'GroupResume', '', [Number(itemId)]]) !== true) throw new ServiceError('widgets.error.http');
      break;
    default: throw new ServiceError('widgets.error.invalidRequest', 400);
  }
}
