'use client';

import React, { useEffect, useState } from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MusicNowPlayingResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, DataError, useBoxWidth, useRelativeTime, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { clock } from '@/components/widgets/media/shared';
import { Backdrop, Track } from '@/components/widgets/media/visual';
import { AlbumCard, Cover, MusicServerField, MusicSetup, useMusicConnection } from '@/components/widgets/music/shared';

/** Time played since the server read the sessions; bounded, so a clock gap between machines cannot run away. */
const MAX_DRIFT = 15_000;

/** The clock of the page: a playing track moves on between two refreshes. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * What plays on a music server (Jellyfin, Emby, Plex, Navidrome): the
 * cover large over a blur of itself, the track, artist and album, where it
 * is and what comes next. Nothing playing: the albums played lately.
 */
export default function CalmeMusicNowPlaying({ widgetId, settings = {}, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings?: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const connection = useMusicConnection(settings);
  const { data, error, mutate, stale } = useWidgetData<MusicNowPlayingResponse>('/api/widgets/music/now-playing', widgetId, settings, { refreshMs: 10_000, isVisible, method: 'GET', enabled: !!connection });
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const sessions = data?.sessions ?? [];
  const now = useNow(isVisible && sessions.some(session => session.state === 'playing'));
  const relative = useRelativeTime();
  const title = t('widget.music-nowplaying.name');
  const recentCount = bounded(settings.count, 1, 12, 6);
  const columns = Math.max(2, Math.min(6, Math.floor((width + 12) / 120)));

  return (
    <CalmeWidget title={title} editMode={editMode} aside={sessions.length > 1 ? <span className="ndc-title-note">{t('widgets.media.streams', { count: sessions.length })}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-media', label: t('widgets.media.manage') }}>
          {(draft, change) => (
            <>
              <MusicServerField draft={draft} change={change} />
              <CalmeRow label={t('widgets.music.next')}>
                <CalmeSwitch label={t('widgets.music.next')} checked={draft.next !== false} onChange={on => change({ next: on ? null : false })} />
              </CalmeRow>
              <CalmeRow label={t('widgets.music.recentCount')}>
                <CalmeSlider label={t('widgets.music.recentCount')} value={bounded(draft.count, 1, 12, 6)} min={1} max={12} step={1} onChange={value => change({ count: value })} onCommit={value => change({ count: value })} format={String} />
              </CalmeRow>
              <CalmeRow label={t('widgets.media.showUsers')} info={t('widgets.media.showUsersHint')}>
                <CalmeSwitch label={t('widgets.media.showUsers')} checked={draft.showUsers === true} onChange={on => change({ showUsers: on || null })} />
              </CalmeRow>
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div ref={box} className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <MusicSetup settings={settings} />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 150 }} /></div>
              : (
                <div className="ndw-mx-stack">
                  {sessions.map((session, index) => {
                    const { track } = session;
                    const position = session.positionMs === undefined ? undefined : Math.min(track.durationMs ?? Infinity, session.positionMs + (session.state === 'playing' ? Math.min(MAX_DRIFT, Math.max(0, now - data.fetchedAt)) : 0));
                    const paused = session.state !== 'playing';
                    const large = index === 0;
                    return (
                      <section key={session.id} className={`ndw-music-now ${large ? 'is-large' : ''}`}>
                        {large && <Backdrop src={track.cover} blur />}
                        <Cover id={`${session.id}-cover`} title={track.album ?? track.title} cover={track.cover} size={large ? (width < 420 ? 110 : 160) : 56} />
                        <span className="ndw-music-now-text">
                          <span className={`ndw-mx-eyebrow ${paused ? '' : 'is-accent'}`}>{[t(paused ? 'widgets.media.paused' : 'widgets.music.listening'), session.player, session.user].filter(Boolean).join(' · ')}</span>
                          <span className={large ? 'ndw-mx-display' : 'ndw-mx-title'}>{track.title}</span>
                          <span className="ndw-mx-meta">{[track.artist, track.album].filter(Boolean).join(' · ')}</span>
                          {track.durationMs !== undefined && position !== undefined && (
                            <span className="ndw-mx-progress">
                              <span className="ndw-media-time">{clock(position)}</span>
                              <Track thin={!large} value={position / track.durationMs * 100} tone={paused ? 'muted' : undefined} />
                              <span className="ndw-media-time">{clock(track.durationMs)}</span>
                            </span>
                          )}
                          {large && session.quality && <span className="ndw-mx-meta is-quiet">{session.quality}</span>}
                        </span>
                        {large && settings.next !== false && (session.next?.length ?? 0) > 0 && (
                          <div className="ndw-music-next">
                            <span className="ndw-mx-label">{t('widgets.music.upNext')}</span>
                            {session.next!.slice(0, 3).map((next, position) => (
                              <span key={`${next.id}-${position}`} className="ndw-music-next-row">
                                <span className="ndw-music-next-rank">{position + 1}</span>
                                <span className="ndw-music-next-title">{next.title}</span>
                                {next.durationMs !== undefined && <span className="ndw-media-time">{clock(next.durationMs)}</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                  {!sessions.length && (
                    <>
                      <div className="ndw-mx-empty">
                        <span className="ndw-mx-calm">{t('widgets.music.idle')}</span>
                        {data.recent?.[0]?.playedAt && <span className="ndw-mx-meta">{t('widgets.music.lastPlayed', { when: relative(data.recent[0].playedAt), artist: data.recent[0].artist ?? '' })}</span>}
                      </div>
                      {(data.recent?.length ?? 0) > 0 && (
                        <div className="ndw-mx-section">
                          <span className="ndw-mx-label">{t('widgets.music.playedLately')}</span>
                          <div className="ndw-mx-rail" style={{ '--ndw-cols': columns } as React.CSSProperties}>
                            {data.recent!.slice(0, recentCount).map(album => <AlbumCard key={album.id} album={album} />)}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
      </div>
    </CalmeWidget>
  );
}
