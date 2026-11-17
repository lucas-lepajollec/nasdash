'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { NotificationItem, NotificationsSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSegmented, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { KitWidget } from '@/components/widgets/content/KitWidget';
import { bounded, pick, useRelativeTime } from '@/components/widgets/content/kit';

const STYLES = ['full', 'compact'] as const;
const LEVELS = ['all', 'high'] as const;
const TEXTS = ['none', 'short', 'full'] as const;
export const NOTIFICATION_ROWS = { min: 2, max: 30, default: 6 } as const;

/** The notifications a widget lists: all, or only high and urgent ones (4–5). */
export const shownNotifications = (messages: NotificationItem[], settings: WidgetSettings) =>
  pick(settings.level, LEVELS, 'all') === 'high' ? messages.filter(message => message.priority >= 4) : messages;

/**
 * ntfy topics or Gotify applications: the latest notifications, newest first,
 * coloured by priority. Compact keeps one line each; the rest is one click away.
 */
export default function CalmeNotifications(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <KitWidget<NotificationsSummary> widget="notifications" refreshMs={30_000} skeleton={[34, 34, 34]} {...props}
      extraSettings={(draft, change) => (
        <>
          <CalmeRow label={t('widgets.display')}>
            <CalmeSegmented label={t('widgets.display')} value={pick(draft.style, STYLES, 'full')} options={STYLES.map(value => ({ value, label: t(`widgets.style.${value}`) }))} onChange={value => change({ style: value === 'full' ? null : value })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.notifications.level')}>
            <CalmeSegmented label={t('widgets.notifications.level')} value={pick(draft.level, LEVELS, 'all')} options={LEVELS.map(value => ({ value, label: t(`widgets.notifications.level.${value}`) }))} onChange={value => change({ level: value === 'all' ? null : value })} />
          </CalmeRow>
          {pick(draft.style, STYLES, 'full') === 'full' && (
            <CalmeRow label={t('widgets.notifications.text')}>
              <CalmeSegmented label={t('widgets.notifications.text')} value={pick(draft.text, TEXTS, 'short')} options={TEXTS.map(value => ({ value, label: t(`widgets.notifications.text.${value}`) }))} onChange={value => change({ text: value === 'short' ? null : value })} />
            </CalmeRow>
          )}
          <CalmeRow label={t('widgets.notifications.group')} info={t('widgets.notifications.groupHint')}>
            <CalmeSwitch label={t('widgets.notifications.group')} checked={draft.group === true} onChange={on => change({ group: on || null })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.notifications.showSource')}>
            <CalmeSwitch label={t('widgets.notifications.showSource')} checked={draft.source !== false} onChange={on => change({ source: on ? null : false })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.notifications.markNew')} info={t('widgets.notifications.markNewHint')}>
            <CalmeSwitch label={t('widgets.notifications.markNew')} checked={draft.markNew !== false} onChange={on => change({ markNew: on ? null : false })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.notifications.rows')} stacked>
            <CalmeSlider label={t('widgets.notifications.rows')} min={NOTIFICATION_ROWS.min} max={NOTIFICATION_ROWS.max} step={1} value={bounded(draft.rows, NOTIFICATION_ROWS.min, NOTIFICATION_ROWS.max, NOTIFICATION_ROWS.default)}
              onChange={value => change({ rows: value })} onCommit={value => change({ rows: value === NOTIFICATION_ROWS.default ? null : value })} format={String} />
          </CalmeRow>
        </>
      )}>
      {data => <Notifications data={data} settings={props.settings} widgetId={props.widgetId} />}
    </KitWidget>
  );
}

/** When this browser last saw the widget's notifications: newer ones get a dot (kept per widget, never shared). */
function useLastSeen(widgetId: string, newest: number | undefined) {
  const key = `nd-notifications-seen-${widgetId}`;
  // Read once, when the widget first shows its data (client only: the data never renders on the server).
  const [seen] = useState<number>(() => { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } });
  useEffect(() => {
    // What is on screen now counts as seen next time.
    if (newest) try { localStorage.setItem(key, String(Math.max(seen, newest))); } catch { /* private mode */ }
  }, [key, newest, seen]);
  return seen;
}

function Notifications({ data, settings, widgetId }: { data: NotificationsSummary; settings: WidgetSettings; widgetId: string }) {
  const { t } = useI18n();
  const ago = useRelativeTime();
  const [expanded, setExpanded] = useState(false);
  const compact = pick(settings.style, STYLES, 'full') === 'compact';
  const text = compact ? 'none' : pick(settings.text, TEXTS, 'short');
  const rows = bounded(settings.rows, NOTIFICATION_ROWS.min, NOTIFICATION_ROWS.max, NOTIFICATION_ROWS.default);
  const messages = shownNotifications(data.messages, settings);
  const seen = useLastSeen(widgetId, data.messages[0]?.time);
  const hidden = Math.max(0, messages.length - rows);
  if (messages.length === 0) return <span className="ndw-media-sub is-quiet">{t('widgets.notifications.none')}</span>;
  const visible = expanded ? messages : messages.slice(0, rows);
  // Grouped: one heading per topic or application, in the order of their latest notification.
  const groups = settings.group === true
    ? [...new Set(visible.map(message => message.source))].map(source => ({ source, items: visible.filter(message => message.source === source) }))
    : [{ source: '', items: visible }];
  const row = (message: NotificationItem) => {
    const fresh = settings.markNew !== false && seen > 0 && message.time > seen;
    return (
      <li key={`${message.source}:${message.id}`} className={`ndw-notif-row is-p${message.priority}`}>
        <span className="ndw-notif-mark" aria-hidden="true" />
        <span className="ndw-notif-main">
          <span className="ndw-notif-head">
            {fresh && <span className="ndw-notif-new" title={t('widgets.notifications.new')} aria-label={t('widgets.notifications.new')} />}
            <span className="ndw-notif-title">{message.title || message.message}</span>
            {message.link && <a className="ndw-notif-link" href={message.link} target="_blank" rel="noreferrer noopener" aria-label={t('widgets.notifications.open')} title={t('widgets.notifications.open')}><ExternalLink size={11} /></a>}
          </span>
          {text !== 'none' && message.title && <span className={`ndw-notif-text ${text === 'full' ? 'is-full' : ''}`}>{message.message}</span>}
          <span className="ndw-media-sub">{[settings.source !== false && settings.group !== true ? message.source : '', ago(message.time)].filter(Boolean).join(' · ')}</span>
        </span>
      </li>
    );
  };
  return (
    <div className={`ndw-kit ndw-notif ${compact ? 'is-compact' : ''}`}>
      {groups.map(group => (
        <div key={group.source || 'all'} className="ndw-notif-group">
          {group.source && <span className="ndw-mx-label">{group.source}</span>}
          <ul className="ndw-notif-list">{group.items.map(row)}</ul>
        </div>
      ))}
      {hidden > 0 && (
        <button type="button" className="ndw-upd-more" aria-expanded={expanded} onClick={() => setExpanded(open => !open)}>
          {expanded ? t('widgets.updates.less') : t('widgets.updates.more', { count: hidden })}
        </button>
      )}
    </div>
  );
}
