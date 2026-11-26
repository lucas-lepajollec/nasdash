import type { RepositoriesSummary } from '@/lib/widgetData/contracts';
import type { KitServer } from '../kitServer';
import { collectGiteaLike, testGiteaLike } from '../forges/gitea';
import { demoRepositories } from '../forges/shared';

/** Gitea: the API it shares with Forgejo (`forges/gitea.ts`). */
export const giteaKit: KitServer<RepositoriesSummary> = {
  ttlMs: 300_000,
  collect: instance => collectGiteaLike(instance, 'gitea'),
  test: testGiteaLike,
  demo: instance => demoRepositories(instance, 'gitea'),
};
