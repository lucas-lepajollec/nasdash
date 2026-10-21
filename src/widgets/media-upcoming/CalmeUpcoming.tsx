'use client';

import React, { useMemo } from 'react';
import { Check } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { LIBRARY_ARR_TYPES, type UpcomingItem, type UpcomingResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField, CalmeCheckRow } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, ColumnRows, columnsOf, ColumnsSetting, DataError, pick, useBoxWidth, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { MediaPoster } from '@/components/widgets/media/shared';
import { ArrSetup, chosenSources, FailuresNote, SourcesField, useConnections } from '@/components/widgets/media/arr';

type Display = 'agenda' | 'posters' | 'list';
const DISPLAYS: readonly Display[] = ['agenda', 'posters', 'list'];
type Kind = 'episode' | 'movie' | 'album';
const KINDS: readonly Kind[] = ['episode', 'movie', 'album'];
const DAY = 86_400_000;

/** Start of the day of a time, in this browser's time zone. */
const dayOf = (time: number) => { const date = new Date(time); date.setHours(0, 0, 0, 0); return date.getTime(); };

function useWhen() {
  const { t, locale } = useI18n();
  return useMemo(() => {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    const short = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
    const day = (at: number, now: number, compact = false) => {
      const diff = Math.round((dayOf(at) - dayOf(now)) / DAY);
      if (diff === 0) return t('widgets.arr.today');
      if (diff === 1) return t('widgets.arr.tomorrow');
      if (diff === -1) return t('widgets.arr.yesterday');
      return (compact ? short : weekday).format(at);
    };
    return { day, time: (at: number) => time.format(at) };
  }, [locale, t]);
}

/** "Series · S2 · E5", "Artist", or the movie's release kind. */
function useLine() {
  const { t } = useI18n();
  return (item: UpcomingItem) => {
    if (item.kind === 'episode') return [item.subtitle, item.season !== undefined && item.episode !== undefined ? t('widgets.media.episodeCode', { season: item.season, episode: item.episode }) : ''].filter(Boolean).join(' · ');
    if (item.kind === 'movie') return item.release ? t(`widgets.arr.release.${item.release}`) : '';
    return item.subtitle ?? '';
  };
}

/** The poster's item shape (the media poster component reads only these fields). */
const posterItem = (item: UpcomingItem) => ({ id: item.id, kind: item.kind === 'album' ? 'album' as const : item.kind === 'movie' ? 'movie' as const : 'episode' as const, title: item.kind === 'episode' && item.subtitle ? item.subtitle : item.title, poster: item.poster });

/**
 * What Sonarr, Radarr and Lidarr expect in the coming days: episodes,
 * movies (cinema, digital or physical release) and albums, as an agenda by
 * day, a row of posters or a compact list; downloaded ones are ticked.
 */
export default function CalmeUpcoming({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const connections = useConnections(LIBRARY_ARR_TYPES);
  const sources = chosenSources(connections, settings);
  const display = pick(settings.display, DISPLAYS, 'agenda');
  const { data, error, mutate, stale } = useWidgetData<UpcomingResponse>('/api/widgets/arr/upcoming', widgetId, settings, { refreshMs: 15 * 60_000, isVisible, method: 'GET', enabled: sources.length > 0 });
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const title = t('widget.media-upcoming.name');
  const items = (data?.items ?? []).filter(item => settings.downloaded !== false || !item.hasFile);

  return (
    <CalmeWidget title={title} editMode={editMode} aside={<FailuresNote failures={data?.failures} />}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-arr', label: t('widgets.arr.manage') }}>
          {(draft, change) => <UpcomingSettings draft={draft} change={change} />}
        </WidgetSettingsButton>
      )}
      <div ref={box} className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connections.length ? <ArrSetup kind="arr" />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true">{[0, 1, 2].map(row => <span key={row} className="ndw-skeleton-row" />)}</div>
              : items.length === 0 ? <div className="ndc-empty">{t('widgets.arr.nothingSoon', { count: bounded(settings.days, 1, 60, 14) })}</div>
                : display === 'posters' ? <UpcomingPosters items={items} now={data.fetchedAt} />
                  : display === 'list' ? <UpcomingList items={items} now={data.fetchedAt} columns={columnsOf(settings, width, 260)} />
                    : <Agenda items={items} now={data.fetchedAt} columns={columnsOf(settings, width, 280)} />}
      </div>
    </CalmeWidget>
  );
}

function Row({ item, now, showDay }: { item: UpcomingItem; now: number; showDay?: boolean }) {
  const when = useWhen();
  const line = useLine();
  const { t } = useI18n();
  const body = (
    <>
      <MediaPoster item={posterItem(item)} width={30} />
      <span className="ndw-media-row-text">
        <span className="ndw-media-title">{item.title}</span>
        <span className="ndw-media-sub">{line(item)}</span>
      </span>
      <span className="ndw-arr-when">
        {item.hasFile && <span className="ndw-arr-got" title={t('widgets.arr.downloaded')} aria-label={t('widgets.arr.downloaded')}><Check size={11} /></span>}
        <span className="ndw-media-time">{showDay ? when.day(item.at, now, true) : item.kind === 'episode' ? when.time(item.at) : ''}</span>
      </span>
    </>
  );
  return item.link
    ? <a className="ndw-media-row" href={item.link} target="_blank" rel="noopener noreferrer">{body}</a>
    : <span className="ndw-media-row">{body}</span>;
}

/** Day headings (today, tomorrow, Thursday 23 October…), the day's titles beneath. */
function Agenda({ items, now, columns }: { items: UpcomingItem[]; now: number; columns: number }) {
  const when = useWhen();
  const days = useMemo(() => {
    const groups = new Map<number, UpcomingItem[]>();
    for (const item of [...items].sort((a, b) => a.at - b.at)) {
      const key = dayOf(item.at);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()];
  }, [items]);
  return (
    <div className="ndw-arr-agenda" style={{ '--ndw-cols': columns } as React.CSSProperties}>
      {days.map(([day, list]) => (
        <section key={day} className="ndw-arr-day">
          <h4 className={`ndw-arr-day-title ${dayOf(now) === day ? 'is-today' : ''}`}>{when.day(day, now)}</h4>
          <ColumnRows columns={1}>{list.map(item => <Row key={item.id} item={item} now={now} />)}</ColumnRows>
        </section>
      ))}
    </div>
  );
}

function UpcomingList({ items, now, columns }: { items: UpcomingItem[]; now: number; columns: number }) {
  return <ColumnRows columns={columns}>{[...items].sort((a, b) => a.at - b.at).map(item => <Row key={item.id} item={item} now={now} showDay />)}</ColumnRows>;
}

/** Posters in a row, the day on each. */
function UpcomingPosters({ items, now }: { items: UpcomingItem[]; now: number }) {
  const when = useWhen();
  const line = useLine();
  return (
    <div className="ndw-media-poster-row">
      {[...items].sort((a, b) => a.at - b.at).map(item => {
        const body = (
          <>
            <span className="ndw-media-poster-wrap">
              <MediaPoster item={posterItem(item)} width={104} frame />
              <span className="ndw-arr-poster-day">{when.day(item.at, now, true)}</span>
            </span>
            <span className="ndw-media-card-title">{item.kind === 'episode' && item.subtitle ? item.subtitle : item.title}</span>
            <span className="ndw-media-card-sub">{item.kind === 'episode' ? line(item).replace(`${item.subtitle} · `, '') : line(item)}</span>
          </>
        );
        return item.link
          ? <a key={item.id} className="ndw-media-tile" style={{ width: 104 }} href={item.link} target="_blank" rel="noopener noreferrer" title={item.title}>{body}</a>
          : <span key={item.id} className="ndw-media-tile" style={{ width: 104 }} title={item.title}>{body}</span>;
      })}
    </div>
  );
}

function UpcomingSettings({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  const connections = useConnections(LIBRARY_ARR_TYPES);
  const kinds = Array.isArray(draft.kinds) ? KINDS.filter(kind => (draft.kinds as unknown[]).includes(kind)) : [...KINDS];
  const display = pick(draft.display, DISPLAYS, 'agenda');
  return (
    <>
      <SourcesField connections={connections} draft={draft} change={change} />
      <CalmeField label={t('widgets.display')}>
        <CalmeSegmented label={t('widgets.display')} value={display} options={DISPLAYS.map(value => ({ value, label: t(`widgets.arr.upcoming.${value}`) }))} onChange={value => change({ display: value })} />
      </CalmeField>
      <CalmeRow label={t('widgets.arr.days')}>
        <CalmeSlider label={t('widgets.arr.days')} value={bounded(draft.days, 1, 60, 14)} min={1} max={60} step={1} onChange={value => change({ days: value })} onCommit={value => change({ days: value })} format={value => t('widgets.arr.daysValue', { count: value })} />
      </CalmeRow>
      <CalmeField label={t('widgets.media.kinds')}>
        <div className="ndc-dlg-stack">
          {KINDS.map(kind => (
            <CalmeCheckRow key={kind} checked={kinds.includes(kind)} onChange={() => {
              const next = kinds.includes(kind) ? kinds.filter(item => item !== kind) : [...kinds, kind];
              if (next.length) change({ kinds: next.length === KINDS.length ? null : KINDS.filter(item => next.includes(item)) });
            }}>
              <span className="ndc-dlg-name">{t(`widgets.arr.kind.${kind}`)}</span>
            </CalmeCheckRow>
          ))}
        </div>
      </CalmeField>
      <CalmeRow label={t('widgets.arr.showDownloaded')}>
        <CalmeSwitch label={t('widgets.arr.showDownloaded')} checked={draft.downloaded !== false} onChange={on => change({ downloaded: on ? null : false })} />
      </CalmeRow>
      {display !== 'posters' && <ColumnsSetting draft={draft} change={change} />}
    </>
  );
}
