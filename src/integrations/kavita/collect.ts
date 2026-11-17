import type { IntegrationInstance } from '@/lib/types';
import type { ReadingItem, ReadingSummary } from '@/lib/widgetData/contracts';
import { array, number, object, serviceJson, string, ServiceError } from '@/lib/widgetData/services';
import type { KitServer } from '../kitServer';
import { assertKnownCover, coverBytes, demoReading, rememberCovers } from '../reading/shared';

/**
 * Kavita with the account's API key: a short-lived token from
 * `POST /api/Plugin/authenticate?apiKey=…&pluginName=NasDash` (kept 30 min),
 * then `POST /api/Series/on-deck` (what is being read) and
 * `POST /api/Series/recently-added-v2`. Covers: `GET /api/image/series-cover?seriesId=`.
 */
const tokens = new Map<string, { token: string; at: number }>();
const text = (value: unknown, max = 160) => string(value).trim().slice(0, max);
async function token(instance: IntegrationInstance, fresh = false) {
  const key = `${instance.id}:${instance.secrets?.apiKey ?? ''}`, cached = tokens.get(key);
  if (!fresh && cached && Date.now() - cached.at < 30 * 60_000) return cached.token;
  const user = object(await serviceJson(instance, `/api/Plugin/authenticate?apiKey=${encodeURIComponent(instance.secrets?.apiKey ?? '')}&pluginName=NasDash`, { method: 'POST' }));
  const value = text(user.token, 4096);
  if (!value) throw new ServiceError('integrations.error.authentication');
  tokens.delete(key); tokens.set(key, { token: value, at: Date.now() });
  while (tokens.size > 100) tokens.delete(tokens.keys().next().value!);
  return value;
}
async function kavitaRequest<T = unknown>(instance: IntegrationInstance, path: string, json?: unknown): Promise<T> {
  const call = async (fresh: boolean) => serviceJson<T>(instance, path, { method: 'POST', json: json ?? {}, headers: { Authorization: `Bearer ${await token(instance, fresh)}` } });
  try { return await call(false); }
  catch (error) {
    // An expired token: one new one, once.
    if (error instanceof ServiceError && error.parameters?.status === 401) return call(true);
    throw error;
  }
}

export function toSeries(value: unknown): ReadingItem | undefined {
  const series = object(value), id = number(series.id);
  if (!id) return undefined;
  const pages = number(series.pages), read = number(series.pagesRead);
  return {
    id: String(id), title: text(series.localizedName) || text(series.name) || `#${id}`,
    ...(text(series.libraryName) ? { subtitle: text(series.libraryName) } : {}),
    kind: number(series.format) === 0 || number(series.format) === 1 ? 'comic' : 'book',
    ...(pages > 0 && read > 0 ? { progress: Math.round(Math.min(100, read / pages * 100) * 10) / 10 } : {}),
    cover: `kavita-${id}`,
  };
}

export async function collectKavita(instance: IntegrationInstance): Promise<ReadingSummary> {
  const [deck, recent] = await Promise.all([
    kavitaRequest(instance, '/api/Series/on-deck?PageNumber=1&PageSize=12&libraryId=0'),
    kavitaRequest(instance, '/api/Series/recently-added-v2?PageNumber=1&PageSize=12', { statements: [], combination: 1, limitTo: 0 }).catch(() => []),
  ]);
  if (!Array.isArray(deck)) throw new ServiceError('widgets.error.parse');
  const inProgress = deck.map(toSeries).filter((item): item is ReadingItem => !!item);
  const seen = new Set(inProgress.map(item => item.id));
  const added = array(recent).map(toSeries).filter((item): item is ReadingItem => !!item && !seen.has(item.id));
  rememberCovers(instance, [...inProgress, ...added]);
  return { provider: 'kavita', name: instance.name, inProgress, recent: added, fetchedAt: Date.now() };
}

export const kavitaKit: KitServer<ReadingSummary> = {
  ttlMs: 60_000,
  collect: collectKavita,
  test: async instance => { await token(instance, true); },
  demo: instance => demoReading(instance, 'kavita'),
  image: async (instance, id) => {
    assertKnownCover(instance, id);
    return coverBytes(instance, `/api/image/series-cover?seriesId=${encodeURIComponent(id.slice(7))}`, { Authorization: `Bearer ${await token(instance)}` });
  },
};
