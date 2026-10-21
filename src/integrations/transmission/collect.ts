import type { IntegrationInstance } from '@/lib/types';
import { array, number, object, string, serviceBytes, assertStatus, serviceIdentity, ServiceError } from '@/lib/widgetData/services';
import { basicHeaders, clientStatus, parseJson, percent, seconds, type DownloadState } from '../downloads/shared';
const sessions = new Map<string, string>();
export function clearTransmissionSessions() { sessions.clear(); }
export async function transmissionRequest(instance: IntegrationInstance, method: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const key = serviceIdentity(instance);
  const send = (session?: string) => serviceBytes(instance, '/transmission/rpc', { method: 'POST', headers: { ...basicHeaders(instance), ...(session ? { 'X-Transmission-Session-Id': session } : {}) }, json: { method, arguments: args } }, 2 * 1024 * 1024);
  let answer = await send(sessions.get(key));
  if (answer.status === 409) {
    const session = answer.headers?.['x-transmission-session-id'];
    if (typeof session !== 'string' || !/^[\x21-\x7e]{1,1024}$/.test(session)) throw new ServiceError('widgets.error.parse');
    sessions.delete(key); sessions.set(key, session); while (sessions.size > 200) sessions.delete(sessions.keys().next().value!);
    answer = await send(session);
  }
  assertStatus(answer.status);
  const body = object(parseJson(answer.bytes));
  if (body.result !== 'success') throw new ServiceError('widgets.error.http');
  return body.arguments;
}
export function transmissionState(value: unknown, progress = 0): DownloadState {
  return ({ 0: 'paused', 1: 'queued', 2: 'checking', 3: 'queued', 4: 'downloading', 5: 'queued', 6: 'seeding' } as Record<number, DownloadState>)[Number(value)] ?? (progress >= 100 ? 'completed' : 'error');
}
export function toTransmission(instance: IntegrationInstance, stats: unknown, session: unknown, torrents: unknown) {
  const info = object(stats), config = object(session), rows = object(torrents).torrents;
  if (!Array.isArray(rows) || typeof info.downloadSpeed !== 'number') throw new ServiceError('widgets.error.parse');
  return clientStatus(instance, array(rows).map(raw => { const item = object(raw), progress = percent(number(item.percentDone) * 100); return { id: String(item.id), name: string(item.name), progress, state: transmissionState(item.status, progress), downloadBps: number(item.rateDownload), etaMs: seconds(item.eta), sizeBytes: number(item.totalSize) }; }),
    { downloadBps: number(info.downloadSpeed), uploadBps: number(info.uploadSpeed), altSpeed: config['alt-speed-enabled'] === true,
      downloadLimitBps: config['alt-speed-enabled'] === true ? number(config['alt-speed-down']) * 1000 : config['speed-limit-down-enabled'] ? number(config['speed-limit-down']) * 1000 : 0,
      uploadLimitBps: config['alt-speed-enabled'] === true ? number(config['alt-speed-up']) * 1000 : config['speed-limit-up-enabled'] ? number(config['speed-limit-up']) * 1000 : 0,
      ...(typeof config['download-dir-free-space'] === 'number' ? { freeBytes: number(config['download-dir-free-space']) } : {}) });
}
export async function collectTransmission(instance: IntegrationInstance) {
  const [stats, session, torrents] = await Promise.all([transmissionRequest(instance, 'session-stats'), transmissionRequest(instance, 'session-get'), transmissionRequest(instance, 'torrent-get', { fields: ['id', 'name', 'percentDone', 'status', 'rateDownload', 'eta', 'totalSize'] })]);
  return toTransmission(instance, stats, session, torrents);
}
