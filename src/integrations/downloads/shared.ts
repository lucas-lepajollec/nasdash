import type { IntegrationInstance } from '@/lib/types';
import type { DownloadClientStatus, DownloadClientType } from '@/lib/widgetData/contracts';
import { assertStatus, object, serviceBytes, ServiceError, type ServiceOptions } from '@/lib/widgetData/services';
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
export function clientStatus(instance: IntegrationInstance, items: DownloadItem[], values: Partial<DownloadClientStatus>): DownloadClientStatus {
  return { id: instance.id, name: instance.name, type: instance.type as DownloadClientType, downloadBps: 0,
    active: items.filter(item => item.state === 'downloading' || item.state === 'seeding').length,
    paused: items.filter(item => item.state === 'paused').length, queued: items.filter(item => item.state === 'queued').length,
    ...values, items: [...items].sort((a, b) => (b.downloadBps ?? 0) - (a.downloadBps ?? 0)).slice(0, 10) };
}
export function responseCookie(headers: Record<string, string | string[] | undefined> | undefined, name: string): string | undefined {
  const cookies = headers?.['set-cookie'];
  for (const cookie of typeof cookies === 'string' ? [cookies] : cookies ?? []) {
    const first = cookie.split(';')[0];
    if (first.startsWith(`${name}=`) && /^[A-Za-z0-9_=-]+$/.test(first) && first.length <= 1024) return first;
  }
}
