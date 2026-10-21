'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Search, X } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { LIBRARY_ARR_TYPES, MEDIA_SERVER_TYPES, type CatalogHit, type CatalogKind, type ExternalItem, type FollowUpItem, type ReleasePhase, type UpcomingItem, type UpcomingResponse, type WatchEntry } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { useConfig } from '@/hooks/useConfig';
import { CalmeField, CalmeCheckRow } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, ColumnRows, columnsOf, ColumnsSetting, DataError, pick, Pager, useBoxWidth, usePage, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { chosenConnection, ConnectionPicker } from '@/components/widgets/content/ConnectionPicker';
import { MediaPoster } from '@/components/widgets/media/shared';
import { Hero } from '@/components/widgets/media/visual';
import { chosenSources, FailuresNote, SourcesField, useConnections } from '@/components/widgets/media/arr';
import { SetupGuide } from '@/components/integrations/SetupGuide';

type Source = 'arr' | 'library' | 'external';
const SOURCES: readonly Source[] = ['arr', 'library', 'external'];
type Display = 'feature' | 'list' | 'posters';
const DISPLAYS: readonly Display[] = ['feature', 'list', 'posters'];
type Kind = 'episode' | 'movie' | 'album';
const KINDS: readonly Kind[] = ['episode', 'movie', 'album'];
const CATALOG_KINDS: readonly CatalogKind[] = ['series', 'anime', 'movie'];
const PHASES: readonly ReleasePhase[] = ['current', 'announced'];
const DAY = 86_400_000;

/** The sources a widget reads, in their priority order (legacy `source: 'library'` included). */
function sourcesOf(settings: WidgetSettings): Source[] {
  if (Array.isArray(settings.sources)) {
    const list = settings.sources.filter((value, index, all): value is Source => SOURCES.includes(value as Source) && all.indexOf(value) === index);
    if (list.length) return list;
  }
  return settings.source === 'library' ? ['library'] : ['arr'];
}
const watchlistOf = (settings: WidgetSettings): WatchEntry[] => Array.isArray(settings.watchlist)
  ? (settings.watchlist as unknown[]).filter((entry): entry is WatchEntry => !!entry && typeof entry === 'object' && typeof (entry as WatchEntry).id === 'string' && typeof (entry as WatchEntry).title === 'string')
  : [];

/** Start of the day of a time, in this browser's time zone. */
const dayOf = (time: number) => { const date = new Date(time); date.setHours(0, 0, 0, 0); return date.getTime(); };

function useWhen() {
  const { t, locale } = useI18n();
  return useMemo(() => {
    const short = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
    const year = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
    const days = (at: number, now: number) => Math.round((dayOf(at) - dayOf(now)) / DAY);
    return {
      /** Today, tomorrow, "Thu 23 Oct", or "12 Nov" / "12 Nov 2027" further away. */
      day: (at: number, now: number) => {
        const diff = days(at, now);
        if (diff === 0) return t('widgets.arr.today');
        if (diff === 1) return t('widgets.arr.tomorrow');
        if (diff === -1) return t('widgets.arr.yesterday');
        if (Math.abs(diff) < 7) return short.format(at);
        return (new Date(at).getFullYear() === new Date(now).getFullYear() ? date : year).format(at);
      },
      time: (at: number) => time.format(at),
      days,
    };
  }, [locale, t]);
}

/** One line of the widget, whatever its source. */
interface Entry {
  key: string;
  origin: Source;
  /** The name people know (the series, the movie, the album). */
  name: string;
  /** "S2 · E5", "Season 3 coming", "Still running · no date yet", the release kind… */
  line: string;
  at?: number;
  /** Episodes air at a time; other dates are days. */
  timed?: boolean;
  phase: ReleasePhase;
  done?: boolean;
  quiet?: boolean;
  /** Where it comes from: the *arr, the network, the catalogue. */
  from?: string;
  poster?: string;
  backdrop?: string;
  link?: string;
  kind: 'episode' | 'movie' | 'album';
}

/** Every source's answers as one list: each source in its priority, soonest first, a title kept once. */
function useEntries(data: UpcomingResponse | undefined, sources: Source[], showDownloaded: boolean): Entry[] {
  const { t } = useI18n();
  return useMemo(() => {
    if (!data) return [];
    const code = (season?: number, episode?: number) => season !== undefined && episode !== undefined ? t('widgets.media.episodeCode', { season, episode }) : '';
    // Without episode numbers (Kitsu gives only the next date): words, never a template with holes.
    const statusLine = (status: 'airing' | 'upcoming' | 'announced' | 'ended') => t(`widgets.arr.status.line.${status}`);
    const fromArr = (item: UpcomingItem): Entry => ({
      key: `arr:${item.id}`, origin: 'arr', name: item.kind === 'episode' && item.subtitle ? item.subtitle : item.title,
      line: item.kind === 'episode' ? [code(item.season, item.episode), item.title && item.title !== item.subtitle ? `« ${item.title} »` : ''].filter(Boolean).join(' · ')
        : item.kind === 'movie' ? (item.release ? t(`widgets.arr.release.${item.release}`) : '') : item.subtitle ?? '',
      at: item.at, timed: item.kind === 'episode', phase: item.phase ?? (item.kind === 'episode' && (item.episode ?? 1) > 1 ? 'current' : 'announced'), done: item.hasFile, from: item.sourceName,
      poster: item.poster, backdrop: item.backdrop, link: item.link, kind: item.kind,
    });
    const fromLibrary = (item: FollowUpItem): Entry => ({
      key: `library:${item.id}`, origin: 'library', name: item.title,
      line: [item.status === 'upcoming' && (item.episode ?? 1) <= 1 && item.season !== undefined ? t('widgets.arr.follow.season', { season: item.season })
        : item.season !== undefined && item.episode !== undefined ? code(item.season, item.episode) : statusLine(item.status),
      item.ownedSeason !== undefined ? t('widgets.arr.follow.ownedShort', { season: item.ownedSeason }) : ''].filter(Boolean).join(' · '),
      at: item.at, timed: item.status === 'airing', phase: item.phase ?? (item.status === 'airing' ? 'current' : 'announced'), quiet: item.status === 'ended', from: item.network,
      poster: item.poster, backdrop: item.backdrop, link: item.link, kind: 'episode',
    });
    const fromCatalog = (item: ExternalItem): Entry => ({
      key: `external:${item.provider}:${item.id}`, origin: 'external', name: item.title,
      line: item.season !== undefined && item.episode !== undefined ? code(item.season, item.episode) : item.kind === 'movie' ? t('widgets.arr.catalog.kind.movie') : statusLine(item.status),
      at: item.at, timed: item.kind !== 'movie' && item.status === 'airing', phase: item.phase, quiet: item.status === 'ended', from: item.network ?? t(`widgets.arr.catalog.${item.provider}`),
      poster: item.poster, backdrop: item.backdrop, link: item.link, kind: item.kind === 'movie' ? 'movie' : 'episode',
    });
    const bySource: Record<Source, Entry[]> = {
      arr: [...data.items, ...(data.items.length ? [] : data.later ?? [])].filter(item => showDownloaded || !item.hasFile).map(fromArr),
      library: (data.followUps ?? []).map(fromLibrary),
      external: (data.external ?? []).map(fromCatalog),
    };
    const soonest = (a: Entry, b: Entry) => Number(!!a.quiet) - Number(!!b.quiet) || (a.at ?? Infinity) - (b.at ?? Infinity);
    // A title present in several sources stays once, from the source ranked first.
    const seen = new Set<string>();
    return sources.flatMap(source => [...bySource[source]].sort(soonest)).filter(entry => {
      const id = entry.name.trim().toLowerCase();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [data, sources, showDownloaded, t]);
}

/**
 * What comes next, from up to three sources in the order chosen: the *arr
 * (episodes, movies, albums), the media library (the next episodes and
 * seasons of the series it holds) and public catalogues (titles followed in
 * the widget's own list, or everything coming). Two tabs: what is out or
 * airing now, and what is announced; pages beyond the chosen count.
 */
export default function CalmeUpcoming({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const sources = sourcesOf(settings);
  const connections = useConnections(LIBRARY_ARR_TYPES);
  const media = chosenConnection(config?.integrations, MEDIA_SERVER_TYPES, settings.mediaId);
  const ready = sources.some(source => source === 'external' || (source === 'library' ? !!media : chosenSources(connections, settings).length > 0));
  const display = pick(settings.display, DISPLAYS, 'feature');
  const perPage = bounded(settings.count, 1, 30, 8);
  const [tab, setTab] = useState<ReleasePhase>('current');
  const { data, error, mutate, stale } = useWidgetData<UpcomingResponse>('/api/widgets/arr/upcoming', widgetId, settings, { refreshMs: 15 * 60_000, isVisible, method: 'GET', enabled: ready });
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const entries = useEntries(data, sources, settings.downloaded !== false);
  const counts = { current: entries.filter(entry => entry.phase === 'current').length, announced: entries.filter(entry => entry.phase === 'announced').length };
  // An empty tab opens on the other one.
  const other: ReleasePhase = tab === 'current' ? 'announced' : 'current';
  const shown = counts[tab] || !counts[other] ? tab : other;
  const page = usePage(entries.filter(entry => entry.phase === shown), perPage);
  const title = t('widget.media-upcoming.name');

  let body: React.ReactNode;
  if (!ready) body = sources.includes('library') && !sources.includes('arr') ? <SetupGuide kind="media" /> : <SetupGuide kind="arr" />;
  else if (error && !data) body = <DataError error={error} onRetry={() => void mutate()} />;
  else if (!data) body = <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 150 }} />{[0, 1].map(row => <span key={row} className="ndw-skeleton-row" />)}</div>;
  else if (!entries.length) body = <div className="ndw-mx-empty"><span className="ndw-mx-calm">{t('widgets.arr.calm.title')}</span><span className="ndw-mx-meta">{t('widgets.arr.nothingFollowed')}</span></div>;
  else body = (
    <div className="ndw-mx-stack">
      <div className="ndw-mx-tabs" role="tablist" aria-label={title}>
        {PHASES.map(phase => (
          <button key={phase} type="button" role="tab" aria-selected={shown === phase} className={shown === phase ? 'is-on' : ''} onClick={() => { setTab(phase); page.setPage(0); }}>
            {t(`widgets.arr.phase.${phase}`)}<span>{counts[phase]}</span>
          </button>
        ))}
      </div>
      {display === 'posters' ? <Posters entries={page.visible} now={data.fetchedAt} width={width} />
        : display === 'list' || page.page > 0 ? <Rows entries={page.visible} now={data.fetchedAt} columns={columnsOf(settings, width, 300)} />
          : <Feature entries={page.visible} now={data.fetchedAt} columns={columnsOf(settings, width, 300)} />}
      <Pager page={page.page} pages={page.pages} onChange={page.setPage} />
    </div>
  );

  return (
    <CalmeWidget title={title} editMode={editMode} aside={<FailuresNote failures={data?.failures} />}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-arr', label: t('widgets.arr.manage') }} width={620}>
          {(draft, change) => <UpcomingSettings draft={draft} change={change} />}
        </WidgetSettingsButton>
      )}
      <div ref={box} className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>{body}</div>
    </CalmeWidget>
  );
}

const posterOf = (entry: Entry) => ({ id: entry.key, kind: entry.kind === 'album' ? 'album' as const : entry.kind === 'movie' ? 'movie' as const : 'episode' as const, title: entry.name, poster: entry.poster });

function When({ entry, now }: { entry: Entry; now: number }) {
  const { t } = useI18n();
  const when = useWhen();
  if (entry.at === undefined) return <span className="ndw-mx-when is-quiet">{entry.quiet ? t('widgets.arr.follow.endedShort') : t('widgets.arr.noDate')}</span>;
  const days = when.days(entry.at, now);
  return <span className={`ndw-mx-when ${days >= 0 && days <= 1 ? 'is-accent' : ''}`}>{when.day(entry.at, now)}</span>;
}

/** The first entry large over its art, the others in rows. */
function Feature({ entries, now, columns }: { entries: Entry[]; now: number; columns: number }) {
  const { t } = useI18n();
  const when = useWhen();
  const [first, ...rest] = entries;
  if (!first) return null;
  const days = first.at !== undefined ? when.days(first.at, now) : undefined;
  return (
    <>
      <Hero href={first.link} backdrop={first.backdrop ?? first.poster} blurred={!first.backdrop} poster={<MediaPoster item={posterOf(first)} width={88} eager />}>
        <span className="ndw-mx-eyebrow is-accent">
          {first.at === undefined ? t('widgets.arr.noDate') : [when.day(first.at, now), first.timed ? when.time(first.at) : '', days !== undefined && days > 1 ? t('widgets.arr.inDays', { count: days }) : ''].filter(Boolean).join(' · ')}
        </span>
        <span className="ndw-mx-display">{first.name}</span>
        <span className="ndw-mx-meta">{first.line}</span>
        <span className="ndw-mx-meta is-quiet">{[first.from, first.done ? t('widgets.arr.downloaded') : ''].filter(Boolean).join(' · ')}</span>
      </Hero>
      {rest.length > 0 && <Rows entries={rest} now={now} columns={columns} />}
    </>
  );
}

function Rows({ entries, now, columns }: { entries: Entry[]; now: number; columns: number }) {
  const { t } = useI18n();
  return (
    <ColumnRows columns={columns} className="ndw-mx-follow">
      {entries.map(entry => {
        const body = (
          <>
            <MediaPoster item={posterOf(entry)} width={40} />
            <span className="ndw-media-row-text">
              <span className="ndw-media-title">{entry.name}</span>
              <span className="ndw-media-sub">{entry.line}</span>
            </span>
            <span className="ndw-mx-end">
              <When entry={entry} now={now} />
              <span className="ndw-media-time">{entry.done ? t('widgets.arr.downloaded') : entry.from}</span>
            </span>
          </>
        );
        return entry.link
          ? <a key={entry.key} className="ndw-media-row" href={entry.link} target="_blank" rel="noopener noreferrer">{body}</a>
          : <span key={entry.key} className="ndw-media-row">{body}</span>;
      })}
    </ColumnRows>
  );
}

function Posters({ entries, now, width }: { entries: Entry[]; now: number; width: number }) {
  const { t } = useI18n();
  const when = useWhen();
  const columns = Math.max(2, Math.min(8, Math.floor((width + 12) / 120)));
  return (
    <div className="ndw-mx-rail" style={{ '--ndw-cols': columns } as React.CSSProperties}>
      {entries.map(entry => {
        const card = (
          <>
            <span className="ndw-mx-rail-art">
              <MediaPoster item={posterOf(entry)} width={200} frame />
              <span className="ndw-mx-rail-day">{entry.at === undefined ? t('widgets.arr.noDate') : when.day(entry.at, now)}</span>
              {entry.done && <span className="ndw-mx-rail-got" aria-label={t('widgets.arr.downloaded')} title={t('widgets.arr.downloaded')}><Check size={11} /></span>}
            </span>
            <span className="ndw-mx-rail-title">{entry.name}</span>
            <span className="ndw-mx-rail-sub">{entry.line}</span>
          </>
        );
        return entry.link
          ? <a key={entry.key} className="ndw-mx-rail-item" href={entry.link} target="_blank" rel="noopener noreferrer">{card}</a>
          : <span key={entry.key} className="ndw-mx-rail-item">{card}</span>;
      })}
    </div>
  );
}

function UpcomingSettings({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  const connections = useConnections(LIBRARY_ARR_TYPES);
  const sources = sourcesOf(draft);
  const kinds = Array.isArray(draft.kinds) ? KINDS.filter(kind => (draft.kinds as unknown[]).includes(kind)) : [...KINDS];
  const display = pick(draft.display, DISPLAYS, 'feature');
  const setSources = (next: Source[]) => change({ sources: next.length === 1 && next[0] === 'arr' ? null : next, source: null });
  const move = (index: number, by: number) => {
    const next = [...sources];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setSources(next);
  };
  return (
    <>
      <CalmeField label={t('widgets.arr.sources.title')} info={t('widgets.arr.sources.hint')}>
        <div className="ndc-dlg-stack">
          {[...sources, ...SOURCES.filter(source => !sources.includes(source))].map(source => {
            const index = sources.indexOf(source), on = index >= 0;
            return (
              <div key={source} className="ndw-mx-source-row">
                <CalmeCheckRow checked={on} onChange={() => { if (on && sources.length === 1) return; setSources(on ? sources.filter(item => item !== source) : [...sources, source]); }}>
                  <span className="ndc-dlg-name">{t(`widgets.arr.source.${source}`)}</span>
                </CalmeCheckRow>
                {on && sources.length > 1 && (
                  <span className="ndw-mx-order">
                    <button type="button" className="ndc-icon-button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t('widgets.arr.sources.up')} title={t('widgets.arr.sources.up')}><ArrowUp size={13} /></button>
                    <button type="button" className="ndc-icon-button" disabled={index === sources.length - 1} onClick={() => move(index, 1)} aria-label={t('widgets.arr.sources.down')} title={t('widgets.arr.sources.down')}><ArrowDown size={13} /></button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CalmeField>
      <CalmeField label={t('widgets.display')}>
        <CalmeSegmented label={t('widgets.display')} value={display} options={DISPLAYS.map(value => ({ value, label: t(`widgets.arr.upcoming.${value}`) }))} onChange={value => change({ display: value === 'feature' ? null : value })} />
      </CalmeField>
      <CalmeRow label={t('widgets.arr.perPage')}>
        <CalmeSlider label={t('widgets.arr.perPage')} value={bounded(draft.count, 1, 30, 8)} min={1} max={30} step={1} onChange={value => change({ count: value })} onCommit={value => change({ count: value })} format={String} />
      </CalmeRow>
      {display !== 'posters' && <ColumnsSetting draft={draft} change={change} />}

      {sources.includes('arr') && (
        <>
          <h4 className="ndw-mx-settings-head">{t('widgets.arr.source.arr')}</h4>
          <SourcesField connections={connections} draft={draft} change={change} />
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
        </>
      )}
      {sources.includes('library') && (
        <>
          <h4 className="ndw-mx-settings-head">{t('widgets.arr.source.library')}</h4>
          <CalmeField label={t('widgets.media.server')} info={t('widgets.arr.follow.hint')}>
            <ConnectionPicker types={MEDIA_SERVER_TYPES} section="media" value={typeof draft.mediaId === 'string' ? draft.mediaId : undefined} onChange={id => change({ mediaId: id })} />
          </CalmeField>
        </>
      )}
      {sources.includes('external') && <CatalogSettings draft={draft} change={change} />}
      {(sources.includes('library') || sources.includes('external')) && (
        <CalmeRow label={t('widgets.arr.follow.showEnded')}>
          <CalmeSwitch label={t('widgets.arr.follow.showEnded')} checked={draft.ended === true} onChange={on => change({ ended: on ? true : null })} />
        </CalmeRow>
      )}
    </>
  );
}

/** Public catalogues: titles of one's own list (found by searching), or everything coming. */
function CatalogSettings({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  const mode = pick(draft.externalMode, ['watchlist', 'all'] as const, 'watchlist');
  const watchlist = watchlistOf(draft);
  const kinds = Array.isArray(draft.catalogKinds) ? CATALOG_KINDS.filter(kind => (draft.catalogKinds as unknown[]).includes(kind)) : [...CATALOG_KINDS];
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CatalogHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const followed = (hit: CatalogHit) => watchlist.some(entry => entry.provider === hit.provider && entry.id === hit.id);
  const save = (next: WatchEntry[]) => change({ watchlist: (next.length ? next : null) as unknown as WidgetSettings[string] });
  const search = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true); setFailed(false);
    try {
      const response = await fetch(`/api/widgets/arr/catalog?${new URLSearchParams({ q, kinds: CATALOG_KINDS.join(',') })}`);
      if (!response.ok) throw new Error(String(response.status));
      setHits(await response.json() as CatalogHit[]);
    } catch { setFailed(true); setHits(null); }
    finally { setSearching(false); }
  };
  return (
    <>
      <h4 className="ndw-mx-settings-head">{t('widgets.arr.source.external')}</h4>
      <CalmeField label={t('widgets.arr.catalog.mode')} info={t('widgets.arr.catalog.hint')}>
        <CalmeSegmented label={t('widgets.arr.catalog.mode')} value={mode} options={(['watchlist', 'all'] as const).map(value => ({ value, label: t(`widgets.arr.catalog.mode.${value}`) }))} onChange={value => change({ externalMode: value === 'watchlist' ? null : value })} />
      </CalmeField>
      {mode === 'all' ? (
        <CalmeField label={t('widgets.media.kinds')}>
          <div className="ndc-dlg-stack">
            {CATALOG_KINDS.map(kind => (
              <CalmeCheckRow key={kind} checked={kinds.includes(kind)} onChange={() => {
                const next = kinds.includes(kind) ? kinds.filter(item => item !== kind) : [...kinds, kind];
                if (next.length) change({ catalogKinds: next.length === CATALOG_KINDS.length ? null : CATALOG_KINDS.filter(item => next.includes(item)) });
              }}>
                <span className="ndc-dlg-name">{t(`widgets.arr.catalog.kind.${kind}`)}</span>
              </CalmeCheckRow>
            ))}
          </div>
        </CalmeField>
      ) : (
        <>
          <form className="ndw-mx-search" onSubmit={event => { event.preventDefault(); void search(); }}>
            <Search size={14} aria-hidden="true" />
            <input className="ndc-input" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('widgets.arr.catalog.searchPlaceholder')} aria-label={t('widgets.arr.catalog.search')} maxLength={80} />
            <button type="submit" className="nd-btn" disabled={searching || query.trim().length < 2}>{t('widgets.arr.catalog.search')}</button>
          </form>
          {failed && <p className="ndw-note ndw-down">{t('widgets.arr.catalog.failed')}</p>}
          {hits && (hits.length === 0 ? <p className="ndw-note">{t('widgets.arr.catalog.noHit')}</p> : (
            <ul className="ndw-mx-hits">
              {hits.map(hit => (
                <li key={`${hit.provider}:${hit.id}`}>
                  <MediaPoster item={{ id: `${hit.provider}:${hit.id}`, kind: hit.kind === 'movie' ? 'movie' : 'series', title: hit.title, poster: hit.poster }} width={30} />
                  <span className="ndw-media-row-text">
                    <span className="ndw-media-title">{hit.title}</span>
                    <span className="ndw-media-sub">{[t(`widgets.arr.catalog.kind.${hit.kind}`), hit.year, t(`widgets.arr.catalog.${hit.provider}`)].filter(Boolean).join(' · ')}</span>
                  </span>
                  {followed(hit)
                    ? <span className="ndw-media-time">{t('widgets.arr.catalog.followed')}</span>
                    : <button type="button" className="ndc-icon-button" onClick={() => save([...watchlist, { provider: hit.provider, id: hit.id, kind: hit.kind, title: hit.title }])} aria-label={t('widgets.arr.catalog.follow', { title: hit.title })} title={t('widgets.arr.catalog.follow', { title: hit.title })}><Plus size={14} /></button>}
                </li>
              ))}
            </ul>
          ))}
          <CalmeField label={t('widgets.arr.catalog.list', { count: watchlist.length })}>
            {watchlist.length === 0 ? <p className="ndw-note">{t('widgets.arr.catalog.empty')}</p> : (
              <ul className="ndw-mx-hits">
                {watchlist.map(entry => (
                  <li key={`${entry.provider}:${entry.id}`}>
                    <span className="ndw-media-row-text">
                      <span className="ndw-media-title">{entry.title}</span>
                      <span className="ndw-media-sub">{[t(`widgets.arr.catalog.kind.${entry.kind}`), t(`widgets.arr.catalog.${entry.provider}`)].join(' · ')}</span>
                    </span>
                    <button type="button" className="ndc-icon-button" onClick={() => save(watchlist.filter(item => item !== entry))} aria-label={t('widgets.arr.catalog.unfollow', { title: entry.title })} title={t('widgets.arr.catalog.unfollow', { title: entry.title })}><X size={13} /></button>
                  </li>
                ))}
              </ul>
            )}
          </CalmeField>
        </>
      )}
    </>
  );
}
