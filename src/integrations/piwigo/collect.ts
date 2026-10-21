import type { IntegrationInstance } from '@/lib/types';
import { TtlCache } from '@/lib/widgetData/cache';
import { array, assertStatus, object, serviceBytes, serviceIdentity, serviceJson, ServiceError } from '@/lib/widgetData/services';
import { parseJson, responseCookie } from '../downloads/shared';
import { counters, identity } from '../photos/shared';
const sessions = new TtlCache<string>(1800000);
export function clearPiwigoSessions() { sessions.clear(); }
function result(value: unknown): Record<string, unknown> {
  const body = object(value);
  if (body.stat !== 'ok') throw new ServiceError(body.err === 401 || body.err === 403 || body.err === 999 ? 'integrations.error.authentication' : 'widgets.error.http', 502, { status: Number(body.err) || 502 });
  return object(body.result);
}
async function login(instance: IntegrationInstance): Promise<string> {
  return sessions.get(serviceIdentity(instance), async () => {
    const answer = await serviceBytes(instance, '/ws.php?format=json&method=pwg.session.login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: instance.settings.username ?? '', password: instance.secrets?.password ?? '' }).toString() }, 65536);
    assertStatus(answer.status);
    const body = object(parseJson(answer.bytes)), cookie = responseCookie(answer.headers, 'pwg_id');
    if (body.stat !== 'ok' || body.result !== true || !cookie) throw new ServiceError('integrations.error.authentication');
    return cookie;
  });
}
export async function piwigoRequest(instance: IntegrationInstance): Promise<unknown> {
  const send = async () => result(await serviceJson(instance, '/ws.php?format=json&method=pwg.getInfos', { headers: { Cookie: await login(instance) } }));
  try { return await send(); }
  catch (error) {
    if (!(error instanceof ServiceError) || ![401, 403, 999].includes(Number(error.parameters?.status))) throw error;
    sessions.delete(serviceIdentity(instance));
    return send();
  }
}
export function toPiwigoStats(instance: IntegrationInstance, value: unknown) {
  const body = object(value), infos = body.infos;
  if (!Array.isArray(infos) && (!infos || typeof infos !== 'object')) throw new ServiceError('widgets.error.parse');
  const data = Array.isArray(infos) ? Object.fromEntries(array(infos).map(raw => { const row = object(raw); return [String(row.name), row.value]; })) : object(infos);
  // nb_elements counts all media. Core getInfos has no video split or library bytes;
  // cache_size is a historical placeholder and must never be used as disk usage.
  return { ...identity(instance), ...counters({ photos: data.nb_elements, albums: data.nb_categories, libraryBytes: data.library_size_bytes }) };
}
export async function collectPiwigoStats(instance: IntegrationInstance) { return toPiwigoStats(instance, await piwigoRequest(instance)); }
