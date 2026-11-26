import type { IntegrationInstance } from '@/lib/types';
import type { ForgeRepository, RepositoriesSummary } from '@/lib/widgetData/contracts';
import { array, date, number, object, string, ServiceError } from '@/lib/widgetData/services';
import { actionsState, commitOf, forgeJson, localDay, optional, quietly, REPOSITORY_LIMIT, safeUrl, toActivity, totalCount } from './shared';

/**
 * Forgejo and Gitea, REST API v1 (their swagger.v1.json: Forgejo 15, Gitea 1.25+,
 * checked 2026-11-26). `Authorization: token <access token>` (read scopes:
 * user, repository, issue, notification). The account `GET /api/v1/user`;
 * its repositories `GET /api/v1/repos/search?uid=&sort=updated&order=desc`
 * (`data[]`: `full_name`, `html_url`, `updated_at`, `stars_count`,
 * `open_issues_count`, `open_pr_counter`, `release_counter`, `private`,
 * `fork`, `mirror`, `archived`, `has_actions`); per repository the latest
 * Actions run `GET …/actions/tasks?limit=1` (`workflow_runs[]`: `status`,
 * `name`, `head_branch`, `url`, `updated_at`) and release
 * `GET …/releases/latest`. What waits for the account:
 * `GET /api/v1/repos/issues/search?type=pulls&state=open&review_requested=true`
 * and `type=issues&assigned=true` (`x-total-count`), unread notifications
 * `GET /api/v1/notifications/new` (`{ new }`). The latest commit
 * `GET …/commits?limit=1&stat=false&verification=false&files=false`
 * (`commit.message`, `commit.author.name|date`) and the account's activity
 * `GET /api/v1/users/{login}/heatmap` (`[{ timestamp, contributions }]`, a
 * timestamp per quarter hour; absent when the instance turned heatmaps off).
 */
const auth = (instance: IntegrationInstance) => ({ Authorization: `token ${instance.secrets?.apiKey ?? ''}` });
const repoPath = (fullName: string) => fullName.split('/').map(encodeURIComponent).join('/');

async function repository(instance: IntegrationInstance, raw: Record<string, unknown>): Promise<ForgeRepository | undefined> {
  const fullName = string(raw.full_name);
  if (!fullName.includes('/') || raw.archived === true) return undefined;
  const path = `/api/v1/repos/${repoPath(fullName)}`;
  const [tasks, release, commits] = await Promise.all([
    raw.has_actions === false ? undefined : optional(() => forgeJson(instance, `${path}/actions/tasks?limit=1`, auth(instance))),
    number(raw.release_counter) > 0 || raw.release_counter === undefined ? optional(() => forgeJson(instance, `${path}/releases/latest`, auth(instance))) : undefined,
    raw.empty === true ? undefined : quietly(() => forgeJson(instance, `${path}/commits?limit=1&stat=false&verification=false&files=false`, auth(instance))),
  ]);
  const head = object(array(commits?.body)[0]), headCommit = object(head.commit), headAuthor = object(headCommit.author);
  const lastCommit = commitOf(headCommit.message, string(object(head.author).login) || headAuthor.name, headAuthor.date);
  const run = object(array(object(tasks?.body).workflow_runs)[0]);
  const latest = object(release?.body);
  return {
    id: String(number(raw.id) || fullName), name: fullName.slice(0, 160), url: safeUrl(raw.html_url) ?? '',
    ...(raw.private === true ? { private: true } : {}), ...(raw.fork === true ? { fork: true } : {}), ...(raw.mirror === true ? { mirror: true } : {}),
    stars: number(raw.stars_count), openIssues: number(raw.open_issues_count), openPullRequests: number(raw.open_pr_counter),
    ...(date(raw.updated_at) ? { updatedAt: date(raw.updated_at) } : {}),
    ...(run.status ? { checks: { state: actionsState(run.status), ...(string(run.name) ? { name: string(run.name).slice(0, 80) } : {}), ...(string(run.head_branch) ? { branch: string(run.head_branch).slice(0, 80) } : {}), ...(safeUrl(run.url) ? { url: safeUrl(run.url) } : {}), ...(date(run.updated_at) ? { at: date(run.updated_at) } : {}) } } : {}),
    ...(string(latest.tag_name) ? { release: { tag: string(latest.tag_name).slice(0, 60), ...(safeUrl(latest.html_url) ? { url: safeUrl(latest.html_url) } : {}), ...(date(latest.published_at) ? { at: date(latest.published_at) } : {}) } } : {}),
    ...(lastCommit ? { lastCommit } : {}),
  };
}

/** The heatmap's quarter-hour entries summed per local day. */
export function giteaActivity(entries: unknown, now = Date.now()) {
  const byDay = new Map<string, number>();
  for (const entry of array(entries).map(object)) {
    const seconds = number(entry.timestamp), count = number(entry.contributions);
    if (seconds > 0 && count > 0) byDay.set(localDay(seconds * 1000), (byDay.get(localDay(seconds * 1000)) ?? 0) + count);
  }
  return toActivity(byDay, now);
}

export async function collectGiteaLike(instance: IntegrationInstance, provider: 'forgejo' | 'gitea'): Promise<RepositoriesSummary> {
  const user = object((await forgeJson(instance, '/api/v1/user', auth(instance))).body);
  const uid = number(user.id);
  if (!uid || !string(user.login)) throw new ServiceError('widgets.error.parse');
  const [search, reviews, assigned, unread, heatmap] = await Promise.all([
    forgeJson(instance, `/api/v1/repos/search?uid=${uid}&sort=updated&order=desc&limit=${REPOSITORY_LIMIT * 2}`, auth(instance)),
    optional(() => forgeJson(instance, '/api/v1/repos/issues/search?type=pulls&state=open&review_requested=true&limit=1', auth(instance))),
    optional(() => forgeJson(instance, '/api/v1/repos/issues/search?type=issues&state=open&assigned=true&limit=1', auth(instance))),
    optional(() => forgeJson(instance, '/api/v1/notifications/new', auth(instance))),
    quietly(() => forgeJson(instance, `/api/v1/users/${encodeURIComponent(string(user.login))}/heatmap`, auth(instance))),
  ]);
  const list = object(search.body).data;
  if (!Array.isArray(list)) throw new ServiceError('widgets.error.parse');
  const repositories = (await Promise.all(array(list).map(object).filter(raw => raw.archived !== true).slice(0, REPOSITORY_LIMIT).map(raw => repository(instance, raw)))).filter((repo): repo is ForgeRepository => !!repo);
  const unreadCount = object(unread?.body).new;
  return {
    provider, name: instance.name, account: string(user.login).slice(0, 80),
    ...(reviews ? { reviewRequests: totalCount(reviews.headers, reviews.body) } : {}),
    ...(assigned ? { assignedIssues: totalCount(assigned.headers, assigned.body) } : {}),
    ...(typeof unreadCount === 'number' ? { notifications: number(unreadCount) } : {}),
    repositories, fetchedAt: Date.now(),
    ...(heatmap && giteaActivity(heatmap.body) ? { activity: giteaActivity(heatmap.body) } : {}),
  };
}
export const testGiteaLike = async (instance: IntegrationInstance) => {
  const user = object((await forgeJson(instance, '/api/v1/user', auth(instance))).body);
  if (!string(user.login)) throw new ServiceError('widgets.error.parse');
};
