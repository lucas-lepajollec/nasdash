import type { IntegrationInstance } from '@/lib/types';
import type { ReadingItem, ReadingSummary } from '@/lib/widgetData/contracts';
import { array, number, object, serviceJson, string, ServiceError } from '@/lib/widgetData/services';
import type { KitServer } from '../kitServer';
import { assertKnownCover, coverBytes, demoReading, rememberCovers } from '../reading/shared';

/**
 * Komga with an API key (`X-API-Key`): books in progress
 * (`GET /api/v1/books?read_status=IN_PROGRESS&sort=readProgress.readDate,desc`),
 * the next ones to read (`/api/v1/books/ondeck`) and the latest
 * (`/api/v1/books/latest`). Covers: `GET /api/v1/books/{id}/thumbnail`.
 */
const headers = (instance: IntegrationInstance) => ({ 'X-API-Key': instance.secrets?.apiKey ?? '' });
export const komgaRequest = <T = unknown>(instance: IntegrationInstance, path: string) => serviceJson<T>(instance, path, { headers: headers(instance) });
const text = (value: unknown, max = 160) => string(value).trim().slice(0, max);
const ID = /^[A-Za-z0-9]{1,40}$/;

export function toBook(value: unknown): ReadingItem | undefined {
  const book = object(value), id = text(book.id, 40);
  if (!ID.test(id)) return undefined;
  const pages = number(object(book.media).pagesCount), progress = object(book.readProgress);
  const page = number(progress.page);
  return {
    id, title: text(object(book.metadata).title) || text(book.name) || id,
    ...(text(book.seriesTitle) ? { subtitle: text(book.seriesTitle) } : {}),
    kind: 'comic',
    ...(progress.completed === true ? { progress: 100 } : pages > 0 && page > 0 ? { progress: Math.round(Math.min(100, page / pages * 100) * 10) / 10 } : {}),
    cover: `komga-${id}`,
  };
}
const content = (answer: unknown) => { const list = object(answer).content; if (!Array.isArray(list)) throw new ServiceError('widgets.error.parse'); return list; };

export async function collectKomga(instance: IntegrationInstance): Promise<ReadingSummary> {
  const [reading, deck, latest] = await Promise.all([
    komgaRequest(instance, '/api/v1/books?read_status=IN_PROGRESS&sort=readProgress.readDate,desc&size=12').catch(() => ({ content: [] })),
    komgaRequest(instance, '/api/v1/books/ondeck?size=6').catch(() => ({ content: [] })),
    komgaRequest(instance, '/api/v1/books/latest?size=12'),
  ]);
  const inProgress = [...content(reading), ...array(object(deck).content)].map(toBook).filter((item): item is ReadingItem => !!item)
    .filter((item, index, all) => all.findIndex(other => other.id === item.id) === index).slice(0, 12);
  const seen = new Set(inProgress.map(item => item.id));
  const recent = content(latest).map(toBook).filter((item): item is ReadingItem => !!item && !seen.has(item.id));
  rememberCovers(instance, [...inProgress, ...recent]);
  return { provider: 'komga', name: instance.name, inProgress, recent, fetchedAt: Date.now() };
}

export const komgaKit: KitServer<ReadingSummary> = {
  ttlMs: 60_000,
  collect: collectKomga,
  test: async instance => { content(await komgaRequest(instance, '/api/v1/books/latest?size=1')); },
  demo: instance => demoReading(instance, 'komga'),
  image: async (instance, id) => {
    assertKnownCover(instance, id);
    return coverBytes(instance, `/api/v1/books/${encodeURIComponent(id.slice(6))}/thumbnail`, headers(instance));
  },
};
