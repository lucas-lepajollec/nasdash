'use client';

import React, { useMemo } from 'react';
import { Check } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { LIBRARY_ARR_TYPES, MEDIA_SERVER_TYPES, type FollowUpItem, type UpcomingItem, type UpcomingResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { useConfig } from '@/hooks/useConfig';
import { CalmeField, CalmeCheckRow } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, ColumnRows, columnsOf, ColumnsSetting, DataError, pick, useBoxWidth, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { chosenConnection, ConnectionPicker } from '@/components/widgets/content/ConnectionPicker';
import { MediaPoster } from '@/components/widgets/media/shared';
import { Hero } from '@/components/widgets/media/visual';
import { ArrSetup, chosenSources, FailuresNote, SourcesField, useConnections } from '@/components/widgets/media/arr';
import { SetupGuide } from '@/components/integrations/SetupGuide';

type Source = 'arr' | 'library';
const SOURCES: readonly Source[] = ['arr', 'library'];
type Display = 'feature' | 'agenda' | 'list';
const DISPLAYS: readonly Display[] = ['feature', 'agenda', 'list'];
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
    const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
    const year = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
    const day = (at: number, now: number, compact = false) => {
      const diff = Math.round((dayOf(at) - dayOf(now)) / DAY);
      if (diff === 0) return t('widgets.arr.today');
      if (diff === 1) return t('widgets.arr.tomorrow');
      if (diff === -1) return t('widgets.arr.yesterday');
      return (compact ? short : weekday).format(at);
    };
    return {
      day,
      time: (at: number) => time.format(at),
      /** "12 Nov", or with the year when it is not this one. */
      date: (at: number, now: number) => (new Date(at).getFullYear() === new Date(now).getFullYear() ? date : year).format(at),
      days: (at: number, now: number) => Math.max(0, Math.round((dayOf(at) - dayOf(now)) / DAY)),
    };
  }, [locale, t]);
}

/** "Series · S2 · E5", "Artist", or the movie's release kind. */
function useLine() {
  const { t } = useI18n();
  return (item: UpcomingItem, withSeries = true) => {
    if (item.kind === 'episode') return [withSeries ? item.subtitle : '', item.season !== undefined && item.episode !== undefined ? t('widgets.media.episodeCode', { season: item.season, episode: item.episode }) : ''].filter(Boolean).join(' · ');
    if (item.kind === 'movie') return item.release ? t(`widgets.arr.release.${item.release}`) : '';
    return item.subtitle ?? '';
  };
}

/** The name people know: the series for an episode, else the title itself. */
const headline = (item: UpcomingItem) => item.kind === 'episode' && item.subtitle ? item.subtitle : item.title;
const posterItem = (item: { id: string; title: string; poster?: string }, kind: 'episode' | 'movie' | 'album' = 'episode') => ({ id: item.id, kind, title: item.title, poster: item.poster });
const posterOf = (item: UpcomingItem) => posterItem({ id: item.id, title: headline(item), poster: item.poster }, item.kind === 'album' ? 'album' : item.kind === 'movie' ? 'movie' : 'episode');

/**
 * What comes next. From Sonarr, Radarr and Lidarr (episodes, movies with
 * their cinema, digital or physical release, albums), or from the media
 * library itself: the next episodes and seasons of the series it holds.
 * A quiet week shows the next release and the days until it.
 */
export default function CalmeUpcoming({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const source = pick(settings.source, SOURCES, 'arr');
  const connections = useConnections(LIBRARY_ARR_TYPES);
  const media = chosenConnection(config?.integrations, MEDIA_SERVER_TYPES, settings.mediaId);
  const ready = source === 'library' ? !!media : chosenSources(connections, settings).length > 0;
  const display = pick(settings.display, DISPLAYS, 'feature');
  const { data, error, mutate, stale } = useWidgetData<UpcomingResponse>('/api/widgets/arr/upcoming', widgetId, settings, { refreshMs: 15 * 60_000, isVisible, method: 'GET', enabled: ready });
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const title = t('widget.media-upcoming.name');
  const items = (data?.items ?? []).filter(item => settings.downloaded !== false || !item.hasFile).sort((a, b) => a.at - b.at);

  let body: React.ReactNode;
  if (source === 'library' && !media) body = <SetupGuide kind="media" />;
  else if (source === 'arr' && !connections.length) body = <ArrSetup kind="arr" />;
  else if (error && !data) body = <DataError error={error} onRetry={() => void mutate()} />;
  else if (!data) body = <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 150 }} />{[0, 1].map(row => <span key={row} className="ndw-skeleton-row" />)}</div>;
  else if (source === 'library') body = <FollowUps items={data.followUps ?? []} now={data.fetchedAt} columns={columnsOf(settings, width, 300)} />;
  else if (!items.length) body = <Quiet later={data.later ?? []} now={data.fetchedAt} days={bounded(settings.days, 1, 60, 14)} />;
  else if (display === 'agenda') body = <Agenda items={items} now={data.fetchedAt} columns={columnsOf(settings, width, 280)} />;
  else if (display === 'list') body = <ColumnRows columns={columnsOf(settings, width, 280)}>{items.map(item => <Row key={item.id} item={item} now={data.fetchedAt} showDay />)}</ColumnRows>;
  else body = <Feature items={items} now={data.fetchedAt} width={width} />;

  return (
    <CalmeWidget title={title} editMode={editMode} aside={<FailuresNote failures={data?.failures} />}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-arr', label: t('widgets.arr.manage') }}>
          {(draft, change) => <UpcomingSettings draft={draft} change={change} />}
        </WidgetSettingsButton>
      )}
      <div ref={box} className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>{body}</div>
    </CalmeWidget>
  );
}

/** The next title large over its art, then the rest of the window as posters. */
function Feature({ items, now, width }: { items: UpcomingItem[]; now: number; width: number }) {
  const { t } = useI18n();
  const when = useWhen();
  const line = useLine();
  const [first, ...rest] = items;
  const columns = Math.max(3, Math.min(8, Math.floor((width + 14) / 118)));
  return (
    <div className="ndw-mx-stack">
      <Hero href={first.link} backdrop={first.backdrop} poster={<MediaPoster item={posterOf(first)} width={width < 420 ? 72 : 96} eager />}>
        <span className="ndw-mx-eyebrow is-accent">{[when.day(first.at, now), first.kind === 'episode' ? when.time(first.at) : ''].filter(Boolean).join(' · ')}</span>
        <span className="ndw-mx-display">{headline(first)}</span>
        <span className="ndw-mx-meta">{[line(first, false), first.kind === 'episode' && first.title !== first.subtitle ? `« ${first.title} »` : ''].filter(Boolean).join(' · ')}</span>
        <span className="ndw-mx-meta is-quiet">{[first.sourceName, first.hasFile ? t('widgets.arr.downloaded') : ''].filter(Boolean).join(' · ')}</span>
      </Hero>
      {rest.length > 0 && (
        <div className="ndw-mx-rail" style={{ '--ndw-cols': columns } as React.CSSProperties}>
          {rest.slice(0, columns * 2).map(item => {
            const card = (
              <>
                <span className="ndw-mx-rail-art">
                  <MediaPoster item={posterOf(item)} width={200} frame />
                  <span className="ndw-mx-rail-day">{when.day(item.at, now, true)}</span>
                  {item.hasFile && <span className="ndw-mx-rail-got" aria-label={t('widgets.arr.downloaded')} title={t('widgets.arr.downloaded')}><Check size={11} /></span>}
                </span>
                <span className="ndw-mx-rail-title">{headline(item)}</span>
                <span className="ndw-mx-rail-sub">{line(item, false)}</span>
              </>
            );
            return item.link
              ? <a key={item.id} className="ndw-mx-rail-item" href={item.link} target="_blank" rel="noopener noreferrer" title={item.title}>{card}</a>
              : <span key={item.id} className="ndw-mx-rail-item" title={item.title}>{card}</span>;
          })}
        </div>
      )}
    </div>
  );
}

/** Nothing in the window: say so, then the next release and the days until it. */
function Quiet({ later, now, days }: { later: UpcomingItem[]; now: number; days: number }) {
  const { t } = useI18n();
  const when = useWhen();
  const line = useLine();
  const [next, ...after] = later;
  return (
    <div className="ndw-mx-stack">
      {next ? (
        <Hero href={next.link} backdrop={next.backdrop} poster={<MediaPoster item={posterOf(next)} width={84} eager />}>
          <span className="ndw-mx-calm">{t('widgets.arr.calm.title')}</span>
          <span className="ndw-mx-meta">{t('widgets.arr.calm.until', { date: when.date(next.at, now) })}</span>
          <span className="ndw-mx-spacer" />
          <span className="ndw-mx-eyebrow is-accent">{t('widgets.arr.calm.next')}</span>
          <span className="ndw-mx-countdown"><span>{when.days(next.at, now)}</span>{t('widgets.arr.calm.days', { count: when.days(next.at, now) })}</span>
          <span className="ndw-mx-title">{[headline(next), line(next, false)].filter(Boolean).join(' · ')}</span>
          <span className="ndw-mx-meta is-quiet">{[when.day(next.at, now), next.sourceName].join(' · ')}</span>
        </Hero>
      ) : (
        <div className="ndw-mx-empty">
          <span className="ndw-mx-calm">{t('widgets.arr.calm.title')}</span>
          <span className="ndw-mx-meta">{t('widgets.arr.nothingSoon', { count: days })}</span>
        </div>
      )}
      {after.length > 0 && <ColumnRows columns={1}>{after.map(item => <Row key={item.id} item={item} now={now} showDay />)}</ColumnRows>}
    </div>
  );
}

function Row({ item, now, showDay }: { item: UpcomingItem; now: number; showDay?: boolean }) {
  const when = useWhen();
  const line = useLine();
  const { t } = useI18n();
  const body = (
    <>
      <MediaPoster item={posterOf(item)} width={34} />
      <span className="ndw-media-row-text">
        <span className="ndw-media-title">{headline(item)}</span>
        <span className="ndw-media-sub">{line(item, false) || item.sourceName}</span>
      </span>
      <span className="ndw-mx-end">
        <span className="ndw-media-time">{showDay ? when.day(item.at, now, true) : item.kind === 'episode' ? when.time(item.at) : ''}</span>
        {item.hasFile && <span className="ndw-mx-done">{t('widgets.arr.downloaded')}</span>}
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
    for (const item of items) groups.set(dayOf(item.at), [...(groups.get(dayOf(item.at)) ?? []), item]);
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

/** The library's series: what comes next for each, soonest first. */
function FollowUps({ items, now, columns }: { items: FollowUpItem[]; now: number; columns: number }) {
  const { t } = useI18n();
  const when = useWhen();
  if (!items.length) return <div className="ndw-mx-empty"><span className="ndw-mx-calm">{t('widgets.arr.follow.none')}</span><span className="ndw-mx-meta">{t('widgets.arr.follow.noneHint')}</span></div>;
  // A new season already under way reads like an airing one: its episode number.
  const what = (item: FollowUpItem) => (item.status === 'airing' || item.status === 'upcoming' && (item.episode ?? 1) > 1) && item.season !== undefined && item.episode !== undefined ? t('widgets.arr.follow.airing', { season: item.season, episode: item.episode })
    : item.status === 'upcoming' && item.season !== undefined ? t('widgets.arr.follow.season', { season: item.season })
      : t(`widgets.arr.follow.${item.status}`);
  return (
    <ColumnRows columns={columns} className="ndw-mx-follow">
      {items.map(item => {
        const body = (
          <>
            <MediaPoster item={posterItem(item)} width={44} />
            <span className="ndw-media-row-text">
              <span className="ndw-media-title">{item.title}</span>
              <span className="ndw-media-sub">{what(item)}</span>
              {item.ownedSeason !== undefined && <span className="ndw-media-sub is-quiet">{t('widgets.arr.follow.owned', { season: item.ownedSeason })}</span>}
            </span>
            <span className="ndw-mx-end">
              <span className={`ndw-mx-when ${item.status === 'airing' ? 'is-accent' : item.status === 'ended' ? 'is-quiet' : ''}`}>{item.at ? (when.days(item.at, now) < 7 ? when.day(item.at, now, true) : when.date(item.at, now)) : '—'}</span>
              {item.network && <span className="ndw-media-time">{item.network}</span>}
            </span>
          </>
        );
        return item.link
          ? <a key={item.id} className="ndw-media-row" href={item.link} target="_blank" rel="noopener noreferrer">{body}</a>
          : <span key={item.id} className="ndw-media-row">{body}</span>;
      })}
    </ColumnRows>
  );
}

function UpcomingSettings({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  const connections = useConnections(LIBRARY_ARR_TYPES);
  const source = pick(draft.source, SOURCES, 'arr');
  const kinds = Array.isArray(draft.kinds) ? KINDS.filter(kind => (draft.kinds as unknown[]).includes(kind)) : [...KINDS];
  const display = pick(draft.display, DISPLAYS, 'feature');
  return (
    <>
      <CalmeField label={t('widgets.arr.source')}>
        <CalmeSegmented label={t('widgets.arr.source')} value={source} options={SOURCES.map(value => ({ value, label: t(`widgets.arr.source.${value}`) }))} onChange={value => change({ source: value === 'arr' ? null : value })} />
      </CalmeField>
      {source === 'library' ? (
        <>
          <CalmeField label={t('widgets.media.server')} info={t('widgets.arr.follow.hint')}>
            <ConnectionPicker types={MEDIA_SERVER_TYPES} section="media" value={typeof draft.mediaId === 'string' ? draft.mediaId : undefined} onChange={id => change({ mediaId: id })} />
          </CalmeField>
          <CalmeRow label={t('widgets.arr.follow.showEnded')}>
            <CalmeSwitch label={t('widgets.arr.follow.showEnded')} checked={draft.ended === true} onChange={on => change({ ended: on ? true : null })} />
          </CalmeRow>
          <ColumnsSetting draft={draft} change={change} />
        </>
      ) : (
        <>
          <SourcesField connections={connections} draft={draft} change={change} />
          <CalmeField label={t('widgets.display')}>
            <CalmeSegmented label={t('widgets.display')} value={display} options={DISPLAYS.map(value => ({ value, label: t(`widgets.arr.upcoming.${value}`) }))} onChange={value => change({ display: value === 'feature' ? null : value })} />
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
          {display !== 'feature' && <ColumnsSetting draft={draft} change={change} />}
        </>
      )}
    </>
  );
}
