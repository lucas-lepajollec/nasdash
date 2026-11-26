import type { IntegrationInstance } from '@/lib/types';
import type { ForgeRepository, RepositoriesSummary } from '@/lib/widgetData/contracts';
import { array, date, number, object, string, ServiceError } from '@/lib/widgetData/services';
import type { KitServer } from '../kitServer';
import { demoRepositories, forgeJson, optional, REPOSITORY_LIMIT, safeUrl, totalCount, type ChecksState } from '../forges/shared';

/**
 * GitLab REST API v4 (docs.gitlab.com/api, checked 2026-11-26): a personal
 * access token (`read_api`) as `PRIVATE-TOKEN`. The account `GET /api/v4/user`;
 * projects `GET /api/v4/projects?membership=true&order_by=last_activity_at`
 * (`path_with_namespace`, `web_url`, `star_count`, `open_issues_count`,
 * `visibility`, `forked_from_project`, `mirror`, `archived`,
 * `last_activity_at`); per project the open merge requests
 * `GET …/merge_requests?state=opened&per_page=1` (`x-total`), the latest
 * pipeline `GET …/pipelines?per_page=1` (`status`, `ref`, `web_url`) and
 * release `GET …/releases?per_page=1`. What waits for the account:
 * `GET /api/v4/merge_requests?scope=reviews_for_me&state=opened`,
 * `GET /api/v4/issues?scope=assigned_to_me&state=opened` and pending to-dos
 * `GET /api/v4/todos?state=pending` (`x-total`).
 */
const withApi = (instance: IntegrationInstance): IntegrationInstance => (instance.settings.url ?? '').trim() ? instance : { ...instance, settings: { ...instance.settings, url: 'https://gitlab.com' } };
const auth = (instance: IntegrationInstance) => ({ 'PRIVATE-TOKEN': instance.secrets?.apiKey ?? '' });

export function pipelineState(status: unknown): ChecksState {
  switch (status) {
    case 'success': return 'success';
    case 'failed': return 'failure';
    case 'canceled': case 'canceling': return 'cancelled';
    case 'skipped': return 'skipped';
    case 'running': return 'running';
    default: return 'pending';
  }
}

async function project(instance: IntegrationInstance, raw: Record<string, unknown>): Promise<ForgeRepository | undefined> {
  const id = number(raw.id), fullName = string(raw.path_with_namespace);
  if (!id || !fullName) return undefined;
  const path = `/api/v4/projects/${id}`;
  const [merges, pipelines, releases] = await Promise.all([
    optional(() => forgeJson(instance, `${path}/merge_requests?state=opened&per_page=1`, auth(instance))),
    optional(() => forgeJson(instance, `${path}/pipelines?per_page=1`, auth(instance))),
    optional(() => forgeJson(instance, `${path}/releases?per_page=1`, auth(instance))),
  ]);
  const pipeline = object(array(pipelines?.body)[0]);
  const latest = object(array(releases?.body)[0]);
  return {
    id: String(id), name: fullName.slice(0, 160), url: safeUrl(raw.web_url) ?? '',
    ...(raw.visibility === 'private' || raw.visibility === 'internal' ? { private: true } : {}),
    ...(raw.forked_from_project ? { fork: true } : {}), ...(raw.mirror === true ? { mirror: true } : {}),
    stars: number(raw.star_count), openIssues: number(raw.open_issues_count),
    ...(merges ? { openPullRequests: totalCount(merges.headers, merges.body) ?? 0 } : {}),
    ...(date(raw.last_activity_at) ? { updatedAt: date(raw.last_activity_at) } : {}),
    ...(pipeline.status ? { checks: { state: pipelineState(pipeline.status), ...(string(pipeline.ref) ? { branch: string(pipeline.ref).slice(0, 80) } : {}), ...(safeUrl(pipeline.web_url) ? { url: safeUrl(pipeline.web_url) } : {}), ...(date(pipeline.updated_at) ? { at: date(pipeline.updated_at) } : {}) } } : {}),
    ...(string(latest.tag_name) ? { release: { tag: string(latest.tag_name).slice(0, 60), ...(safeUrl(object(latest._links).self) ? { url: safeUrl(object(latest._links).self) } : {}), ...(date(latest.released_at) ? { at: date(latest.released_at) } : {}) } } : {}),
  };
}

export async function collectGitlab(source: IntegrationInstance): Promise<RepositoriesSummary> {
  const instance = withApi(source);
  const user = object((await forgeJson(instance, '/api/v4/user', auth(instance))).body);
  if (!string(user.username)) throw new ServiceError('widgets.error.parse');
  const [projects, reviews, assigned, todos] = await Promise.all([
    forgeJson(instance, `/api/v4/projects?membership=true&archived=false&order_by=last_activity_at&sort=desc&per_page=${REPOSITORY_LIMIT * 2}`, auth(instance)),
    optional(() => forgeJson(instance, '/api/v4/merge_requests?scope=reviews_for_me&state=opened&per_page=1', auth(instance))),
    optional(() => forgeJson(instance, '/api/v4/issues?scope=assigned_to_me&state=opened&per_page=1', auth(instance))),
    optional(() => forgeJson(instance, '/api/v4/todos?state=pending&per_page=1', auth(instance))),
  ]);
  if (!Array.isArray(projects.body)) throw new ServiceError('widgets.error.parse');
  const repositories = (await Promise.all(array(projects.body).map(object).filter(raw => raw.archived !== true).slice(0, REPOSITORY_LIMIT).map(raw => project(instance, raw)))).filter((repo): repo is ForgeRepository => !!repo);
  return {
    provider: 'gitlab', name: source.name, account: string(user.username).slice(0, 80),
    ...(reviews ? { reviewRequests: totalCount(reviews.headers, reviews.body) } : {}),
    ...(assigned ? { assignedIssues: totalCount(assigned.headers, assigned.body) } : {}),
    ...(todos ? { notifications: totalCount(todos.headers, todos.body) } : {}),
    repositories, fetchedAt: Date.now(),
  };
}

export const gitlabKit: KitServer<RepositoriesSummary> = {
  ttlMs: 300_000,
  collect: collectGitlab,
  test: async source => { const instance = withApi(source); if (!string(object((await forgeJson(instance, '/api/v4/user', auth(instance))).body).username)) throw new ServiceError('widgets.error.parse'); },
  demo: instance => demoRepositories(instance, 'gitlab'),
};
