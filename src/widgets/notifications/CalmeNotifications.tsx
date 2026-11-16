'use client';

import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { NotificationItem, NotificationsSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSegmented, CalmeSlider } from '@/components/modals/settings/shared/CalmeControls';
import { KitWidget } from '@/components/widgets/content/KitWidget';
import { bounded, pick, useRelativeTime } from '@/components/widgets/content/kit';

const STYLES = ['full', 'compact'] as const;
const LEVELS = ['all', 'high'] as const;
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
          <CalmeRow label={t('widgets.notifications.rows')} stacked>
            <CalmeSlider label={t('widgets.notifications.rows')} min={NOTIFICATION_ROWS.min} max={NOTIFICATION_ROWS.max} step={1} value={bounded(draft.rows, NOTIFICATION_ROWS.min, NOTIFICATION_ROWS.max, NOTIFICATION_ROWS.default)}
              onChange={value => change({ rows: value })} onCommit={value => change({ rows: value === NOTIFICATION_ROWS.default ? null : value })} format={String} />
          </CalmeRow>
        </>
      )}>
      {data => <Notifications data={data} settings={props.settings} />}
    </KitWidget>
  );
}

function Notifications({ data, settings }: { data: NotificationsSummary; settings: WidgetSettings }) {
  const { t } = useI18n();
  const ago = useRelativeTime();
  const [expanded, setExpanded] = useState(false);
  const compact = pick(settings.style, STYLES, 'full') === 'compact';
  const rows = bounded(settings.rows, NOTIFICATION_ROWS.min, NOTIFICATION_ROWS.max, NOTIFICATION_ROWS.default);
  const messages = shownNotifications(data.messages, settings);
  const hidden = Math.max(0, messages.length - rows);
  if (messages.length === 0) return <span className="ndw-media-sub is-quiet">{t('widgets.notifications.none')}</span>;
  return (
    <div className={`ndw-kit ndw-notif ${compact ? 'is-compact' : ''}`}>
      <ul className="ndw-notif-list">
        {(expanded ? messages : messages.slice(0, rows)).map(message => (
          <li key={`${message.source}:${message.id}`} className={`ndw-notif-row is-p${message.priority}`}>
            <span className="ndw-notif-mark" aria-hidden="true" />
            <span className="ndw-notif-main">
              <span className="ndw-notif-head">
                <span className="ndw-notif-title">{message.title || message.message}</span>
                {message.link && <a className="ndw-notif-link" href={message.link} target="_blank" rel="noreferrer noopener" aria-label={t('widgets.notifications.open')} title={t('widgets.notifications.open')}><ExternalLink size={11} /></a>}
              </span>
              {!compact && message.title && <span className="ndw-notif-text">{message.message}</span>}
              <span className="ndw-media-sub">{[message.source, ago(message.time)].filter(Boolean).join(' · ')}</span>
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button type="button" className="ndw-upd-more" aria-expanded={expanded} onClick={() => setExpanded(open => !open)}>
          {expanded ? t('widgets.updates.less') : t('widgets.updates.more', { count: hidden })}
        </button>
      )}
    </div>
  );
}
