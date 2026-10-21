'use client';

import React from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import { LIBRARY_ARR_TYPES, type ImportedItem, type QueueItem, type QueueResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSlider } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, ColumnRows, columnsOf, ColumnsSetting, DataError, useBoxWidth, useRelativeTime, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { MediaPoster } from '@/components/widgets/media/shared';
import { Figure, Track } from '@/components/widgets/media/visual';
import { ArrSetup, chosenSources, FailuresNote, SourcesField, useByteFormat, useConnections, useEta } from '@/components/widgets/media/arr';

const PROBLEMS = new Set<QueueItem['status']>(['warning', 'failed']);
const posterOf = (item: { id: string; kind: QueueItem['kind']; title: string; subtitle?: string; poster?: string }) =>
  ({ id: item.id, kind: item.kind === 'album' ? 'album' as const : item.kind === 'movie' ? 'movie' as const : 'episode' as const, title: item.kind === 'episode' && item.subtitle ? item.subtitle : item.title, poster: item.poster });

/** "Series · S2 · E5", the artist, or nothing for a movie. */
function useCode() {
  const { t } = useI18n();
  return (item: { kind: QueueItem['kind']; season?: number; episode?: number }) => item.kind === 'episode' && item.season !== undefined && item.episode !== undefined ? t('widgets.media.episodeCode', { season: item.season, episode: item.episode }) : '';
}

/**
 * What Sonarr, Radarr and Lidarr are fetching: how many, what is left, then
 * each title with its progress and state (a warning says why). An empty
 * queue shows the last titles that arrived.
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
    <CalmeWidget title={title} editMode={editMode} aside={<FailuresNote failures={data?.failures} />}>
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
              : items.length === 0 ? <Arrived recent={data.recent ?? []} width={width} />
                : (
                  <div className="ndw-mx-stack">
                    <Summary items={items} total={data.total} />
                    <ColumnRows columns={columnsOf(settings, width, 320)}>{items.map(item => <QueueRow key={item.id} item={item} />)}</ColumnRows>
                  </div>
                )}
      </div>
    </CalmeWidget>
  );
}

/** How many, what is left and how long; problems counted apart. */
function Summary({ items, total }: { items: QueueItem[]; total: number }) {
  const { t } = useI18n();
  const bytes = useByteFormat();
  const eta = useEta();
  const left = items.reduce((sum, item) => sum + (item.leftBytes ?? 0), 0);
  const longest = Math.max(0, ...items.filter(item => item.status === 'downloading').map(item => item.etaMs ?? 0));
  const problems = items.filter(item => PROBLEMS.has(item.status)).length;
  return (
    <div className="ndw-mx-summary">
      <Figure value={total} unit={t('widgets.arr.inProgress', { count: total })} />
      <span className="ndw-mx-summary-text">
        {[left ? t('widgets.arr.left', { size: bytes.size(left) }) : '', longest ? `≈ ${eta(longest)}` : ''].filter(Boolean).join(' · ')}
        {problems > 0 && <span className="ndw-mx-warn">{t('widgets.arr.toCheck', { count: problems })}</span>}
      </span>
    </div>
  );
}

function QueueRow({ item }: { item: QueueItem }) {
  const { t } = useI18n();
  const bytes = useByteFormat();
  const eta = useEta();
  const code = useCode();
  const problem = PROBLEMS.has(item.status);
  const sub = problem && item.message ? item.message : [code(item), item.kind === 'album' ? item.subtitle : '', item.quality, item.sizeBytes ? bytes.size(item.sizeBytes) : ''].filter(Boolean).join(' · ');
  const end = item.status === 'downloading' ? [`${Math.round(item.progress)} %`, eta(item.etaMs)].filter(Boolean).join(' · ') : item.status === 'importing' || item.status === 'completed' ? t('widgets.arr.done') : `${Math.round(item.progress)} %`;
  return (
    <div className="ndw-mx-qrow" title={item.message || undefined}>
      <MediaPoster item={posterOf(item)} width={40} />
      <span className="ndw-mx-qrow-text">
        <span className="ndw-mx-qrow-head">
          <span className="ndw-media-title">{item.kind === 'episode' && item.subtitle ? item.subtitle : item.title}</span>
          <span className={`ndw-mx-state ${problem ? 'is-warn' : item.status === 'importing' ? 'is-done' : ''}`}>{t(`widgets.arr.status.${item.status}`)}</span>
        </span>
        <Track value={item.progress} tone={problem ? 'warn' : item.status === 'importing' || item.status === 'completed' ? 'done' : item.status === 'paused' || item.status === 'queued' ? 'muted' : undefined} />
        <span className="ndw-mx-qrow-foot">
          <span className={`ndw-media-sub ${problem ? 'ndw-mx-warn' : ''}`}>{sub}</span>
          <span className="ndw-media-time">{end}</span>
        </span>
      </span>
    </div>
  );
}

/** Nothing to fetch: the last titles that arrived, as posters. */
function Arrived({ recent, width }: { recent: ImportedItem[]; width: number }) {
  const { t } = useI18n();
  const relative = useRelativeTime();
  const code = useCode();
  const columns = Math.max(3, Math.min(6, Math.floor((width + 12) / 112)));
  return (
    <div className="ndw-mx-stack">
      <div className="ndw-mx-empty">
        <span className="ndw-mx-calm">{t('widgets.arr.allArrived')}</span>
        <span className="ndw-mx-meta">{t('widgets.arr.queueEmpty')}</span>
      </div>
      {recent.length > 0 && (
        <div className="ndw-mx-rail" style={{ '--ndw-cols': columns } as React.CSSProperties}>
          {recent.slice(0, columns).map(item => (
            <span key={item.id} className="ndw-mx-rail-item" title={item.title}>
              <span className="ndw-mx-rail-art"><MediaPoster item={posterOf(item)} width={200} frame /></span>
              <span className="ndw-mx-rail-title">{item.kind === 'episode' && item.subtitle ? item.subtitle : item.title}</span>
              <span className="ndw-mx-rail-sub">{[item.count && item.count > 1 ? t('widgets.media.newEpisodes', { count: item.count }) : code(item), relative(item.at)].filter(Boolean).join(' · ')}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
