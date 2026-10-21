'use client';

import React from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import { LIBRARY_ARR_TYPES, type ImportedItem, type QueueItem, type QueueResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, ColumnRows, columnsOf, ColumnsSetting, DataError, Pager, useBoxWidth, usePage, useRelativeTime, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { MediaPoster } from '@/components/widgets/media/shared';
import { Stat, Track } from '@/components/widgets/media/visual';
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
 * What Sonarr, Radarr and Lidarr are fetching: each title with its
 * progress and state (a warning says why), how much is left and when it
 * should be done; above several, the total left. An empty queue shows the
 * last titles that arrived.
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
  const page = usePage(items, bounded(settings.perPage, 1, 30, 8));
  const columns = columnsOf(settings, width, 340);

  return (
    <CalmeWidget title={title} editMode={editMode} aside={<FailuresNote failures={data?.failures} />}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-arr', label: t('widgets.arr.manage') }}>
          {(draft, change) => (
            <>
              <SourcesField connections={connections} draft={draft} change={change} />
              <CalmeRow label={t('widgets.arr.perPage')}>
                <CalmeSlider label={t('widgets.arr.perPage')} value={bounded(draft.perPage, 1, 30, 8)} min={1} max={30} step={1} onChange={value => change({ perPage: value })} onCommit={value => change({ perPage: value })} format={String} />
              </CalmeRow>
              <CalmeRow label={t('widgets.arr.queue.summary')}>
                <CalmeSwitch label={t('widgets.arr.queue.summary')} checked={draft.summary !== false} onChange={on => change({ summary: on ? null : false })} />
              </CalmeRow>
              <CalmeRow label={t('widgets.arr.queue.history')} info={t('widgets.arr.queue.historyHint')}>
                <CalmeSwitch label={t('widgets.arr.queue.history')} checked={draft.history !== false} onChange={on => change({ history: on ? null : false })} />
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
              : items.length === 0 ? <Arrived recent={settings.history === false ? [] : data.recent ?? []} width={width} columns={columns} />
                : (
                  <div className="ndw-mx-stack">
                    {settings.summary !== false && items.length > 1 && <Summary items={items} total={data.total} />}
                    <ColumnRows columns={columns} className="ndw-mx-queue">{page.visible.map(item => <QueueRow key={item.id} item={item} />)}</ColumnRows>
                    <Pager page={page.page} pages={page.pages} onChange={page.setPage} />
                  </div>
                )}
      </div>
    </CalmeWidget>
  );
}

/** Several titles: how many, what is left and how long; problems counted apart. */
function Summary({ items, total }: { items: QueueItem[]; total: number }) {
  const { t } = useI18n();
  const bytes = useByteFormat();
  const eta = useEta();
  const left = items.reduce((sum, item) => sum + (item.leftBytes ?? 0), 0);
  const longest = Math.max(0, ...items.filter(item => item.status === 'downloading').map(item => item.etaMs ?? 0));
  const problems = items.filter(item => PROBLEMS.has(item.status)).length;
  return (
    <div className="ndw-mx-statrow">
      <Stat value={total} label={t('widgets.arr.inProgress', { count: total })} />
      {left > 0 && <Stat value={bytes.size(left)} label={t('widgets.arr.queue.left')} />}
      {longest > 0 && <Stat value={eta(longest)} label={t('widgets.arr.queue.until')} />}
      {problems > 0 && <Stat value={problems} label={t('widgets.arr.toCheck', { count: problems })} tone="warn" />}
    </div>
  );
}

/** Poster, title and its line; the progress beneath; the share and time left on the right. */
function QueueRow({ item }: { item: QueueItem }) {
  const { t } = useI18n();
  const bytes = useByteFormat();
  const eta = useEta();
  const code = useCode();
  const problem = PROBLEMS.has(item.status);
  const done = item.status === 'importing' || item.status === 'completed';
  const sub = problem && item.message ? item.message : [code(item), item.kind === 'album' ? item.subtitle : '', item.quality, item.sizeBytes ? bytes.size(item.sizeBytes) : ''].filter(Boolean).join(' · ');
  return (
    <div className="ndw-mx-qitem" title={item.message || undefined}>
      <MediaPoster item={posterOf(item)} width={42} />
      <span className="ndw-mx-qitem-text">
        <span className="ndw-media-title">{item.kind === 'episode' && item.subtitle ? item.subtitle : item.title}</span>
        <span className={`ndw-media-sub ${problem ? 'ndw-mx-warn' : ''}`}>{sub}</span>
        <Track thin value={item.progress} tone={problem ? 'warn' : done ? 'done' : item.status === 'paused' || item.status === 'queued' ? 'muted' : undefined} />
      </span>
      <span className="ndw-mx-qitem-end">
        <span className="ndw-mx-qitem-share">{done ? t('widgets.arr.done') : t('widgets.arr.percent', { value: Math.round(item.progress) })}</span>
        <span className={`ndw-mx-state ${problem ? 'is-warn' : ''}`}>{item.status === 'downloading' && item.etaMs ? eta(item.etaMs) : t(`widgets.arr.status.${item.status}`)}</span>
      </span>
    </div>
  );
}

/** Nothing to fetch: the last titles that arrived, in the same rows as the queue. */
function Arrived({ recent, width, columns }: { recent: ImportedItem[]; width: number; columns: number }) {
  const { t } = useI18n();
  const relative = useRelativeTime();
  const code = useCode();
  return (
    <div className="ndw-mx-stack">
      <div className="ndw-mx-empty">
        <span className="ndw-mx-calm">{t('widgets.arr.allArrived')}</span>
        <span className="ndw-mx-meta">{t('widgets.arr.queueEmpty')}</span>
      </div>
      {recent.length > 0 && (
        <div className="ndw-mx-section">
          <span className="ndw-mx-label">{t('widgets.arr.lastImports')}</span>
          <ColumnRows columns={width ? columns : 1}>
            {recent.map(item => (
              <div key={item.id} className="ndw-mx-qrow">
                <MediaPoster item={posterOf(item)} width={40} />
                <span className="ndw-mx-qrow-text">
                  <span className="ndw-mx-qrow-head">
                    <span className="ndw-media-title">{item.kind === 'episode' && item.subtitle ? item.subtitle : item.title}</span>
                    <span className="ndw-mx-state">{t('widgets.arr.imported')}</span>
                  </span>
                  <span className="ndw-mx-qrow-foot">
                    <span className="ndw-media-sub">{[item.count && item.count > 1 ? t('widgets.media.newEpisodes', { count: item.count }) : code(item), item.kind === 'album' ? item.subtitle : '', item.quality].filter(Boolean).join(' · ')}</span>
                    <span className="ndw-media-time">{relative(item.at)}</span>
                  </span>
                </span>
              </div>
            ))}
          </ColumnRows>
        </div>
      )}
    </div>
  );
}
