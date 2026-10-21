import type { IntegrationInstance } from '@/lib/types';
import { number, object, string, serviceBytes, assertStatus, serviceIdentity, ServiceError } from '@/lib/widgetData/services';
import { clientJson, clientStatus, completedItems, optionalBytes, parseJson, percent, responseCookie, rpcResult, seconds, type DownloadState } from '../downloads/shared';
interface Session { cookie: string; expires: number }
const sessions = new Map<string, Session>(), logins = new Map<string, Promise<Session>>();
export function clearDelugeSessions() { sessions.clear(); logins.clear(); }
async function login(instance: IntegrationInstance): Promise<Session> {
  const key = serviceIdentity(instance), current = sessions.get(key);
  if (current && current.expires > Date.now()) return current;
  const pending = logins.get(key); if (pending) return pending;
  const request = (async () => {
    const answer = await serviceBytes(instance, '/json', { method: 'POST', json: { method: 'auth.login', params: [instance.secrets?.password ?? ''], id: 1 } }, 65536);
    assertStatus(answer.status);
    const cookie = responseCookie(answer.headers, '_session_id') ?? responseCookie(answer.headers, 'session_id');
    if (rpcResult(parseJson(answer.bytes)) !== true || !cookie) throw new ServiceError('integrations.error.authentication');
    const result = { cookie, expires: Date.now() + 1800000 }; sessions.delete(key); sessions.set(key, result);
    while (sessions.size > 200) sessions.delete(sessions.keys().next().value!);
    return result;
  })();
  logins.set(key, request); try { return await request; } finally { logins.delete(key); }
}
export async function delugeRequest(instance: IntegrationInstance, method: string, params: unknown[] = []) {
  const session = await login(instance);
  return rpcResult(await clientJson(instance, '/json', { method: 'POST', headers: { Cookie: session.cookie }, json: { method, params, id: 1 } }));
}
export function delugeState(value: unknown): DownloadState {
  return ({ downloading: 'downloading', seeding: 'seeding', paused: 'paused', queued: 'queued', checking: 'checking', allocating: 'checking', moving: 'checking', error: 'error', finished: 'completed' } as Record<string, DownloadState>)[string(value).toLowerCase()] ?? 'queued';
}
export function toDeluge(instance: IntegrationInstance, update: unknown, free?: unknown, finished?: unknown) {
  const body = object(update), stats = object(body.stats);
  if (!body.torrents || typeof body.torrents !== 'object' || Array.isArray(body.torrents)) throw new ServiceError('widgets.error.parse');
  return clientStatus(instance, Object.entries(object(body.torrents)).map(([id, raw]) => { const item = object(raw); return { id, name: string(item.name), progress: percent(item.progress), state: delugeState(item.state), downloadBps: number(item.download_payload_rate), etaMs: seconds(item.eta), sizeBytes: number(item.total_size) }; }),
    { downloadBps: number(stats.download_rate), uploadBps: number(stats.upload_rate), sessionDownloaded: optionalBytes(stats.total_download), sessionUploaded: optionalBytes(stats.total_upload),
      ...(finished ? { completed: completedItems(Object.entries(object(object(finished).torrents)).filter(([, raw]) => number(object(raw).completed_time) > 0).map(([id, raw]) => { const item = object(raw); return { id, name: string(item.name), sizeBytes: optionalBytes(item.total_size), at: number(item.completed_time) * 1000 }; })) } : {}),
      ...(typeof free === 'number' ? { freeBytes: number(free) } : {}) });
}
export async function collectDeluge(instance: IntegrationInstance) {
  const [update, free, finished] = await Promise.all([delugeRequest(instance, 'web.update_ui', [['name', 'progress', 'state', 'download_payload_rate', 'eta', 'total_size'], {}]), delugeRequest(instance, 'core.get_free_space').catch(() => undefined),
    delugeRequest(instance, 'web.update_ui', [['name', 'total_size', 'completed_time'], {}]).catch(() => undefined)]);
  return toDeluge(instance, update, free, finished);
}
