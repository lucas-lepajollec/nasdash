import type { IntegrationInstance } from '@/lib/types';
import { array, number, object, string, ServiceError } from '@/lib/widgetData/services';
import { basicHeaders, clientJson, clientStatus, rpcResult, type DownloadState } from '../downloads/shared';
export async function nzbgetRequest(instance: IntegrationInstance, method: string) {
  return rpcResult(await clientJson(instance, '/jsonrpc', { method: 'POST', headers: basicHeaders(instance), json: { method, params: [], id: 1 } }));
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
export function toNzbget(instance: IntegrationInstance, value: unknown, groups: unknown) {
  const stats = object(value);
  if (!Array.isArray(groups) || typeof stats.DownloadRate !== 'number') throw new ServiceError('widgets.error.parse');
  return clientStatus(instance, array(groups).map(raw => {
    const item = object(raw), total = number(item.FileSizeMB) * 1048576, left = number(item.RemainingSizeMB) * 1048576;
    return { id: String(item.NZBID), name: string(item.NZBName), progress: total ? Math.min(100, Math.max(0, 100 * (total - left) / total)) : 0,
      state: stats.DownloadPaused === true ? 'paused' : nzbgetState(item.Status), sizeBytes: total };
  }), { downloadBps: number(stats.DownloadRate), downloadLimitBps: number(stats.DownloadLimit), ...(typeof stats.FreeDiskSpaceMB === 'number' ? { freeBytes: number(stats.FreeDiskSpaceMB) * 1048576 } : {}) });
}
export async function collectNzbget(instance: IntegrationInstance) {
  const [status, groups] = await Promise.all([nzbgetRequest(instance, 'status'), nzbgetRequest(instance, 'listgroups')]);
  return toNzbget(instance, status, groups);
}
