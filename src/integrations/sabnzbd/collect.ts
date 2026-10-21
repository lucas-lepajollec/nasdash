import type { IntegrationInstance } from '@/lib/types';
import { array, object, string, ServiceError } from '@/lib/widgetData/services';
import { clientJson, clientStatus, completedItems, numeric, optionalBytes, percent, type DownloadState } from '../downloads/shared';
import { etaMs } from '../arr/collect';
/** SABnzbd only supports query authentication; this URL is never returned or logged. */
export function sabnzbdRequest(instance: IntegrationInstance, mode: 'queue' | 'version' | 'history' | 'server_stats') {
  return clientJson(instance, `/api?${new URLSearchParams({ mode, output: 'json', apikey: instance.secrets?.apiKey ?? '', ...(mode === 'history' ? { limit: '5' } : {}) })}`);
}
export function sabnzbdState(value: unknown): DownloadState {
  const state = string(value).toLowerCase();
  if (/fail|error/.test(state)) return 'error';
  if (/paus/.test(state)) return 'paused';
  if (/check|verif|repair|extract|mov/.test(state)) return 'checking';
  if (/complet/.test(state)) return 'completed';
  if (/download|fetch/.test(state)) return 'downloading';
  return 'queued';
}
export function toSabnzbd(instance: IntegrationInstance, value: unknown, stats?: unknown, history?: unknown) {
  const queue = object(object(value).queue);
  if (!Array.isArray(queue.slots)) throw new ServiceError('widgets.error.parse');
  const paused = queue.paused === true || queue.status === 'Paused';
  const slots = object(object(history).history).slots;
  return clientStatus(instance, array(queue.slots).map(raw => { const item = object(raw); return { id: string(item.nzo_id), name: string(item.filename), progress: percent(item.percentage), state: paused ? 'paused' : sabnzbdState(item.status), etaMs: etaMs(item.timeleft), sizeBytes: numeric(item.mb) * 1048576 }; }),
    { downloadBps: numeric(queue.kbpersec) * 1024, sessionDownloaded: optionalBytes(object(stats).day),
      ...(Array.isArray(slots) ? { completed: completedItems(slots.map(object).filter(item => item.status === 'Completed').map(item => ({ id: string(item.nzo_id), name: string(item.name), sizeBytes: optionalBytes(item.bytes ?? item.downloaded), ...(numeric(item.completed) > 0 ? { at: numeric(item.completed) * 1000 } : {}) }))) } : {}),
      ...(queue.diskspace1 !== undefined ? { freeBytes: numeric(queue.diskspace1) * 1073741824 } : {}) });
}
export async function collectSabnzbd(instance: IntegrationInstance) {
  const [queue, stats, history] = await Promise.all([sabnzbdRequest(instance, 'queue'), sabnzbdRequest(instance, 'server_stats').catch(() => undefined), sabnzbdRequest(instance, 'history').catch(() => undefined)]);
  return toSabnzbd(instance, queue, stats, history);
}
