import type { IntegrationInstance } from '@/lib/types';
import type { DownloadClientStatus, DownloadClientType } from '@/lib/widgetData/contracts';
import { assertStatus, object, serviceBytes, ServiceError, type ServiceOptions } from '@/lib/widgetData/services';
/** Missing optional counters stay absent, including on older client releases. */
export const optionalBytes = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
export function completedItems(items: NonNullable<DownloadClientStatus['completed']>): NonNullable<DownloadClientStatus['completed']> {
  return items.sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 5);
}
export type DownloadItem = DownloadClientStatus['items'][number];
export type DownloadState = DownloadItem['state'];
export const numeric = (value: unknown) => { const n = typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN; return Number.isFinite(n) ? Math.max(0, n) : 0; };
export const percent = (value: unknown) => Math.min(100, numeric(value));
export const seconds = (value: unknown): number | undefined => typeof value === 'number' && value >= 0 && Number.isFinite(value) && value < 8640000 ? value * 1000 : undefined;
export function basicHeaders(instance: IntegrationInstance): Record<string, string> {
  const username = instance.settings.username ?? '', password = instance.secrets?.password ?? '';
  return username || password ? { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` } : {};
}
export function parseJson(bytes: Buffer): unknown {
  try { return JSON.parse(bytes.toString('utf8')); } catch { throw new ServiceError('widgets.error.parse'); }
}
/** All client calls reject redirects, including login bodies and SABnzbd's query key. */
export async function clientJson(instance: IntegrationInstance, path: string, options: ServiceOptions = {}): Promise<unknown> {
  const answer = await serviceBytes(instance, path, options, 2 * 1024 * 1024);
  assertStatus(answer.status);
  return parseJson(answer.bytes);
}
export function rpcResult(value: unknown): unknown {
  const body = object(value);
  if (body.error) throw new ServiceError('widgets.error.http');
  if (!('result' in body)) throw new ServiceError('widgets.error.parse');
  return body.result;
}
/** What a download widget shows first: running work, then what waits for the user, then what is done. */
const STATE_RANK: Record<DownloadState, number> = { downloading: 0, checking: 1, error: 2, paused: 3, queued: 4, seeding: 5, completed: 6 };
export function clientStatus(instance: IntegrationInstance, items: DownloadItem[], values: Partial<DownloadClientStatus>): DownloadClientStatus {
  const torrents = ['qbittorrent', 'transmission', 'deluge'].includes(instance.type);
  // Torrent clients pause "everything" torrent by torrent: once nothing is left running, the client reads as paused,
  // so its button offers to resume all instead of pausing again.
  const allPaused = torrents && items.length > 0 && items.every(item => item.state === 'paused' || item.state === 'completed') && items.some(item => item.state === 'paused');
  return { id: instance.id, name: instance.name, type: instance.type as DownloadClientType, downloadBps: 0,
    active: items.filter(item => item.state === 'downloading' || item.state === 'seeding').length,
    paused: items.filter(item => item.state === 'paused').length, queued: items.filter(item => item.state === 'queued').length,
    ...(torrents ? { seeding: items.filter(item => item.state === 'seeding').length } : {}),
    ...values, ...(allPaused ? { clientPaused: true } : {}),
    // Every item is kept (the routes trim what they send): a paused download, now at 0 B/s, must not fall out of
    // the list behind many seeding torrents, or it could no longer be resumed nor matched by the *arr queue.
    items: [...items].sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || (b.downloadBps ?? 0) - (a.downloadBps ?? 0)) };
}
/** `name` may be a pattern for clients that number their cookie (qBittorrent 5.2+: `QBT_SID_<port>`). Values may be base64. */
export function responseCookie(headers: Record<string, string | string[] | undefined> | undefined, name: string | RegExp): string | undefined {
  const cookies = headers?.['set-cookie'];
  for (const cookie of typeof cookies === 'string' ? [cookies] : cookies ?? []) {
    const first = cookie.split(';')[0], equals = first.indexOf('=');
    const named = typeof name === 'string' ? first.slice(0, equals) === name : name.test(first.slice(0, equals));
    if (equals > 0 && named && /^[A-Za-z0-9_=+/.-]+$/.test(first) && first.length <= 1024) return first;
  }
}
