import type { RepositoriesSummary } from '@/lib/widgetData/contracts';
import type { KitServer } from '../kitServer';
import { collectGiteaLike, testGiteaLike } from '../forges/gitea';
import { demoRepositories } from '../forges/shared';

/** Forgejo: the API it shares with Gitea (`forges/gitea.ts`). */
export const forgejoKit: KitServer<RepositoriesSummary> = {
  ttlMs: 300_000,
  collect: instance => collectGiteaLike(instance, 'forgejo'),
  test: testGiteaLike,
  demo: instance => demoRepositories(instance, 'forgejo'),
};
