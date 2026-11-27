'use client';

import React, { useMemo } from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { ForgeActivity, ForgeRepository, RepositoriesSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSegmented, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { KitWidget } from '@/components/widgets/content/KitWidget';
import { bounded, pick, useBoxWidth, useRelativeTime, useShowMore } from '@/components/widgets/content/kit';
import { Stat } from '@/components/widgets/media/visual';

export const ROWS = { min: 2, max: 12, default: 6 } as const;
const SHOWS = ['both', 'activity', 'repositories'] as const;
/** Activity squares: between 9 and 14 px, 3 px apart; the grid spans the widget's width. */
const CELL = 9, MAX_CELL = 14, GAP = 3;

/** The repositories a widget lists: forks and mirrors only when asked. */
export function shownRepositories(repositories: ForgeRepository[], settings: WidgetSettings): ForgeRepository[] {
  return settings.forks === false ? repositories.filter(repo => !repo.fork && !repo.mirror) : repositories;
}

/** How many whole weeks fit a width, between two months and a year. */
export function weeksThatFit(width: number): number {
  return Math.max(8, Math.min(53, Math.floor((width + GAP) / (CELL + GAP))));
}
/** The square size that makes those weeks span the width. */
export function cellSize(width: number, weeks: number): number {
  return Math.max(CELL, Math.min(MAX_CELL, Math.floor((width - (weeks - 1) * GAP) / weeks)));
}

/**
 * The last `weeks` weeks of an activity, Monday first, ending on its last day:
 * each day's count, date and intensity (0 none, 1–4 by quarter of the busiest day).
 */
export function activityGrid(activity: ForgeActivity, weeks: number): { count: number; date: Date; level: number }[] {
  const [year, month, day] = activity.end.split('-').map(Number);
  const end = new Date(year, month - 1, day);
  const cells = Math.min(activity.days.length, (weeks - 1) * 7 + ((end.getDay() + 6) % 7) + 1);
  const shown = activity.days.slice(-cells);
  const busiest = Math.max(1, ...shown);
  return shown.map((count, index) => ({
    count,
    date: new Date(year, month - 1, day - (cells - 1 - index)),
    level: count <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / busiest) * 4))),
  }));
}

/** Days in a row with at least one contribution, up to today (or yesterday, when today is still empty). */
export function activityStreak(days: number[]): number {
  let index = days.length - 1;
  if (index >= 0 && days[index] === 0) index--;
  let streak = 0;
  for (; index >= 0 && days[index] > 0; index--) streak++;
  return streak;
}

/**
 * Forgejo, Gitea, GitHub or GitLab: the account's activity as a grid of days,
 * what waits for it (reviews asked, issues assigned, notifications), then its
 * repositories by latest activity with their latest commit, CI state and
 * release. Colour comes from the theme only: its accent and its red.
 */
export default function CalmeRepositories(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <KitWidget<RepositoriesSummary> widget="repositories" refreshMs={300_000} skeleton={[28, 80, 40, 40]} {...props}
      extraSettings={(draft, change) => {
        const show = pick(draft.show, SHOWS, 'both');
        return (
          <>
            <CalmeRow label={t('widgets.repos.show')}>
              <CalmeSegmented label={t('widgets.repos.show')} value={show} options={SHOWS.map(value => ({ value, label: t(`widgets.repos.show.${value}`) }))} onChange={value => change({ show: value === 'both' ? null : value })} />
            </CalmeRow>
            {show !== 'activity' && (
              <>
                <CalmeRow label={t('widgets.repos.rows')} stacked>
                  <CalmeSlider label={t('widgets.repos.rows')} min={ROWS.min} max={ROWS.max} step={1} value={bounded(draft.rows, ROWS.min, ROWS.max, ROWS.default)}
                    onChange={value => change({ rows: value })} onCommit={value => change({ rows: value === ROWS.default ? null : value })} format={String} />
                </CalmeRow>
                <CalmeRow label={t('widgets.repos.showCommits')}>
                  <CalmeSwitch label={t('widgets.repos.showCommits')} checked={draft.commits !== false} onChange={on => change({ commits: on ? null : false })} />
                </CalmeRow>
                <CalmeRow label={t('widgets.repos.showForks')}>
                  <CalmeSwitch label={t('widgets.repos.showForks')} checked={draft.forks !== false} onChange={on => change({ forks: on ? null : false })} />
                </CalmeRow>
                <CalmeRow label={t('widgets.repos.showWaiting')} info={t('widgets.repos.showWaitingHint')}>
                  <CalmeSwitch label={t('widgets.repos.showWaiting')} checked={draft.waiting !== false} onChange={on => change({ waiting: on ? null : false })} />
                </CalmeRow>
              </>
            )}
          </>
        );
      }}>
      {data => <Repositories data={data} settings={props.settings} />}
    </KitWidget>
  );
}

function Repositories({ data, settings }: { data: RepositoriesSummary; settings: WidgetSettings }) {
  const { t } = useI18n();
  const show = pick(settings.show, SHOWS, 'both');
  const [shown, more] = useShowMore(shownRepositories(data.repositories, settings), bounded(settings.rows, ROWS.min, ROWS.max, ROWS.default));
  const waiting = ([
    ['reviews', data.reviewRequests],
    ['assigned', data.assignedIssues],
    ['notifications', data.notifications],
  ] as const).filter((entry): entry is readonly [typeof entry[0], number] => entry[1] !== undefined);
  return (
    <div className="ndw-kit ndw-repo">
      {show !== 'repositories' && (data.activity
        ? <Activity activity={data.activity} />
        : show === 'activity' && <span className="ndw-media-sub is-quiet">{t('widgets.repos.noActivity')}</span>)}
      {show !== 'activity' && settings.waiting !== false && waiting.length > 0 && (
        <div className="ndw-mx-statrow">
          {waiting.map(([id, count]) => <Stat key={id} value={count} label={t(`widgets.repos.${id}Short`)} tone={count ? undefined : 'muted'} />)}
        </div>
      )}
      {show !== 'activity' && (shown.length === 0
        ? <span className="ndw-media-sub is-quiet">{t('widgets.repos.none')}</span>
        : <ul className="ndw-kit-list ndw-repo-list">{shown.map(repo => <Repository key={repo.id} repo={repo} account={data.account} commits={settings.commits !== false} />)}</ul>)}
      {show !== 'activity' && more}
    </div>
  );
}

function Activity({ activity }: { activity: ForgeActivity }) {
  const { t, locale } = useI18n();
  const [ref, width] = useBoxWidth<HTMLDivElement>();
  const weeks = weeksThatFit(width);
  const cells = useMemo(() => activityGrid(activity, weeks), [activity, weeks]);
  const total = cells.reduce((sum, cell) => sum + cell.count, 0);
  const streak = activityStreak(activity.days);
  const months = useMemo(() => {
    const name = new Intl.DateTimeFormat(locale, { month: 'short' });
    const labels: { column: number; label: string }[] = [];
    for (let column = 0; column * 7 < cells.length; column++) {
      const first = cells[column * 7].date;
      const previous = column > 0 ? cells[(column - 1) * 7].date : undefined;
      if (previous && previous.getMonth() === first.getMonth()) continue;
      if (column === 0 && first.getDate() > 7) continue;
      if (labels.length && column - labels[labels.length - 1].column < 3) continue;
      labels.push({ column, label: name.format(first) });
    }
    return labels;
  }, [cells, locale]);
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
  const number = new Intl.NumberFormat(locale);
  const summary = weeks >= 50
    ? t('widgets.repos.activityYear', { count: number.format(total) })
    : t('widgets.repos.activityMonths', { count: number.format(total), months: Math.max(2, Math.round(weeks / 4.35)) });
  const size = cellSize(width, weeks);
  return (
    <section className="ndw-repo-activity" ref={ref} style={{ '--ndw-repo-cell': `${size}px` } as React.CSSProperties}>
      <span className="ndw-kit-row-head">
        <span className="ndw-kit-row-name">{summary}</span>
        {streak >= 2 && <span className="ndw-kit-row-value">{t('widgets.repos.streak', { count: streak })}</span>}
      </span>
      {width > 0 && (
        <>
          {weeks >= 12 && (
            <div className="ndw-repo-months" aria-hidden="true">
              {months.map(month => <span key={month.column} style={{ left: month.column * (size + GAP) }}>{month.label}</span>)}
            </div>
          )}
          <div className="ndw-repo-grid" role="img" aria-label={summary}>
            {cells.map(cell => (
              <span key={cell.date.getTime()} className={`ndw-repo-day is-l${cell.level}`} title={cell.count === 1 ? t('widgets.repos.dayOne', { date: day.format(cell.date) }) : t('widgets.repos.day', { count: cell.count, date: day.format(cell.date) })} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * One repository in two lines: its name (and owner when not the account's own)
 * with its release beside it and, on the right, a CI run going wrong or still
 * going, else its open pull requests and issues; under it the latest commit.
 */
function Repository({ repo, account, commits }: { repo: ForgeRepository; account?: string; commits: boolean }) {
  const { t } = useI18n();
  const ago = useRelativeTime();
  const [owner, ...rest] = repo.name.split('/');
  const name = rest.join('/') || owner;
  const label = rest.length && owner.toLowerCase() !== account?.toLowerCase() ? <><span className="ndw-repo-owner">{owner}/</span>{name}</> : name;
  const state = repo.checks && ['failure', 'running', 'pending'].includes(repo.checks.state) ? repo.checks : undefined;
  const stateTitle = state ? [t(`widgets.repos.checks.${state.state}`), state.name, state.branch].filter(Boolean).join(' · ') : '';
  const counts = [
    repo.openPullRequests ? t('widgets.repos.pullsCount', { count: repo.openPullRequests }) : '',
    repo.openIssues ? (repo.openIssues === 1 ? t('widgets.repos.issueCount') : t('widgets.repos.issuesCount', { count: repo.openIssues })) : '',
  ].filter(Boolean).join(' · ');
  const commit = commits ? repo.lastCommit : undefined;
  const flags = [repo.private ? t('widgets.repos.private') : '', repo.fork ? t('widgets.repos.fork') : '', repo.mirror ? t('widgets.repos.mirror') : ''].filter(Boolean);
  const detail = commit
    ? [commit.message, commit.author, ago(commit.at ?? repo.updatedAt)].filter(Boolean).join(' · ')
    : [...flags, ago(repo.updatedAt)].filter(Boolean).join(' · ');
  const side = state
    ? (state.url
      ? <a className={`ndw-kit-row-value ndw-repo-state is-${state.state}`} href={state.url} target="_blank" rel="noreferrer noopener" title={stateTitle}>{t(`widgets.repos.checks.${state.state}`)}</a>
      : <span className={`ndw-kit-row-value ndw-repo-state is-${state.state}`} title={stateTitle}>{t(`widgets.repos.checks.${state.state}`)}</span>)
    : counts ? <span className="ndw-kit-row-value">{counts}</span> : null;
  return (
    <li className="ndw-kit-row ndw-repo-row">
      <span className="ndw-kit-row-head">
        <span className="ndw-repo-title">
          {repo.url ? <a className="ndw-kit-row-name" href={repo.url} target="_blank" rel="noreferrer noopener" title={repo.name}>{label}</a> : <span className="ndw-kit-row-name" title={repo.name}>{label}</span>}
          {repo.release && (repo.release.url
            ? <a className="ndw-repo-release" href={repo.release.url} target="_blank" rel="noreferrer noopener">{repo.release.tag}</a>
            : <span className="ndw-repo-release">{repo.release.tag}</span>)}
        </span>
        {side}
      </span>
      {detail && <span className="ndw-media-sub" title={commit ? commit.message : undefined}>{detail}</span>}
    </li>
  );
}
