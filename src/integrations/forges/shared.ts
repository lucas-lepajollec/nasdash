import type { IntegrationInstance } from '@/lib/types';
import type { ForgeRepository, RepositoriesSummary } from '@/lib/widgetData/contracts';
import { assertStatus, serviceBytes, ServiceError } from '@/lib/widgetData/services';

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
  const repo = (name: string, extra: Partial<ForgeRepository>, hoursAgo: number): ForgeRepository => ({ id: name, name: `homelab/${name}`, url: `${base}/homelab/${name}`, updatedAt: now - hoursAgo * hour, ...extra });
  return {
    provider, name: instance.name, account: 'homelab', reviewRequests: 2, assignedIssues: 3, notifications: provider === 'gitlab' ? 4 : 5,
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
