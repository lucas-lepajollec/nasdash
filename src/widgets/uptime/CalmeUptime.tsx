'use client';

import React from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { UptimeMonitor, UptimeSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { KitWidget } from '@/components/widgets/content/KitWidget';
import { pick } from '@/components/widgets/content/kit';

const STYLES = ['full', 'compact'] as const;

const CHOICES = ['all', 'chosen'] as const;
/** The monitors a widget chose (`chosen` mode), by id. */
export const chosenMonitors = (settings: WidgetSettings) => new Set(Array.isArray(settings.monitors) ? settings.monitors.filter((id): id is string => typeof id === 'string') : []);

/** The monitors a widget lists: all or the chosen ones, then only those that are not up if asked. */
export function shownMonitors(groups: UptimeSummary['groups'], problemsOnly: boolean, chosen?: Set<string>) {
  return groups.map(group => ({ ...group, monitors: group.monitors.filter(monitor => (!chosen || chosen.has(monitor.id)) && (!problemsOnly || monitor.status !== 'up')) })).filter(group => group.monitors.length > 0);
}

/**
 * Uptime Kuma (a status page): whether everything is up, each monitor with its
 * latest beats and 24-hour uptime. Compact keeps one line per monitor; on a
 * narrow widget the beats go, the dot and the name stay.
 */
export default function CalmeUptime(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <KitWidget<UptimeSummary> widget="uptime" refreshMs={60_000} skeleton={[22, 26, 26, 26]} {...props}
      extraSettings={(draft, change, data) => (
        <>
          <CalmeRow label={t('widgets.uptime.monitors')} info={t('widgets.uptime.monitorsHint')}>
            <CalmeSegmented label={t('widgets.uptime.monitors')} value={pick(draft.choose, CHOICES, 'all')} options={CHOICES.map(value => ({ value, label: t(`widgets.uptime.monitors.${value}`) }))}
              onChange={value => change(value === 'all' ? { choose: null } : { choose: value, monitors: Array.isArray(draft.monitors) ? draft.monitors : (data?.groups.flatMap(group => group.monitors.map(monitor => monitor.id)) ?? []) })} />
          </CalmeRow>
          {pick(draft.choose, CHOICES, 'all') === 'chosen' && data && (
            <div className="ndw-settings-checks">
              {data.groups.flatMap(group => group.monitors.map(monitor => {
                const chosen = chosenMonitors(draft);
                return (
                  <CalmeRow key={monitor.id} label={data.groups.length > 1 ? [monitor.name, group.name].join(' · ') : monitor.name}>
                    <CalmeSwitch label={monitor.name} checked={chosen.has(monitor.id)} onChange={on => { const next = new Set(chosen); if (on) next.add(monitor.id); else next.delete(monitor.id); change({ monitors: [...next] }); }} />
                  </CalmeRow>
                );
              }))}
            </div>
          )}
          <CalmeRow label={t('widgets.display')}>
            <CalmeSegmented label={t('widgets.display')} value={pick(draft.style, STYLES, 'full')} options={STYLES.map(value => ({ value, label: t(`widgets.style.${value}`) }))} onChange={value => change({ style: value === 'full' ? null : value })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.uptime.problemsOnly')} info={t('widgets.uptime.problemsOnlyHint')}>
            <CalmeSwitch label={t('widgets.uptime.problemsOnly')} checked={draft.problems === true} onChange={on => change({ problems: on || null })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.markets.alignColumns')} info={t('widgets.uptime.alignHint')}>
            <CalmeSwitch label={t('widgets.markets.alignColumns')} checked={draft.align !== 'free'} onChange={on => change({ align: on ? null : 'free' })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.uptime.showGroups')}>
            <CalmeSwitch label={t('widgets.uptime.showGroups')} checked={draft.groups !== false} onChange={on => change({ groups: on ? null : false })} />
          </CalmeRow>
        </>
      )}>
      {data => <Uptime data={data} settings={props.settings} />}
    </KitWidget>
  );
}

function Uptime({ data, settings }: { data: UptimeSummary; settings: WidgetSettings }) {
  const { t } = useI18n();
  const compact = pick(settings.style, STYLES, 'full') === 'compact';
  const all = data.groups.flatMap(group => group.monitors);
  const down = all.filter(monitor => monitor.status === 'down').length;
  const groups = shownMonitors(data.groups, settings.problems === true, pick(settings.choose, CHOICES, 'all') === 'chosen' ? chosenMonitors(settings) : undefined);
  const withNames = settings.groups !== false && groups.length > 1;
  // Aligned (default): every row gets the longest name's width, so all the beat lines start at the same place.
  const aligned = settings.align !== 'free';
  const longest = Math.max(5, ...groups.flatMap(group => group.monitors.map(monitor => monitor.name.length)));
  return (
    <div className={`ndw-kit ndw-uptime ${compact ? 'is-compact' : ''} ${aligned ? 'is-aligned' : ''}`} style={aligned ? { '--ndw-uptime-name': `${longest + 1}ch` } as React.CSSProperties : undefined}>
      <span className={`ndw-kit-state ${down ? 'is-bad' : ''}`}>
        {down ? <CircleAlert size={13} aria-hidden="true" /> : <CircleCheck size={13} aria-hidden="true" />}
        <span className="ndw-kit-name">{data.title ?? data.name}</span>
        <span className="ndw-kit-word">{down ? t('widgets.uptime.down', { count: down }) : t('widgets.uptime.allUp', { count: all.length })}</span>
      </span>
      {groups.length === 0
        ? <span className="ndw-media-sub is-quiet">{settings.problems === true ? t('widgets.uptime.noProblem') : t('widgets.uptime.none')}</span>
        : groups.map(group => (
          <div key={group.name} className="ndw-uptime-group">
            {withNames && <span className="ndw-mx-label">{group.name}</span>}
            <ul className="ndw-uptime-list">{group.monitors.map(monitor => <Monitor key={monitor.id} monitor={monitor} compact={compact} />)}</ul>
          </div>
        ))}
    </div>
  );
}

function Monitor({ monitor, compact }: { monitor: UptimeMonitor; compact: boolean }) {
  const { t, locale } = useI18n();
  const uptime = monitor.uptime !== undefined ? new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: monitor.uptime >= 99.95 || monitor.uptime < 99 ? 0 : 2 }).format(monitor.uptime / 100) : undefined;
  const ping = monitor.ping !== undefined ? [monitor.ping, 'ms'].join('\u00a0') : '';
  const name = monitor.url
    ? <a className="ndw-uptime-name" href={monitor.url} target="_blank" rel="noreferrer noopener">{monitor.name}</a>
    : <span className="ndw-uptime-name">{monitor.name}</span>;
  return (
    <li className={`ndw-uptime-row is-${monitor.status}`} title={t(`widgets.uptime.state.${monitor.status}`)}>
      <span className="ndw-uptime-dot" aria-hidden="true" />
      {name}
      {!compact && monitor.beats.length > 0 && (
        <span className="ndw-uptime-beats" aria-hidden="true">
          {monitor.beats.map((beat, index) => <span key={index} className={`is-${beat}`} />)}
        </span>
      )}
      <span className="ndw-uptime-figure">{uptime ?? ping}</span>
      <span className="sr-only">{t(`widgets.uptime.state.${monitor.status}`)}</span>
    </li>
  );
}
