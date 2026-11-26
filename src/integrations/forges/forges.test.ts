import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceBytes: vi.fn() }));
import { serviceBytes, ServiceError } from '@/lib/widgetData/services';
import { forgejoKit } from '../forgejo/collect';
import { githubKit, runState } from '../github/collect';
import { gitlabKit, pipelineState } from '../gitlab/collect';
import { actionsState, totalCount } from './shared';
import gitea from './samples/gitea.json';

const bytes = vi.mocked(serviceBytes);
type Answer = { body: unknown; status?: number; headers?: Record<string, string> };
/** Answers by path prefix; anything else is a 404. */
function answer(routes: Record<string, Answer>) {
  bytes.mockImplementation(async (_instance, path) => {
    const route = Object.entries(routes).find(([prefix]) => path.startsWith(prefix))?.[1];
    return { bytes: Buffer.from(JSON.stringify(route?.body ?? { message: 'Not Found' })), contentType: 'application/json', status: route?.status ?? (route ? 200 : 404), headers: route?.headers ?? {} };
  });
}
const source = (type: string, settings: Record<string, string> = { url: 'https://forge.example.com' }): IntegrationInstance => ({ id: `${type}-1`, type, name: 'Forge', settings, secrets: { apiKey: 'fake-token' } });
beforeEach(() => vi.resetAllMocks());

describe('Forgejo and Gitea', () => {
  it('reads the repositories, their checks and release, and what waits for the account', async () => {
    answer({
      '/api/v1/user': { body: gitea.user },
      '/api/v1/repos/search': { body: gitea.search },
      '/api/v1/repos/issues/search?type=pulls': { body: [{}], headers: { 'x-total-count': '2' } },
      '/api/v1/repos/issues/search?type=issues': { body: [{}], headers: { 'x-total-count': '3' } },
      '/api/v1/notifications/new': { body: gitea.notifications },
      '/api/v1/repos/homelab/dashboard/actions/tasks': { body: gitea.tasks },
      '/api/v1/repos/homelab/dashboard/releases/latest': { body: gitea.release },
    });
    const summary = await forgejoKit.collect(source('forgejo'));
    expect(summary).toMatchObject({ provider: 'forgejo', account: 'homelab', reviewRequests: 2, assignedIssues: 3, notifications: 5 });
    expect(summary.repositories).toEqual([
      { id: '31', name: 'homelab/dashboard', url: 'https://forge.example.com/homelab/dashboard', stars: 12, openIssues: 3, openPullRequests: 1, updatedAt: Date.parse('2026-11-26T08:00:00Z'),
        checks: { state: 'running', name: 'ci.yml', branch: 'main', url: 'https://forge.example.com/homelab/dashboard/actions/runs/40', at: Date.parse('2026-11-26T08:01:00Z') },
        release: { tag: 'v2.4.0', url: 'https://forge.example.com/homelab/dashboard/releases/tag/v2.4.0', at: Date.parse('2026-11-20T10:00:00Z') } },
      { id: '33', name: 'homelab/infra', url: 'https://forge.example.com/homelab/infra', private: true, mirror: true, stars: 0, openIssues: 0, openPullRequests: 0, updatedAt: Date.parse('2026-11-25T08:00:00Z') },
    ]);
    for (const [, , options] of bytes.mock.calls) expect(options?.headers).toMatchObject({ Authorization: 'token fake-token' });
    // Archived repositories and those without Actions or releases are not asked about.
    expect(bytes.mock.calls.map(([, path]) => path).filter(path => path.includes('/infra/') || path.includes('/old-scripts'))).toEqual([]);
  });
  it('fails clearly with a refused token', async () => {
    answer({ '/api/v1/user': { body: { message: 'token is required' }, status: 401 } });
    await expect(forgejoKit.test(source('forgejo'))).rejects.toThrow(ServiceError);
  });
});

describe('GitHub', () => {
  it('reads github.com by default, with pull requests counted apart from issues', async () => {
    answer({
      '/user/repos': { body: [{ id: 1, full_name: 'homelab/dashboard', html_url: 'https://github.com/homelab/dashboard', pushed_at: '2026-11-26T08:00:00Z', stargazers_count: 40, open_issues_count: 9, private: false, fork: false, archived: false }] },
      '/user': { body: { login: 'homelab' } },
      '/search/issues?q=is%3Apr': { body: { total_count: 1, items: [] } },
      '/search/issues?q=is%3Aissue': { body: { total_count: 4, items: [] } },
      '/notifications': { body: [{}, {}] },
      '/repos/homelab/dashboard/pulls': { body: [{}], headers: { link: '<https://api.github.com/repositories/1/pulls?state=open&per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1/pulls?state=open&per_page=1&page=3>; rel="last"' } },
      '/repos/homelab/dashboard/actions/runs': { body: { total_count: 1, workflow_runs: [{ name: 'CI', status: 'completed', conclusion: 'failure', head_branch: 'main', html_url: 'https://github.com/homelab/dashboard/actions/runs/1', updated_at: '2026-11-26T08:05:00Z' }] } },
    });
    const summary = await githubKit.collect(source('github', {}));
    expect(summary).toMatchObject({ provider: 'github', account: 'homelab', reviewRequests: 1, assignedIssues: 4, notifications: 2 });
    expect(summary.repositories[0]).toMatchObject({ name: 'homelab/dashboard', stars: 40, openIssues: 6, openPullRequests: 3, checks: { state: 'failure', name: 'CI' } });
    expect(summary.repositories[0]).not.toHaveProperty('release');
    expect(bytes.mock.calls[0][0].settings.url).toBe('https://api.github.com');
    expect(bytes.mock.calls[0][2]?.headers).toMatchObject({ Authorization: 'Bearer fake-token', 'X-GitHub-Api-Version': '2022-11-28' });
  });
  it('maps run states', () => {
    expect(runState('in_progress', null)).toBe('running');
    expect(runState('queued', null)).toBe('pending');
    expect(runState('completed', 'timed_out')).toBe('failure');
    expect(runState('completed', 'neutral')).toBe('success');
  });
});

describe('GitLab', () => {
  it('reads projects, merge requests and pipelines with the private token', async () => {
    answer({
      '/api/v4/user': { body: { username: 'homelab' } },
      '/api/v4/projects?': { body: [{ id: 5, path_with_namespace: 'homelab/infra', web_url: 'https://gitlab.com/homelab/infra', star_count: 2, open_issues_count: 4, visibility: 'private', last_activity_at: '2026-11-26T08:00:00Z' }] },
      '/api/v4/projects/5/merge_requests': { body: [{}], headers: { 'x-total': '2' } },
      '/api/v4/projects/5/pipelines': { body: [{ status: 'success', ref: 'main', web_url: 'https://gitlab.com/homelab/infra/-/pipelines/9', updated_at: '2026-11-26T08:10:00Z' }] },
      '/api/v4/projects/5/releases': { body: [{ tag_name: 'v1.0.0', released_at: '2026-11-01T00:00:00Z', _links: { self: 'https://gitlab.com/homelab/infra/-/releases/v1.0.0' } }] },
      '/api/v4/merge_requests': { body: [], headers: { 'x-total': '0' } },
      '/api/v4/issues': { body: [{}], headers: { 'x-total': '1' } },
      '/api/v4/todos': { body: [{}], headers: { 'x-total': '6' } },
    });
    const summary = await gitlabKit.collect(source('gitlab', {}));
    expect(summary).toMatchObject({ provider: 'gitlab', account: 'homelab', reviewRequests: 0, assignedIssues: 1, notifications: 6 });
    expect(summary.repositories[0]).toMatchObject({ name: 'homelab/infra', private: true, openIssues: 4, openPullRequests: 2, checks: { state: 'success', branch: 'main' }, release: { tag: 'v1.0.0' } });
    expect(bytes.mock.calls[0][2]?.headers).toMatchObject({ 'PRIVATE-TOKEN': 'fake-token' });
    expect(bytes.mock.calls[0][0].settings.url).toBe('https://gitlab.com');
  });
  it('maps pipeline states', () => {
    expect(pipelineState('failed')).toBe('failure');
    expect(pipelineState('waiting_for_resource')).toBe('pending');
    expect(pipelineState('canceled')).toBe('cancelled');
  });
});

describe('forges, shared', () => {
  it('reads totals from headers', () => {
    expect(totalCount({ 'x-total-count': '12' }, [])).toBe(12);
    expect(totalCount({ link: '<https://api.github.com/x?page=7>; rel="last"' }, [])).toBe(7);
    expect(totalCount({}, [{}, {}])).toBe(2);
    expect(actionsState('blocked')).toBe('pending');
    expect(actionsState('failure')).toBe('failure');
  });
});
