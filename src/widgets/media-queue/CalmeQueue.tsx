'use client';

import React from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import { LIBRARY_ARR_TYPES, type QueueItem, type QueueResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSlider } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, ColumnRows, columnsOf, ColumnsSetting, DataError, useBoxWidth, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { MediaPoster } from '@/components/widgets/media/shared';
import { ArrSetup, chosenSources, FailuresNote, SourcesField, useByteFormat, useConnections, useEta } from '@/components/widgets/media/arr';

/**
 * What Sonarr, Radarr and Lidarr are fetching: each title with its
 * progress, its state (downloading, waiting, importing, a warning and its
 * reason), what is left and when it should be done.
 */
export default function CalmeQueue({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const connections = useConnections(LIBRARY_ARR_TYPES);
  const sources = chosenSources(connections, settings);
  const { data, error, mutate, stale } = useWidgetData<QueueResponse>('/api/widgets/arr/queue', widgetId, settings, { refreshMs: 10_000, isVisible, method: 'GET', enabled: sources.length > 0 });
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const title = t('widget.media-queue.name');
  const items = data?.items ?? [];

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data?.failures.length ? <FailuresNote failures={data.failures} /> : data && data.total > 0 ? <span className="ndc-title-note">{t('widgets.arr.inQueue', { count: data.total })}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-arr', label: t('widgets.arr.manage') }}>
          {(draft, change) => (
            <>
              <SourcesField connections={connections} draft={draft} change={change} />
              <CalmeRow label={t('widgets.arr.count')}>
                <CalmeSlider label={t('widgets.arr.count')} value={bounded(draft.count, 3, 50, 10)} min={3} max={50} step={1} onChange={value => change({ count: value })} onCommit={value => change({ count: value })} format={String} />
              </CalmeRow>
              <ColumnsSetting draft={draft} change={change} />
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div ref={box} className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connections.length ? <ArrSetup kind="arr" />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true">{[0, 1, 2].map(row => <span key={row} className="ndw-skeleton-row" />)}</div>
              : items.length === 0 ? <div className="ndw-arr-empty">{t('widgets.arr.queueEmpty')}</div>
                : <ColumnRows columns={columnsOf(settings, width, 300)}>{items.map(item => <QueueRow key={item.id} item={item} />)}</ColumnRows>}
      </div>
    </CalmeWidget>
  );
}

function QueueRow({ item }: { item: QueueItem }) {
  const { t } = useI18n();
  const bytes = useByteFormat();
  const eta = useEta();
  const sub = item.kind === 'episode'
    ? [item.subtitle, item.season !== undefined && item.episode !== undefined ? t('widgets.media.episodeCode', { season: item.season, episode: item.episode }) : ''].filter(Boolean).join(' · ')
    : item.subtitle ?? item.quality ?? '';
  const left = item.status === 'downloading' ? eta(item.etaMs) : '';
  return (
    <div className={`ndw-arr-queue-row is-${item.status}`} title={item.message || undefined}>
      <MediaPoster item={{ id: item.id, kind: item.kind === 'album' ? 'album' : item.kind === 'movie' ? 'movie' : 'episode', title: item.kind === 'episode' && item.subtitle ? item.subtitle : item.title, poster: item.poster }} width={30} />
      <span className="ndw-media-row-text">
        <span className="ndw-arr-queue-head">
          <span className="ndw-media-title">{item.title}</span>
          <span className={`ndw-arr-state is-${item.status}`}>{t(`widgets.arr.status.${item.status}`)}</span>
        </span>
        <span className="ndw-media-sub">{item.message && (item.status === 'warning' || item.status === 'failed') ? item.message : [sub, item.quality && item.kind === 'episode' ? item.quality : '', item.sizeBytes ? bytes.size(item.sizeBytes) : ''].filter(Boolean).join(' · ')}</span>
        <span className="ndw-arr-progress" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} /></span>
      </span>
      <span className="ndw-arr-queue-end">
        <span className="ndw-arr-percent">{Math.round(item.progress)}%</span>
        {left && <span className="ndw-media-time">{left}</span>}
      </span>
    </div>
  );
}
