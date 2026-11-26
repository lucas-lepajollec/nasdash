import type { IntegrationInstance } from '@/lib/types';
import type { ForgeActivity, ForgeRepository, RepositoriesSummary } from '@/lib/widgetData/contracts';
import { assertStatus, date, serviceBytes, ServiceError, string } from '@/lib/widgetData/services';

/**
 * What the four forges share: bounded JSON with the answer's headers (counts
 * come from `x-total-count` / `x-total` / `Link`), the CI states mapped to one
 * vocabulary, how many repositories are read, and the fictional demo.
 */
export const REPOSITORY_LIMIT = 12;
export type ChecksState = NonNullable<ForgeRepository['checks']>['state'];

export async function forgeJson<T = unknown>(instance: IntegrationInstance, path: string, headers: Record<string, string>): Promise<{ body: T; headers: Record<string, string | string[] | undefined> }> {
  const answer = await serviceBytes(instance, path, { headers: { Accept: 'application/json', ...headers } }, 4 * 1024 * 1024);
  assertStatus(answer.status);
  try { return { body: JSON.parse(answer.bytes.toString('utf8') || 'null') as T, headers: answer.headers ?? {} }; }
  catch { throw new ServiceError('widgets.error.parse'); }
}
/** A request whose 404 means "none" (no release, no CI on this repository): undefined. */
export async function optional<T>(read: () => Promise<T>): Promise<T | undefined> {
  try { return await read(); }
  catch (error) { if (error instanceof ServiceError && (error.parameters?.status === 404 || error.parameters?.status === 403 || error.parameters?.status === 409)) return undefined; throw error; }
}
const header = (headers: Record<string, string | string[] | undefined>, name: string) => { const value = headers[name]; return Array.isArray(value) ? value[0] : value; };
/** The total a paginated answer gives in its headers, with one item per page asked. */
export function totalCount(headers: Record<string, string | string[] | undefined>, items: unknown): number | undefined {
  for (const name of ['x-total-count', 'x-total']) {
    const value = Number(header(headers, name));
    if (Number.isFinite(value) && value >= 0) return value;
  }
  // GitHub: `Link: <…&page=37>; rel="last"` with per_page=1 is the count; no `last` link means this page is all.
  const last = /<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/.exec(header(headers, 'link') ?? '');
  if (last) return Number(last[1]);
  return Array.isArray(items) ? items.length : undefined;
}
export const safeUrl = (value: unknown) => { try { const url = new URL(String(value)); return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined; } catch { return undefined; } };

/** POST with a JSON body (GitHub GraphQL), same limits as `forgeJson`. */
export async function forgePost<T = unknown>(instance: IntegrationInstance, path: string, headers: Record<string, string>, json: unknown): Promise<T> {
  const answer = await serviceBytes(instance, path, { method: 'POST', headers: { Accept: 'application/json', ...headers }, json }, 4 * 1024 * 1024);
  assertStatus(answer.status);
  try { return JSON.parse(answer.bytes.toString('utf8') || 'null') as T; }
  catch { throw new ServiceError('widgets.error.parse'); }
}

/** The activity grid covers 53 weeks, like the forges' own. */
export const ACTIVITY_DAYS = 371;
const DAY = 86_400_000;
/** YYYY-MM-DD in NasDash's own time zone. */
export function localDay(time: number): string {
  const day = new Date(time);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}
/** Contributions keyed by day → the last 53 weeks ending today; undefined when the forge gave nothing. */
export function toActivity(byDay: Map<string, number>, now = Date.now()): ForgeActivity | undefined {
  if (byDay.size === 0) return undefined;
  const days: number[] = [];
  for (let index = ACTIVITY_DAYS - 1; index >= 0; index--) days.push(Math.max(0, Math.round(byDay.get(localDay(now - index * DAY)) ?? 0)));
  return { end: localDay(now), days };
}
/** First line of a commit message, its author and date. */
export function commitOf(message: unknown, author: unknown, at: unknown): ForgeRepository['lastCommit'] {
  const first = string(message).split('\n')[0].trim().slice(0, 140);
  if (!first) return undefined;
  return { message: first, ...(string(author) ? { author: string(author).slice(0, 60) } : {}), ...(date(at) ? { at: date(at) } : {}) };
}
/** Extras (activity, last commit) never break the widget: any failure is "not shown". */
export const quietly = <T>(read: () => Promise<T>): Promise<T | undefined> => read().catch(() => undefined);

/** Forgejo / Gitea Actions statuses (`success`, `failure`, `cancelled`, `skipped`, `running`, `waiting`, `blocked`). */
export function actionsState(status: unknown): ChecksState {
  const value = String(status ?? '').toLowerCase();
  if (value === 'success') return 'success';
  if (value === 'failure' || value === 'error') return 'failure';
  if (value === 'cancelled') return 'cancelled';
  if (value === 'skipped') return 'skipped';
  if (value === 'running') return 'running';
  return 'pending';
}

export function demoRepositories(instance: IntegrationInstance, provider: RepositoriesSummary['provider']): RepositoriesSummary {
  const now = Date.now(), hour = 3_600_000;
  const base = provider === 'github' ? 'https://github.com' : provider === 'gitlab' ? 'https://gitlab.com' : 'https://forge.example.com';
  const repo = (name: string, extra: Partial<ForgeRepository>, hoursAgo: number): ForgeRepository => ({ id: name, name: `homelab/${name}`, url: `${base}/homelab/${name}`, updatedAt: now - hoursAgo * hour, lastCommit: { message: commits[name][0], author: commits[name][1], at: now - commits[name][2] * hour }, ...extra });
  const commits: Record<string, [string, string, number]> = {
    dashboard: ['Add a compact layout to the calendar', 'Alex', 0.2],
    infrastructure: ['Move backups to the new pool', 'Sam', 2],
    'backup-scripts': ['Rotate logs every week', 'Alex', 6],
    'photo-tools': ['Release 1.2.1', 'Robin', 26],
    wiki: ['Document the shutdown order of the UPS', 'Sam', 72],
    dotfiles: ['Use the new prompt everywhere', 'Alex', 140],
  };
  // A steady, believable year: busier on weekdays, quieter in summer; the same for every visitor on a given day.
  let seed = Math.floor(now / DAY);
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const byDay = new Map<string, number>();
  for (let index = 0; index < ACTIVITY_DAYS; index++) {
    const time = now - index * DAY, weekday = new Date(time).getDay(), weekend = weekday === 0 || weekday === 6;
    const busy = 0.55 + 0.3 * Math.sin(index / 40);
    byDay.set(localDay(time), index === 0 ? 4 : random() < (weekend ? 0.3 : busy) ? Math.floor(random() * (weekend ? 4 : 11)) : 0);
  }
  return {
    provider, name: instance.name, account: 'homelab', activity: toActivity(byDay, now), reviewRequests: 2, assignedIssues: 3, notifications: provider === 'gitlab' ? 4 : 5,
    repositories: [
      repo('dashboard', { stars: 128, openIssues: 7, openPullRequests: 2, checks: { state: 'running', name: 'CI', branch: 'main', at: now - 4 * 60_000 }, release: { tag: 'v2.4.0', at: now - 3 * 24 * hour } }, 0.2),
      repo('infrastructure', { private: true, openIssues: 3, openPullRequests: 1, checks: { state: 'success', name: 'Deploy', branch: 'main', at: now - 2 * hour } }, 2),
      repo('backup-scripts', { private: true, openIssues: 0, openPullRequests: 0, checks: { state: 'failure', name: 'Lint', branch: 'renovate/node-22', at: now - 6 * hour } }, 6),
      repo('photo-tools', { stars: 41, openIssues: 5, openPullRequests: 0, checks: { state: 'success', name: 'Tests', branch: 'main', at: now - 26 * hour }, release: { tag: 'v1.2.1', at: now - 9 * 24 * hour } }, 26),
      repo('wiki', { openIssues: 1, openPullRequests: 0 }, 72),
      repo('dotfiles', { fork: true, stars: 3, openIssues: 0, openPullRequests: 0 }, 140),
    ],
    fetchedAt: now,
  };
}
