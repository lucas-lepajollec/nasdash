'use client';

import React, { useEffect, useState } from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MediaItem, MediaNowPlayingResponse, MediaSession, MediaWatched } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { ColumnRows, columnsOf, ColumnsSetting, DataError, pick, useBoxWidth, useRelativeTime, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { clock, MediaConnectionField, MediaPoster, MediaSetup, useMediaConnection } from '@/components/widgets/media/shared';
import { Backdrop, Hero, Track } from '@/components/widgets/media/visual';

type History = 'rail' | 'list' | 'none';
const HISTORIES: readonly History[] = ['rail', 'list', 'none'];

/** The clock of the page: playing sessions move on between two refreshes. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

/** Time played since the server read the sessions; bounded, so a clock gap between machines cannot run away. */
const MAX_DRIFT = 15_000;

/** The name people know (the series of an episode) and the line beneath it. */
function useNames() {
  const { t } = useI18n();
  return {
    name: (item: MediaItem) => item.kind === 'episode' && item.subtitle ? item.subtitle : item.title,
    code: (item: MediaItem) => item.kind === 'episode' && item.season !== undefined && item.episode !== undefined ? t('widgets.media.episodeCode', { season: item.season, episode: item.episode })
      : item.kind === 'movie' && item.year ? String(item.year) : item.kind === 'track' || item.kind === 'album' ? item.subtitle ?? '' : '',
  };
}

/**
 * Recently played on a Jellyfin, Emby or Plex server: what plays now, large
 * over its art (others beneath), then what was watched lately with how far,
 * like the server's own "continue watching". Nothing playing: the title to
 * resume first. Account names only when the widget allows them.
 */
export default function CalmeNowPlaying({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const connection = useMediaConnection(settings);
  const history = pick(settings.history, HISTORIES, 'rail');
  const { data, error, mutate, stale } = useWidgetData<MediaNowPlayingResponse>('/api/widgets/media/now-playing', widgetId, settings, { refreshMs: 10_000, isVisible, method: 'GET', enabled: !!connection });
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const sessions = data?.sessions ?? [];
  const now = useNow(isVisible && sessions.some(session => session.state === 'playing'));
  const title = t('widget.media-nowplaying.name');
  const elapsed = (session: MediaSession) => data && session.state === 'playing' ? Math.min(MAX_DRIFT, Math.max(0, now - data.fetchedAt)) : 0;
  const watched = data?.history ?? [];
  // Nothing playing: the first title left halfway leads, as the one to resume.
  const resume = sessions.length ? undefined : watched.find(entry => entry.progress !== undefined && entry.progress < 100) ?? watched[0];
  const rest = watched.filter(entry => entry !== resume);

  return (
    <CalmeWidget title={title} editMode={editMode} aside={sessions.length ? <span className="ndc-title-note">{t('widgets.media.streams', { count: sessions.length })}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-media', label: t('widgets.media.manage') }}>
          {(draft, change) => (
            <>
              <MediaConnectionField draft={draft} change={change} />
              <CalmeField label={t('widgets.media.watched')}>
                <CalmeSegmented label={t('widgets.media.watched')} value={pick(draft.history, HISTORIES, 'rail')} options={HISTORIES.map(value => ({ value, label: t(`widgets.media.history.${value}`) }))} onChange={value => change({ history: value === 'rail' ? null : value })} />
              </CalmeField>
              {pick(draft.history, HISTORIES, 'rail') === 'list' && <ColumnsSetting draft={draft} change={change} />}
              <CalmeRow label={t('widgets.media.showUsers')} info={t('widgets.media.showUsersHint')}>
                <CalmeSwitch label={t('widgets.media.showUsers')} checked={draft.showUsers === true} onChange={on => change({ showUsers: on || null })} />
              </CalmeRow>
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div ref={box} className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <MediaSetup settings={settings} />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 150 }} /></div>
              : (
                <div className="ndw-mx-stack">
                  {sessions.length > 0 && <Playing session={sessions[0]} elapsed={elapsed(sessions[0])} />}
                  {sessions.slice(1).map(session => <OtherSession key={session.id} session={session} elapsed={elapsed(session)} />)}
                  {resume && <Resume entry={resume} />}
                  {!resume && !sessions.length && <div className="ndw-mx-empty"><span className="ndw-mx-calm">{t('widgets.media.idle')}</span><span className="ndw-mx-meta">{data.name}</span></div>}
                  {history !== 'none' && rest.length > 0 && (
                    <div className="ndw-mx-section">
                      <span className="ndw-mx-label">{t('widgets.media.continue')}</span>
                      {history === 'list'
                        ? <ColumnRows columns={columnsOf(settings, width, 280)}>{rest.slice(0, 8).map(entry => <WatchedRow key={entry.item.id} entry={entry} />)}</ColumnRows>
                        : <WatchedRail entries={rest} width={width} />}
                    </div>
                  )}
                  {history !== 'none' && !watched.length && (data.recent?.length ?? 0) > 0 && (
                    <div className="ndw-mx-section">
                      <span className="ndw-mx-label">{t('widgets.media.latest')}</span>
                      <WatchedRail entries={data.recent!.map(item => ({ item }))} width={width} />
                    </div>
                  )}
                </div>
              )}
      </div>
    </CalmeWidget>
  );
}

/** What plays now, large over its art. */
function Playing({ session, elapsed }: { session: MediaSession; elapsed: number }) {
  const { t } = useI18n();
  const { name, code } = useNames();
  const { item } = session;
  const position = session.positionMs === undefined ? undefined : Math.min(item.durationMs ?? Infinity, session.positionMs + elapsed);
  const paused = session.state !== 'playing';
  return (
    <Hero href={item.link} backdrop={item.backdrop} poster={<MediaPoster item={item} width={92} eager />}>
      <span className={`ndw-mx-eyebrow ${paused ? '' : 'is-accent'}`}>{[t(paused ? 'widgets.media.paused' : 'widgets.media.playing'), session.user].filter(Boolean).join(' · ')}</span>
      <span className="ndw-mx-display">{name(item)}</span>
      <span className="ndw-mx-meta">{[code(item), item.kind === 'episode' ? `« ${item.title} »` : ''].filter(Boolean).join(' · ')}</span>
      {item.durationMs !== undefined && position !== undefined && (
        <span className="ndw-mx-progress">
          <Track value={position / item.durationMs * 100} tone={paused ? 'muted' : undefined} />
          <span className="ndw-media-time">{clock(position)} / {clock(item.durationMs)}</span>
        </span>
      )}
      <span className="ndw-mx-meta is-quiet">{[session.player, session.quality, session.method ? t(`widgets.media.method.${session.method}`) : ''].filter(Boolean).join(' · ')}</span>
    </Hero>
  );
}

/** A second or third session, one line. */
function OtherSession({ session, elapsed }: { session: MediaSession; elapsed: number }) {
  const { t } = useI18n();
  const { name, code } = useNames();
  const { item } = session;
  const position = session.positionMs === undefined ? undefined : Math.min(item.durationMs ?? Infinity, session.positionMs + elapsed);
  const paused = session.state !== 'playing';
  return (
    <div className="ndw-mx-qrow">
      <MediaPoster item={item} width={38} />
      <span className="ndw-mx-qrow-text">
        <span className="ndw-mx-qrow-head">
          <span className="ndw-media-title">{name(item)}</span>
          <span className={`ndw-mx-state ${paused ? '' : 'is-accent'}`}>{[t(paused ? 'widgets.media.paused' : 'widgets.media.playing'), session.user].filter(Boolean).join(' · ')}</span>
        </span>
        {item.durationMs !== undefined && position !== undefined && <Track thin value={position / item.durationMs * 100} tone={paused ? 'muted' : undefined} />}
        <span className="ndw-media-sub">{[code(item), session.player, session.quality].filter(Boolean).join(' · ')}</span>
      </span>
    </div>
  );
}

/** Nothing playing: the title to pick up again, large. */
function Resume({ entry }: { entry: MediaWatched }) {
  const { t } = useI18n();
  const relative = useRelativeTime();
  const { name, code } = useNames();
  const { item } = entry;
  const partial = entry.progress !== undefined && entry.progress < 100;
  return (
    <Hero href={item.link} backdrop={item.backdrop} poster={<MediaPoster item={item} width={84} eager />}>
      <span className="ndw-mx-eyebrow is-accent">{t(partial ? 'widgets.media.resume' : 'widgets.media.lastWatched')}</span>
      <span className="ndw-mx-display">{name(item)}</span>
      <span className="ndw-mx-meta">{[code(item), partial && entry.remainingMs ? t('widgets.media.remaining', { time: clock(entry.remainingMs) }) : ''].filter(Boolean).join(' · ')}</span>
      {partial && <span className="ndw-mx-progress is-short"><Track value={entry.progress!} /></span>}
      <span className="ndw-mx-meta is-quiet">{[t('widgets.media.idle'), entry.watchedAt ? relative(entry.watchedAt) : '', entry.user].filter(Boolean).join(' · ')}</span>
    </Hero>
  );
}

/** "12 min left", "watched", or nothing when the server does not tell. */
function useStatus() {
  const { t } = useI18n();
  return (entry: MediaWatched) => entry.progress === undefined ? '' : entry.progress >= 100 ? t('widgets.media.finished')
    : entry.remainingMs ? t('widgets.media.remaining', { time: clock(entry.remainingMs) }) : `${Math.round(entry.progress)} %`;
}

/** Wide pictures with the progress along their foot, like "continue watching". */
function WatchedRail({ entries, width }: { entries: MediaWatched[]; width: number }) {
  const { name, code } = useNames();
  const status = useStatus();
  const columns = Math.max(2, Math.min(5, Math.floor((width + 12) / 190)));
  return (
    <div className="ndw-mx-rail is-wide" style={{ '--ndw-cols': columns } as React.CSSProperties}>
      {entries.slice(0, columns * 2).map(entry => {
        const { item } = entry;
        const body = (
          <>
            <span className="ndw-mx-thumb">
              <Backdrop src={item.backdrop ?? item.poster} blur={!item.backdrop} />
              {entry.progress !== undefined && <span className="ndw-mx-thumb-track"><Track thin value={entry.progress} tone={entry.progress >= 100 ? 'done' : undefined} /></span>}
            </span>
            <span className="ndw-mx-rail-title">{name(item)}</span>
            <span className="ndw-mx-rail-sub">{[code(item), status(entry)].filter(Boolean).join(' · ')}</span>
          </>
        );
        return item.link
          ? <a key={item.id} className="ndw-mx-rail-item" href={item.link} target="_blank" rel="noopener noreferrer" title={item.title}>{body}</a>
          : <span key={item.id} className="ndw-mx-rail-item" title={item.title}>{body}</span>;
      })}
    </div>
  );
}

/** The list form, like Recently added, with the progress beneath. */
function WatchedRow({ entry }: { entry: MediaWatched }) {
  const relative = useRelativeTime();
  const { name, code } = useNames();
  const status = useStatus();
  const { item } = entry;
  const body = (
    <>
      <MediaPoster item={item} width={40} />
      <span className="ndw-mx-qrow-text">
        <span className="ndw-mx-qrow-head">
          <span className="ndw-media-title">{name(item)}</span>
          {entry.watchedAt && <span className="ndw-media-time">{relative(entry.watchedAt)}</span>}
        </span>
        <span className="ndw-media-sub">{[code(item), entry.user].filter(Boolean).join(' · ')}</span>
        {entry.progress !== undefined && (entry.progress >= 100
          ? <span className="ndw-media-sub ndw-mx-done">{status(entry)}</span>
          : <span className="ndw-mx-progress"><Track thin value={entry.progress} /><span className="ndw-media-time">{status(entry)}</span></span>)}
      </span>
    </>
  );
  return item.link
    ? <a className="ndw-mx-qrow" href={item.link} target="_blank" rel="noopener noreferrer">{body}</a>
    : <div className="ndw-mx-qrow">{body}</div>;
}
