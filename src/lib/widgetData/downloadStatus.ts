import type { IntegrationInstance } from '@/lib/types';
import { collectDownloadClient } from '@/integrations/downloads/collect';
import type { DownloadClientStatus } from './contracts';
import { TtlCache } from './cache';
import { serviceIdentity } from './services';
const cache = new TtlCache<DownloadClientStatus>(3000);
const revisions = new Map<string, number>();
let revision = 0;
const key = (identity: string) => `${identity}:${revisions.get(identity) ?? 0}`;
export function invalidateDownloadStatus(instance: IntegrationInstance) {
  const identity = serviceIdentity(instance);
  cache.delete(key(identity));
  revisions.delete(identity);
  revisions.set(identity, ++revision);
  while (revisions.size > 1000) revisions.delete(revisions.keys().next().value!);
}
export const downloadStatus = (instance: IntegrationInstance) => cache.get(key(serviceIdentity(instance)), () => collectDownloadClient(instance));
