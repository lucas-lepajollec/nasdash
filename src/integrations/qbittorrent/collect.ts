import type { IntegrationInstance } from '@/lib/types';
import { array, number, object, string, serviceBytes, assertStatus, serviceIdentity, ServiceError } from '@/lib/widgetData/services';
import { clientStatus, parseJson, percent, responseCookie, seconds, type DownloadState } from '../downloads/shared';
interface Session { cookie: string; expires: number }
const sessions = new Map<string, Session>(), logins = new Map<string, Promise<Session>>();
export function clearQbittorrentSessions() { sessions.clear(); logins.clear(); }
async function login(instance: IntegrationInstance): Promise<Session> {
  const key = serviceIdentity(instance), current = sessions.get(key);
  if (current && current.expires > Date.now()) return current;
  const pending = logins.get(key); if (pending) return pending;
  const request = (async () => {
    const answer = await serviceBytes(instance, '/api/v2/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: instance.settings.username ?? '', password: instance.secrets?.password ?? '' }).toString() }, 65536);
    assertStatus(answer.status);
    const cookie = responseCookie(answer.headers, 'SID');
    if (answer.bytes.toString('utf8').trim() !== 'Ok.' || !cookie) throw new ServiceError('integrations.error.authentication');
    const result = { cookie, expires: Date.now() + 1800000 };
    sessions.delete(key); sessions.set(key, result);
    while (sessions.size > 200) sessions.delete(sessions.keys().next().value!);
    return result;
  })();
  logins.set(key, request);
  try { return await request; } finally { logins.delete(key); }
}
async function qbittorrentResponse(instance: IntegrationInstance, path: string) {
  if (instance.settings.auth === 'apikey') {
    // An API key replaces the cookie login (qBittorrent 5.2+).
    const answer = await serviceBytes(instance, path, { headers: { Authorization: `Bearer ${instance.secrets?.apiKey ?? ''}` } }, 2 * 1024 * 1024);
    if (answer.status === 401 || answer.status === 403) throw new ServiceError('integrations.error.authentication');
    assertStatus(answer.status);
    return answer;
  }
  const session = await login(instance);
  const send = async (cookie: string) => {
    const answer = await serviceBytes(instance, path, { headers: { Cookie: cookie } }, 2 * 1024 * 1024);
    assertStatus(answer.status);
    return answer;
  };
  try { return await send(session.cookie); }
  catch (error) {
    if (!(error instanceof ServiceError) || error.parameters?.status !== 403) throw error;
    const key = serviceIdentity(instance); if (sessions.get(key)?.cookie === session.cookie) sessions.delete(key);
    return send((await login(instance)).cookie);
  }
}
export async function qbittorrentRequest(instance: IntegrationInstance, path: string): Promise<unknown> {
  return parseJson((await qbittorrentResponse(instance, path)).bytes);
}
export function qbittorrentState(value: unknown): DownloadState {
  const state = string(value).toLowerCase();
  if (/error|missingfiles/.test(state)) return 'error';
  if (/paused|stopped/.test(state)) return 'paused';
  if (/queued/.test(state)) return 'queued';
  if (/checking|allocating|moving/.test(state)) return 'checking';
  if (/uploading|stalledup|forcedup/.test(state)) return 'seeding';
  if (/downloading|stalleddl|forceddl|metadl/.test(state)) return 'downloading';
  return 'error';
}
export function toQbittorrent(instance: IntegrationInstance, transfer: unknown, mode: unknown, torrents: unknown, sync?: unknown) {
  if (!Array.isArray(torrents) || typeof object(transfer).dl_info_speed !== 'number') throw new ServiceError('widgets.error.parse');
  const info = object(transfer), free = object(object(sync).server_state).free_space_on_disk;
  return clientStatus(instance, array(torrents).map(raw => { const item = object(raw); return { id: string(item.hash), name: string(item.name), progress: percent(number(item.progress) * 100), state: qbittorrentState(item.state), downloadBps: number(item.dlspeed), etaMs: seconds(item.eta), sizeBytes: number(item.size) }; }),
    { downloadBps: number(info.dl_info_speed), uploadBps: number(info.up_info_speed), downloadLimitBps: number(info.dl_rate_limit), uploadLimitBps: number(info.up_rate_limit), altSpeed: mode === 1 || mode === true, ...(typeof free === 'number' ? { freeBytes: number(free) } : {}) });
}
export async function collectQbittorrent(instance: IntegrationInstance) {
  const [transfer, mode, torrents, sync] = await Promise.all(['/api/v2/transfer/info', '/api/v2/transfer/speedLimitsMode', '/api/v2/torrents/info?sort=dlspeed&reverse=true', '/api/v2/sync/maindata'].map((path, i) => i === 3 ? qbittorrentRequest(instance, path).catch(() => undefined) : qbittorrentRequest(instance, path)));
  return toQbittorrent(instance, transfer, mode, torrents, sync);
}
/** Version is plain text, unlike the widget's endpoints. */
export async function testQbittorrent(instance: IntegrationInstance) {
  const answer = await qbittorrentResponse(instance, '/api/v2/app/version');
  if (!answer.bytes.toString('utf8').trim()) throw new ServiceError('widgets.error.parse');
}
