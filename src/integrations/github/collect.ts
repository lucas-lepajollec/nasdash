import type { IntegrationInstance } from '@/lib/types';
import type { ForgeRepository, RepositoriesSummary } from '@/lib/widgetData/contracts';
import { array, date, number, object, string, ServiceError } from '@/lib/widgetData/services';
import type { KitServer } from '../kitServer';
import { demoRepositories, forgeJson, optional, REPOSITORY_LIMIT, safeUrl, totalCount, type ChecksState } from '../forges/shared';

/**
 * GitHub REST API (docs.github.com/rest, checked 2026-11-26): a personal access
 * token as `Authorization: Bearer`, `X-GitHub-Api-Version: 2022-11-28`. The
 * account `GET /user`; repositories `GET /user/repos?sort=pushed` (`full_name`,
 * `html_url`, `pushed_at`, `stargazers_count`, `open_issues_count` counting pull
 * requests too, `private`, `fork`, `archived`); per repository the open pull
 * requests `GET …/pulls?state=open&per_page=1` (the `Link` header's last page),
 * the latest workflow run `GET …/actions/runs?per_page=1` (`status`,
 * `conclusion`, `name`, `head_branch`, `html_url`) and release
 * `GET …/releases/latest` (404: none). What waits for the account: the search
 * `is:pr is:open review-requested:@me` and `is:issue is:open assignee:@me`
 * (`total_count`, 30 searches a minute), and unread notifications
 * `GET /notifications` (classic tokens only). About 40 requests every five
 * minutes, well within 5,000 an hour.
 */
const API = 'https://api.github.com';
const withApi = (instance: IntegrationInstance): IntegrationInstance => (instance.settings.url ?? '').trim() ? instance : { ...instance, settings: { ...instance.settings, url: API } };
const auth = (instance: IntegrationInstance) => ({ Authorization: `Bearer ${instance.secrets?.apiKey ?? ''}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
const repoPath = (fullName: string) => fullName.split('/').map(encodeURIComponent).join('/');

export function runState(status: unknown, conclusion: unknown): ChecksState {
  if (status !== 'completed') return status === 'in_progress' ? 'running' : 'pending';
  switch (conclusion) {
    case 'success': case 'neutral': return 'success';
    case 'cancelled': return 'cancelled';
    case 'skipped': case 'stale': return 'skipped';
    case 'action_required': return 'pending';
    default: return 'failure';
  }
}

async function repository(instance: IntegrationInstance, raw: Record<string, unknown>): Promise<ForgeRepository | undefined> {
  const fullName = string(raw.full_name);
  if (!fullName.includes('/')) return undefined;
  const path = `/repos/${repoPath(fullName)}`;
  const [pulls, runs, release] = await Promise.all([
    optional(() => forgeJson(instance, `${path}/pulls?state=open&per_page=1`, auth(instance))),
    optional(() => forgeJson(instance, `${path}/actions/runs?per_page=1`, auth(instance))),
    optional(() => forgeJson(instance, `${path}/releases/latest`, auth(instance))),
  ]);
  const pullCount = pulls ? totalCount(pulls.headers, pulls.body) ?? 0 : undefined;
  const run = object(array(object(runs?.body).workflow_runs)[0]);
  const latest = object(release?.body);
  return {
    id: String(number(raw.id) || fullName), name: fullName.slice(0, 160), url: safeUrl(raw.html_url) ?? '',
    ...(raw.private === true ? { private: true } : {}), ...(raw.fork === true ? { fork: true } : {}),
    stars: number(raw.stargazers_count),
    // GitHub counts pull requests among open issues.
    openIssues: Math.max(0, number(raw.open_issues_count) - (pullCount ?? 0)),
    ...(pullCount !== undefined ? { openPullRequests: pullCount } : {}),
    ...(date(raw.pushed_at) ? { updatedAt: date(raw.pushed_at) } : {}),
    ...(run.status ? { checks: { state: runState(run.status, run.conclusion), ...(string(run.name) ? { name: string(run.name).slice(0, 80) } : {}), ...(string(run.head_branch) ? { branch: string(run.head_branch).slice(0, 80) } : {}), ...(safeUrl(run.html_url) ? { url: safeUrl(run.html_url) } : {}), ...(date(run.updated_at) ? { at: date(run.updated_at) } : {}) } } : {}),
    ...(string(latest.tag_name) ? { release: { tag: string(latest.tag_name).slice(0, 60), ...(safeUrl(latest.html_url) ? { url: safeUrl(latest.html_url) } : {}), ...(date(latest.published_at) ? { at: date(latest.published_at) } : {}) } } : {}),
  };
}

export async function collectGithub(source: IntegrationInstance): Promise<RepositoriesSummary> {
  const instance = withApi(source);
  const user = object((await forgeJson(instance, '/user', auth(instance))).body);
  if (!string(user.login)) throw new ServiceError('widgets.error.parse');
  const [repos, reviews, assigned, notifications] = await Promise.all([
    forgeJson(instance, `/user/repos?sort=pushed&per_page=${REPOSITORY_LIMIT * 2}`, auth(instance)),
    optional(() => forgeJson(instance, `/search/issues?q=${encodeURIComponent('is:pr is:open review-requested:@me')}&per_page=1`, auth(instance))),
    optional(() => forgeJson(instance, `/search/issues?q=${encodeURIComponent('is:issue is:open assignee:@me')}&per_page=1`, auth(instance))),
    optional(() => forgeJson(instance, '/notifications?per_page=50', auth(instance))),
  ]);
  if (!Array.isArray(repos.body)) throw new ServiceError('widgets.error.parse');
  const repositories = (await Promise.all(array(repos.body).map(object).filter(raw => raw.archived !== true).slice(0, REPOSITORY_LIMIT).map(raw => repository(instance, raw)))).filter((repo): repo is ForgeRepository => !!repo);
  const reviewCount = object(reviews?.body).total_count, assignedCount = object(assigned?.body).total_count;
  return {
    provider: 'github', name: source.name, account: string(user.login).slice(0, 80),
    ...(typeof reviewCount === 'number' ? { reviewRequests: number(reviewCount) } : {}),
    ...(typeof assignedCount === 'number' ? { assignedIssues: number(assignedCount) } : {}),
    ...(notifications && Array.isArray(notifications.body) ? { notifications: notifications.body.length } : {}),
    repositories, fetchedAt: Date.now(),
  };
}

export const githubKit: KitServer<RepositoriesSummary> = {
  ttlMs: 300_000,
  collect: collectGithub,
  test: async source => { const instance = withApi(source); if (!string(object((await forgeJson(instance, '/user', auth(instance))).body).login)) throw new ServiceError('widgets.error.parse'); },
  demo: instance => demoRepositories(instance, 'github'),
};
