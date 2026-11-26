'use client';

import React from 'react';
import { Bell, CircleDot, Copy, GitFork, GitPullRequest, Lock, MessageSquareCode, Tag } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { ForgeRepository, RepositoriesSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { KitWidget } from '@/components/widgets/content/KitWidget';
import { bounded, useRelativeTime, useShowMore } from '@/components/widgets/content/kit';

export const ROWS = { min: 2, max: 12, default: 6 } as const;

/** The repositories a widget lists: forks and mirrors only when asked. */
export function shownRepositories(repositories: ForgeRepository[], settings: WidgetSettings): ForgeRepository[] {
  return settings.forks === false ? repositories.filter(repo => !repo.fork && !repo.mirror) : repositories;
}

/**
 * Forgejo, Gitea, GitHub or GitLab: what waits for the account (reviews asked,
 * issues assigned, notifications), then its repositories by latest activity,
 * each with the state of its latest CI run, its open pull requests and issues
 * and its latest release.
 */
export default function CalmeRepositories(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <KitWidget<RepositoriesSummary> widget="repositories" refreshMs={300_000} skeleton={[24, 40, 40, 40]} {...props}
      extraSettings={(draft, change) => (
        <>
          <CalmeRow label={t('widgets.repos.rows')} stacked>
            <CalmeSlider label={t('widgets.repos.rows')} min={ROWS.min} max={ROWS.max} step={1} value={bounded(draft.rows, ROWS.min, ROWS.max, ROWS.default)}
              onChange={value => change({ rows: value })} onCommit={value => change({ rows: value === ROWS.default ? null : value })} format={String} />
          </CalmeRow>
          <CalmeRow label={t('widgets.repos.showForks')}>
            <CalmeSwitch label={t('widgets.repos.showForks')} checked={draft.forks !== false} onChange={on => change({ forks: on ? null : false })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.repos.showWaiting')} info={t('widgets.repos.showWaitingHint')}>
            <CalmeSwitch label={t('widgets.repos.showWaiting')} checked={draft.waiting !== false} onChange={on => change({ waiting: on ? null : false })} />
          </CalmeRow>
        </>
      )}>
      {data => <Repositories data={data} settings={props.settings} />}
    </KitWidget>
  );
}

function Repositories({ data, settings }: { data: RepositoriesSummary; settings: WidgetSettings }) {
  const { t } = useI18n();
  const [shown, more] = useShowMore(shownRepositories(data.repositories, settings), bounded(settings.rows, ROWS.min, ROWS.max, ROWS.default));
  const waiting = ([
    ['reviews', data.reviewRequests, <MessageSquareCode key="reviews" size={12} aria-hidden="true" />],
    ['assigned', data.assignedIssues, <CircleDot key="assigned" size={12} aria-hidden="true" />],
    ['notifications', data.notifications, <Bell key="notifications" size={12} aria-hidden="true" />],
  ] as const).filter(([, count]) => count !== undefined);
  return (
    <div className="ndw-kit ndw-repo">
      {settings.waiting !== false && (waiting.length > 0 || data.account) && (
        <div className="ndw-repo-head">
          {data.account && <span className="ndw-media-sub">{data.account}</span>}
          {waiting.map(([id, count, icon]) => (
            <span key={id} className={`ndw-repo-count ${count ? 'is-on' : ''}`} title={t(`widgets.repos.${id}`, { count: count ?? 0 })}>
              {icon}<span>{count}</span><span className="ndw-repo-count-word">{t(`widgets.repos.${id}Short`)}</span>
            </span>
          ))}
        </div>
      )}
      {shown.length === 0
        ? <span className="ndw-media-sub is-quiet">{t('widgets.repos.none')}</span>
        : <ul className="ndw-repo-list">{shown.map(repo => <Repository key={repo.id} repo={repo} account={data.account} />)}</ul>}
      {more}
    </div>
  );
}

/** The owner is named only when it is not the account itself (an organisation, someone else's repository). */
function Repository({ repo, account }: { repo: ForgeRepository; account?: string }) {
  const { t } = useI18n();
  const ago = useRelativeTime();
  const [owner, ...rest] = repo.name.split('/');
  const name = rest.join('/') || owner;
  const checks = repo.checks;
  const checksTitle = checks ? [t(`widgets.repos.checks.${checks.state}`), checks.name, checks.branch].filter(Boolean).join(' · ') : t('widgets.repos.noChecks');
  const dot = <span className={`ndw-repo-dot ${checks ? `is-${checks.state}` : ''}`} title={checksTitle} aria-label={checksTitle} role="img" />;
  return (
    <li className="ndw-repo-row">
      {checks?.url ? <a className="ndw-repo-dot-link" href={checks.url} target="_blank" rel="noreferrer noopener">{dot}</a> : dot}
      <span className="ndw-repo-main">
        <span className="ndw-repo-name">
          {repo.url ? <a href={repo.url} target="_blank" rel="noreferrer noopener" title={repo.name}>{rest.length && owner.toLowerCase() !== account?.toLowerCase() ? <><span className="ndw-repo-owner">{owner}/</span>{name}</> : name}</a> : <span title={repo.name}>{name}</span>}
          {repo.private && <Lock size={11} className="ndw-repo-flag" aria-label={t('widgets.repos.private')} />}
          {repo.fork && <GitFork size={11} className="ndw-repo-flag" aria-label={t('widgets.repos.fork')} />}
          {repo.mirror && <Copy size={11} className="ndw-repo-flag" aria-label={t('widgets.repos.mirror')} />}
        </span>
        <span className="ndw-repo-sub">
          {repo.release && (repo.release.url
            ? <a className="ndw-repo-release" href={repo.release.url} target="_blank" rel="noreferrer noopener"><Tag size={10} aria-hidden="true" />{repo.release.tag}</a>
            : <span className="ndw-repo-release"><Tag size={10} aria-hidden="true" />{repo.release.tag}</span>)}
          {repo.updatedAt && <span className="ndw-repo-when">{ago(repo.updatedAt)}</span>}
        </span>
      </span>
      <span className="ndw-repo-side">
        {repo.openPullRequests !== undefined && <span className={`ndw-repo-stat ${repo.openPullRequests ? '' : 'is-zero'}`} title={t('widgets.repos.pulls', { count: repo.openPullRequests })}><GitPullRequest size={12} aria-hidden="true" />{repo.openPullRequests}</span>}
        {repo.openIssues !== undefined && <span className={`ndw-repo-stat ${repo.openIssues ? '' : 'is-zero'}`} title={t('widgets.repos.issues', { count: repo.openIssues })}><CircleDot size={12} aria-hidden="true" />{repo.openIssues}</span>}
      </span>
    </li>
  );
}
