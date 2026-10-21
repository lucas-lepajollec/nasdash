import type { IntegrationInstance } from '@/lib/types';
import { array, number, object, string, ServiceError } from '@/lib/widgetData/services';
import { basicHeaders, clientJson, clientStatus, completedItems, optionalBytes, rpcResult, type DownloadState } from '../downloads/shared';
export async function nzbgetRequest(instance: IntegrationInstance, method: string, params: unknown[] = []) {
  return rpcResult(await clientJson(instance, '/jsonrpc', { method: 'POST', headers: basicHeaders(instance), json: { method, params, id: 1 } }));
}
export function nzbgetState(value: unknown): DownloadState {
  const state = string(value).toUpperCase();
  if (/FAIL|ERROR/.test(state)) return 'error';
  if (/PAUSED/.test(state)) return 'paused';
  if (/QUEUED/.test(state)) return 'queued';
  if (/DOWNLOADING|FETCHING/.test(state)) return 'downloading';
  if (/SUCCESS|COMPLETED|FINISHED/.test(state)) return 'completed';
  if (/CHECK|VERIFY|REPAIR|UNPACK|MOV|SCRIPT|RENAM|LOADING_PARS/.test(state)) return 'checking';
  return 'queued';
}
export function toNzbget(instance: IntegrationInstance, value: unknown, groups: unknown, history?: unknown) {
  const stats = object(value);
  if (!Array.isArray(groups) || typeof stats.DownloadRate !== 'number') throw new ServiceError('widgets.error.parse');
  return clientStatus(instance, array(groups).map(raw => {
    const item = object(raw), total = number(item.FileSizeMB) * 1048576, left = number(item.RemainingSizeMB) * 1048576;
    return { id: String(item.NZBID), name: string(item.NZBName), progress: total ? Math.min(100, Math.max(0, 100 * (total - left) / total)) : 0,
      state: stats.DownloadPaused === true ? 'paused' : nzbgetState(item.Status), sizeBytes: total };
  }), { ...(typeof stats.DownloadPaused === 'boolean' ? { clientPaused: stats.DownloadPaused } : {}), downloadBps: number(stats.DownloadRate), downloadLimitBps: number(stats.DownloadLimit), sessionDownloaded: optionalBytes(stats.DownloadedSizeMB) === undefined ? undefined : number(stats.DownloadedSizeMB) * 1048576,
    ...(Array.isArray(history) ? { completed: completedItems(history.map(object).filter(item => item.NZBID !== undefined && /^SUCCESS(?:\/|$)/.test(string(item.Status))).map(item => ({ id: String(item.NZBID), name: string(item.Name ?? item.NZBName),
      ...(optionalBytes(item.FileSizeMB) !== undefined ? { sizeBytes: number(item.FileSizeMB) * 1048576 } : {}), ...(number(item.HistoryTime) > 0 ? { at: number(item.HistoryTime) * 1000 } : {}) }))) } : {}),
    ...(typeof stats.FreeDiskSpaceMB === 'number' ? { freeBytes: number(stats.FreeDiskSpaceMB) * 1048576 } : {}) });
}
export async function collectNzbget(instance: IntegrationInstance) {
  const [status, groups, history] = await Promise.all([nzbgetRequest(instance, 'status'), nzbgetRequest(instance, 'listgroups'), nzbgetRequest(instance, 'history').catch(() => undefined)]);
  return toNzbget(instance, status, groups, history);
}
