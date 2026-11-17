import type { IntegrationInstance } from '@/lib/types';
import type { ReadingItem, ReadingSummary } from '@/lib/widgetData/contracts';
import { serviceBytes, ServiceError } from '@/lib/widgetData/services';

/**
 * What the three reading servers share: the covers each answer lists, which
 * alone `KitServer.image` serves (per connection, a day, bounded), and the
 * fictional demo.
 */
const known = new Map<string, number>();
const coverKey = (instance: IntegrationInstance, id: string) => `${instance.id}\u0000${id}`;
export function rememberCovers(instance: IntegrationInstance, items: ReadingItem[]) {
  const now = Date.now();
  for (const item of items) if (item.cover) { known.delete(coverKey(instance, item.cover)); known.set(coverKey(instance, item.cover), now); }
  while (known.size > 5000) known.delete(known.keys().next().value!);
}
export function assertKnownCover(instance: IntegrationInstance, id: string) {
  const at = known.get(coverKey(instance, id));
  if (!at || Date.now() - at > 86_400_000) throw new ServiceError('widgets.error.notFound', 404);
}
/** An image of the server with the connection's headers, bounded, never redirected. */
export async function coverBytes(instance: IntegrationInstance, path: string, headers: Record<string, string>) {
  const answer = await serviceBytes(instance, path, { headers }, 4 * 1024 * 1024);
  if (answer.status === 404) throw new ServiceError('widgets.error.notFound', 404);
  if (answer.status < 200 || answer.status >= 300) throw new ServiceError('widgets.error.http', 502, { status: answer.status });
  return { bytes: answer.bytes, contentType: answer.contentType };
}

export function demoReading(instance: IntegrationInstance, provider: ReadingSummary['provider']): ReadingSummary {
  const kind: ReadingItem['kind'] = provider === 'audiobookshelf' ? 'audiobook' : provider === 'komga' ? 'comic' : 'book';
  const minute = Math.floor(Date.now() / 60_000);
  const item = (id: string, title: string, subtitle: string, progress?: number): ReadingItem => ({ id, title, subtitle, kind, ...(progress !== undefined ? { progress } : {}), cover: `demo-${id}` });
  return {
    provider, name: instance.name,
    inProgress: [
      item('r1', 'The Lighthouse Keeper', 'M. Arden', 64 + (minute % 3)),
      item('r2', 'Salt and Circuits', 'J. Okafor', 23),
      item('r3', 'A Field Guide to Quiet', 'L. Moreau', 88),
    ],
    recent: [
      item('r4', 'Northern Lines', 'K. Ilves'),
      item('r5', 'The Paper Orchard', 'S. Lind'),
      item('r6', 'Copper Weather', 'R. Haas'),
      item('r7', 'Small Engines', 'T. Okoro'),
    ],
    fetchedAt: Date.now(),
  };
}
