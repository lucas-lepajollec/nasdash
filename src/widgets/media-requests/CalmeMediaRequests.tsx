'use client';

import React, { useState } from 'react';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { Check, Clapperboard, Tv, X } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MediaRequestItem, MediaRequestsSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSegmented, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { KitWidget, type KitTools } from '@/components/widgets/content/KitWidget';
import { bounded, pick, useRelativeTime } from '@/components/widgets/content/kit';
import { Stat } from '@/components/widgets/media/visual';

const FILTERS = ['all', 'pending'] as const;
export const REQUEST_ROWS = { min: 2, max: 20, default: 5 } as const;

/** The requests a widget lists: all, or only those waiting for a decision. */
export const shownRequests = (requests: MediaRequestItem[], settings: WidgetSettings) =>
  pick(settings.filter, FILTERS, 'all') === 'pending' ? requests.filter(request => request.status === 'pending') : requests;

/**
 * Seerr (Overseerr, Jellyseerr): how many requests wait, are on their way or
 * arrived, then the latest ones with their poster and who asked. An
 * administrator approves or declines a pending request in place.
 */
export default function CalmeMediaRequests(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <KitWidget<MediaRequestsSummary> widget="media-requests" refreshMs={60_000} skeleton={[40, 48, 48]} {...props}
      extraSettings={(draft, change) => (
        <>
          <CalmeRow label={t('widgets.requests.filter')}>
            <CalmeSegmented label={t('widgets.requests.filter')} value={pick(draft.filter, FILTERS, 'all')} options={FILTERS.map(value => ({ value, label: t(`widgets.requests.filter.${value}`) }))} onChange={value => change({ filter: value === 'all' ? null : value })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.requests.rows')} stacked>
            <CalmeSlider label={t('widgets.requests.rows')} min={REQUEST_ROWS.min} max={REQUEST_ROWS.max} step={1} value={bounded(draft.rows, REQUEST_ROWS.min, REQUEST_ROWS.max, REQUEST_ROWS.default)}
              onChange={value => change({ rows: value })} onCommit={value => change({ rows: value === REQUEST_ROWS.default ? null : value })} format={String} />
          </CalmeRow>
          <CalmeRow label={t('widgets.requests.showCounts')}>
            <CalmeSwitch label={t('widgets.requests.showCounts')} checked={draft.counts !== false} onChange={on => change({ counts: on ? null : false })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.requests.showPosters')}>
            <CalmeSwitch label={t('widgets.requests.showPosters')} checked={draft.posters !== false} onChange={on => change({ posters: on ? null : false })} />
          </CalmeRow>
        </>
      )}>
      {(data, tools) => <Requests data={data} tools={tools} settings={props.settings} />}
    </KitWidget>
  );
}

function Requests({ data, tools, settings }: { data: MediaRequestsSummary; tools: KitTools; settings: WidgetSettings }) {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  // Every decision is confirmed first: a request approved by a stray click starts a download.
  const [asking, setAsking] = useState<{ request: MediaRequestItem; action: 'approve' | 'decline' } | null>(null);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const rows = bounded(settings.rows, REQUEST_ROWS.min, REQUEST_ROWS.max, REQUEST_ROWS.default);
  const all = shownRequests(data.requests, settings);
  const requests = expanded ? all : all.slice(0, rows);
  const hidden = Math.max(0, all.length - rows);
  return (
    <div className="ndw-kit ndw-req">
      {settings.counts !== false && (
        <div className="ndw-mx-statrow">
          <Stat value={number(data.counts.pending)} label={t('widgets.requests.pending')} tone={data.counts.pending ? undefined : 'muted'} />
          <Stat value={number(data.counts.processing)} label={t('widgets.requests.processing')} tone="muted" />
          <Stat value={number(data.counts.available)} label={t('widgets.requests.available')} tone="muted" />
        </div>
      )}
      {requests.length === 0
        ? <span className="ndw-media-sub is-quiet">{pick(settings.filter, FILTERS, 'all') === 'pending' ? t('widgets.requests.nonePending') : t('widgets.requests.none')}</span>
        : <ul className="ndw-req-list">{requests.map(request => <Request key={request.id} request={request} posters={settings.posters !== false} control={data.canControl === true} tools={tools} onDecide={action => setAsking({ request, action })} />)}</ul>}
      {hidden > 0 && (
        <button type="button" className="ndw-upd-more" aria-expanded={expanded} onClick={() => setExpanded(open => !open)}>
          {expanded ? t('widgets.updates.less') : t('widgets.updates.more', { count: hidden })}
        </button>
      )}
      <ConfirmModal
        isOpen={asking !== null}
        onClose={() => setAsking(null)}
        onConfirm={() => { const decision = asking; setAsking(null); if (decision) void tools.run(decision.action, decision.request.id); }}
        title={asking ? t(asking.action === 'approve' ? 'widgets.requests.approveTitle' : 'widgets.requests.declineTitle', { title: asking.request.title }) : ''}
        description={asking ? t(asking.action === 'approve' ? 'widgets.requests.approveConfirm' : 'widgets.requests.declineConfirm', { title: asking.request.title, who: asking.request.requestedBy ?? '?' }) : ''}
        confirmLabel={asking ? t(asking.action === 'approve' ? 'widgets.requests.approveAction' : 'widgets.requests.declineAction') : ''}
        cancelLabel={t('Annuler')}
      />
    </div>
  );
}

function Request({ request, posters, control, tools, onDecide }: { request: MediaRequestItem; posters: boolean; control: boolean; tools: KitTools; onDecide: (action: 'approve' | 'decline') => void }) {
  const { t } = useI18n();
  const ago = useRelativeTime();
  const busy = tools.busy === `approve:${request.id}` || tools.busy === `decline:${request.id}`;
  const Kind = request.kind === 'tv' ? Tv : Clapperboard;
  return (
    <li className="ndw-req-row">
      {posters && (
        <span className="ndw-req-poster" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- a TMDB poster from its public CDN */}
          {request.poster ? <img src={request.poster} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Kind size={14} />}
        </span>
      )}
      <span className="ndw-req-main">
        <span className="ndw-req-title">{request.title}{request.year ? <span className="ndw-req-year"> {request.year}</span> : null}</span>
        <span className="ndw-media-sub">{[request.requestedBy, request.requestedAt ? ago(request.requestedAt) : ''].filter(Boolean).join(' · ')}</span>
      </span>
      {control && request.status === 'pending' ? (
        <span className="ndw-req-actions">
          <button type="button" className="ndw-req-decide is-ok" disabled={busy} onClick={() => onDecide('approve')} aria-label={t('widgets.requests.approve', { title: request.title })} title={t('widgets.requests.approve', { title: request.title })}><Check size={13} /></button>
          <button type="button" className="ndw-req-decide is-no" disabled={busy} onClick={() => onDecide('decline')} aria-label={t('widgets.requests.decline', { title: request.title })} title={t('widgets.requests.decline', { title: request.title })}><X size={13} /></button>
        </span>
      ) : <span className={`ndw-req-status is-${request.status}`}>{t(`widgets.requests.status.${request.status}`)}</span>}
    </li>
  );
}
