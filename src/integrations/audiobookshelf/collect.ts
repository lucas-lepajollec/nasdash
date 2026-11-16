import type { IntegrationInstance } from '@/lib/types';
import type { ReadingItem, ReadingSummary } from '@/lib/widgetData/contracts';
import { array, number, object, serviceJson, string, ServiceError } from '@/lib/widgetData/services';
import type { KitServer } from '../kitServer';
import { assertKnownCover, coverBytes, demoReading, rememberCovers } from '../reading/shared';

/**
 * Audiobookshelf with an API token (Bearer): the account's progress
 * (`GET /api/me`, `mediaProgress`), what is in progress
 * (`GET /api/me/items-in-progress`) and each library's "recently added" shelf
 * (`GET /api/libraries/{id}/personalized`). Covers: `GET /api/items/{id}/cover`.
 */
const headers = (instance: IntegrationInstance) => ({ Authorization: `Bearer ${instance.secrets?.apiKey ?? ''}` });
export const absRequest = <T = unknown>(instance: IntegrationInstance, path: string) => serviceJson<T>(instance, path, { headers: headers(instance) });
const text = (value: unknown, max = 160) => string(value).trim().slice(0, max);
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function toItem(value: unknown, progress: Map<string, number>): ReadingItem | undefined {
  const item = object(value), id = text(item.id, 64), metadata = object(object(item.media).metadata);
  if (!ID.test(id)) return undefined;
  const share = progress.get(id);
  return {
    id, title: text(metadata.title) || id,
    ...(text(metadata.authorName) || text(metadata.author) ? { subtitle: text(metadata.authorName) || text(metadata.author) } : {}),
    kind: string(item.mediaType) === 'podcast' ? 'podcast' : 'audiobook',
    ...(share !== undefined ? { progress: Math.round(share * 1000) / 10 } : {}),
    cover: `abs-${id}`,
  };
}

export async function collectAbs(instance: IntegrationInstance): Promise<ReadingSummary> {
  const [me, inProgress, libraries] = await Promise.all([absRequest(instance, '/api/me'), absRequest(instance, '/api/me/items-in-progress'), absRequest(instance, '/api/libraries')]);
  if (!Array.isArray(object(me).mediaProgress) && !Array.isArray(object(inProgress).libraryItems)) throw new ServiceError('widgets.error.parse');
  const progress = new Map(array(object(me).mediaProgress).map(object).filter(entry => !entry.episodeId).map(entry => [text(entry.libraryItemId, 64), Math.min(1, Math.max(0, number(entry.progress)))]));
  const reading = array(object(inProgress).libraryItems).map(item => toItem(item, progress)).filter((item): item is ReadingItem => !!item).slice(0, 12);
  const shelves = await Promise.all(array(object(libraries).libraries).map(object).slice(0, 6).map(library => absRequest(instance, `/api/libraries/${encodeURIComponent(text(library.id, 64))}/personalized?limit=8`).catch(() => [])));
  const seen = new Set(reading.map(item => item.id));
  const recent = shelves.flatMap(list => array(list).map(object).filter(shelf => shelf.id === 'recently-added').flatMap(shelf => array(shelf.entities)))
    .map(item => toItem(item, progress)).filter((item): item is ReadingItem => !!item && !seen.has(item.id) && (seen.add(item.id), true)).slice(0, 12);
  const summary: ReadingSummary = { provider: 'audiobookshelf', name: instance.name, inProgress: reading, recent, fetchedAt: Date.now() };
  rememberCovers(instance, [...reading, ...recent]);
  return summary;
}

export const audiobookshelfKit: KitServer<ReadingSummary> = {
  ttlMs: 60_000,
  collect: collectAbs,
  test: async instance => { const me = object(await absRequest(instance, '/api/me')); if (!text(me.id) && !text(me.username)) throw new ServiceError('widgets.error.parse'); },
  demo: instance => demoReading(instance, 'audiobookshelf'),
  image: async (instance, id) => {
    assertKnownCover(instance, id);
    return coverBytes(instance, `/api/items/${encodeURIComponent(id.slice(4))}/cover?width=300&format=jpeg`, headers(instance));
  },
};
