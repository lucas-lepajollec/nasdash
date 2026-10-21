import type { IntegrationInstance } from '@/lib/types';
import { TtlCache } from '@/lib/widgetData/cache';
import { object, serviceIdentity, serviceJson, ServiceError } from '@/lib/widgetData/services';
import { count, counters, identity, years } from '../photos/shared';
interface Tokens { access: string; refresh: string }
const sessions = new TtlCache<Tokens>(240000);
export function clearLibrephotosSessions() { sessions.clear(); }
function tokens(value: unknown, previous?: Tokens): Tokens {
  const data = object(value), access = typeof data.access === 'string' && data.access.length <= 8192 ? data.access : '', refresh = typeof data.refresh === 'string' && data.refresh.length <= 8192 ? data.refresh : previous?.refresh;
  if (!access || !refresh || !/^[A-Za-z0-9._-]+$/.test(access)) throw new ServiceError('integrations.error.authentication');
  return { access, refresh };
}
/** A body forces the bounded, no-redirect transport for credential exchanges too. */
function tokenPost(instance: IntegrationInstance, path: string, body: Record<string, string>) {
  return serviceJson(instance, path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
async function login(instance: IntegrationInstance) {
  return sessions.get(serviceIdentity(instance), async () => tokens(await tokenPost(instance, '/api/auth/token/obtain/', { username: instance.settings.username ?? '', password: instance.secrets?.password ?? '' })));
}
export async function librephotosRequest(instance: IntegrationInstance, path: string): Promise<unknown> {
  const session = await login(instance), key = serviceIdentity(instance);
  const send = (access: string) => serviceJson(instance, path, { headers: { Authorization: `Bearer ${access}` } });
  try { return await send(session.access); }
  catch (error) {
    if (!(error instanceof ServiceError) || ![401, 403].includes(Number(error.parameters?.status))) throw error;
    sessions.delete(key);
    const refreshed = await sessions.get(key, async () => {
      try { return tokens(await tokenPost(instance, '/api/auth/token/refresh/', { refresh: session.refresh }), session); }
      catch (error) {
        if (!(error instanceof ServiceError) || ![400, 401, 403].includes(Number(error.parameters?.status))) throw error;
        return tokens(await tokenPost(instance, '/api/auth/token/obtain/', { username: instance.settings.username ?? '', password: instance.secrets?.password ?? '' }));
      }
    });
    return send(refreshed.access);
  }
}
export function toLibrephotosStats(instance: IntegrationInstance, value: unknown, months?: unknown) {
  const data = object(value);
  if (count(data.num_photos) === undefined) throw new ServiceError('widgets.error.parse');
  const albums = ['num_albumauto', 'num_albumdate', 'num_albumuser'].map(key => count(data[key]));
  const byYear = years(Array.isArray(months) ? months : object(months).results, 'month', 'count');
  return { ...identity(instance), ...counters({ photos: data.num_photos, videos: data.num_videos, people: data.num_people,
    albums: albums.every(n => n !== undefined) ? albums.reduce<number>((a, b) => a + b!, 0) : undefined }), ...(byYear ? { byYear } : {}) };
}
export async function collectLibrephotosStats(instance: IntegrationInstance) {
  const stats = await librephotosRequest(instance, '/api/stats/');
  const months = await librephotosRequest(instance, '/api/photomonthcounts/').catch(() => undefined);
  return toLibrephotosStats(instance, stats, months);
}
