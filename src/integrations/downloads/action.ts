import type { IntegrationInstance } from '@/lib/types';
import type { DownloadActionRequest, DownloadClientType } from '@/lib/widgetData/contracts';
import { array, object, string, ServiceError } from '@/lib/widgetData/services';
import { qbittorrentRequest, qbittorrentResponse, qbittorrentState } from '../qbittorrent/collect';
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
      if (itemId === undefined) {
        // qBittorrent 5.2+ pauses the whole session and leaves each torrent as it was; older releases stop them all.
        if (pause) { if (!await qbittorrentSession(instance, 'pauseSession')) await qbittorrentTorrents(instance, false, 'all'); break; }
        // Resume clears a session pause, and starts the torrents when they were all stopped (older releases, or
        // stopped one by one): the client then read as paused, and its button offered to resume all.
        await qbittorrentSession(instance, 'resumeSession');
        const rows = array(await qbittorrentRequest(instance, '/api/v2/torrents/info'));
        if (rows.length && rows.every(raw => qbittorrentState(object(raw).state) === 'paused')) await qbittorrentTorrents(instance, true, 'all');
        break;
      }
      await qbittorrentTorrents(instance, !pause, itemId);
      break;
    }
    case 'transmission':
      await transmissionRequest(instance, pause ? 'torrent-stop' : 'torrent-start', itemId === undefined ? {} : { ids: [Number(itemId)] });
      break;
    case 'deluge': {
      // The whole client goes torrent by torrent, like Transmission: each one then shows as paused, and resuming
      // all also lifts a session pause left by an earlier release.
      const ids = itemId === undefined ? array(await delugeRequest(instance, 'core.get_session_state')).map(string).filter(id => validDownloadItemId('deluge', id)) : [itemId];
      if (itemId === undefined && !pause) await delugeRequest(instance, 'core.resume_session', []);
      if (ids.length) await delugeRequest(instance, `core.${pause ? 'pause' : 'resume'}_torrent`, [ids]);
      break;
    }
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

const form = (values: Record<string, string>) => ({ method: 'POST' as const, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values).toString() });
const missing = (error: unknown) => error instanceof ServiceError && error.parameters?.status === 404;
/** qBittorrent 5 names them start/stop; 4.x answers 404 there and uses resume/pause. */
async function qbittorrentTorrents(instance: IntegrationInstance, start: boolean, hashes: string) {
  try { await qbittorrentResponse(instance, `/api/v2/torrents/${start ? 'start' : 'stop'}`, form({ hashes })); }
  catch (error) {
    if (!missing(error)) throw error;
    await qbittorrentResponse(instance, `/api/v2/torrents/${start ? 'resume' : 'pause'}`, form({ hashes }));
  }
}
/** False when this qBittorrent has no session pause (before 5.2). */
async function qbittorrentSession(instance: IntegrationInstance, action: 'pauseSession' | 'resumeSession'): Promise<boolean> {
  try { await qbittorrentResponse(instance, `/api/v2/transfer/${action}`, form({})); return true; }
  catch (error) { if (missing(error)) return false; throw error; }
}
