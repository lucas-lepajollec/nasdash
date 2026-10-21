import type { IntegrationInstance } from '@/lib/types';
import { collectArrQueue, type ArrQueueData } from '@/integrations/arr/collect';
import { TtlCache } from './cache';
import { serviceIdentity } from './services';

const cache = new TtlCache<ArrQueueData>(10000);
// Revisions isolate a refreshed queue from older reads still in flight.
const revisions = new Map<string, number>();
let revision = 0;
const key = (instance: IntegrationInstance) => `${serviceIdentity(instance)}:${revisions.get(serviceIdentity(instance)) ?? 0}`;
export const arrQueue = (instance: IntegrationInstance) => cache.get(key(instance), () => collectArrQueue(instance));
export function invalidateArrQueue(instance: IntegrationInstance) {
  cache.delete(key(instance));
  revisions.delete(serviceIdentity(instance));
  revisions.set(serviceIdentity(instance), ++revision);
  while (revisions.size > 1000) revisions.delete(revisions.keys().next().value!);
}
