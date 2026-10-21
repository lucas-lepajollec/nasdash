'use client';

import React, { useEffect, useState } from 'react';
import { Pause, Play, Search, SkipBack, SkipForward, X } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MusicNowPlayingResponse, MusicSearchResponse, MusicTrack } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { demoFetch } from '@/lib/demoTransport';
import { CalmeRow, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, DataError, useBoxWidth, useRelativeTime, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { clock } from '@/components/widgets/media/shared';
import { Backdrop, Track } from '@/components/widgets/media/visual';
import { AlbumCard, Cover, MusicServerField, MusicSetup, PlaybackSetting, useMusicConnection } from '@/components/widgets/music/shared';
import { musicPlayer, PlayButton, useCanPlay, useMusicPlayer } from '@/components/widgets/music/player';

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
 * What plays: here, in this browser (started from any music widget, with
 * its controls and queue), and on the server's players (Jellyfin and Emby
 * ones can be steered by an administrator). A search finds tracks, albums
 * and playlists to play. Nothing playing: the albums played lately.
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
  const player = useMusicPlayer();
  const canPlay = useCanPlay(settings);
  const title = t('widget.music-nowplaying.name');
  const recentCount = bounded(settings.count, 1, 12, 6);
  const columns = Math.max(2, Math.min(6, Math.floor((width + 12) / 120)));
  const here = player.queue.length > 0 ? player.queue[player.index] : undefined;
  const [busy, setBusy] = useState<string | null>(null);
  const control = async (sessionId: string, action: 'playpause' | 'next' | 'previous') => {
    setBusy(`${sessionId}:${action}`);
    try {
      const response = await demoFetch('/api/widgets/music/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ widgetId, sessionId, action }) });
      if (response.ok) await mutate();
    } finally { setBusy(null); }
  };

  return (
    <CalmeWidget title={title} editMode={editMode} aside={sessions.length > 1 ? <span className="ndc-title-note">{t('widgets.media.streams', { count: sessions.length })}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-media', label: t('widgets.media.manage') }}>
          {(draft, change) => (
            <>
              <MusicServerField draft={draft} change={change} />
              {(['search', 'next'] as const).map(part => (
                <CalmeRow key={part} label={t(`widgets.music.${part}`)}>
                  <CalmeSwitch label={t(`widgets.music.${part}`)} checked={draft[part] !== false} onChange={on => change({ [part]: on ? null : false })} />
                </CalmeRow>
              ))}
              <CalmeRow label={t('widgets.music.recentCount')}>
                <CalmeSlider label={t('widgets.music.recentCount')} value={bounded(draft.count, 1, 12, 6)} min={1} max={12} step={1} onChange={value => change({ count: value })} onCommit={value => change({ count: value })} format={String} />
              </CalmeRow>
              <PlaybackSetting draft={draft} change={change} />
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
                  {canPlay && settings.search !== false && <MusicSearch widgetId={widgetId} />}
                  {player.error && <p className="ndw-note ndw-down">{t(player.error)}</p>}
                  {here && (
                    <section className="ndw-music-now is-large">
                      <Backdrop src={here.cover} blur />
                      <Cover id={`here-${here.id}`} title={here.album ?? here.title} cover={here.cover} size={width < 420 ? 110 : 160} />
                      <span className="ndw-music-now-text">
                        <span className="ndw-mx-eyebrow is-accent">{t(player.playing ? 'widgets.music.playingHere' : 'widgets.music.pausedHere')}</span>
                        <span className="ndw-mx-display">{here.title}</span>
                        <span className="ndw-mx-meta">{[here.artist, here.album].filter(Boolean).join(' · ')}</span>
                        <span className="ndw-mx-progress">
                          <span className="ndw-media-time">{clock(player.positionMs)}</span>
                          <button type="button" className="ndw-music-seek" aria-label={t('widgets.music.seek')}
                            onClick={event => { const box = event.currentTarget.getBoundingClientRect(); musicPlayer.seek((event.clientX - box.left) / box.width); }}>
                            <Track value={player.durationMs ? player.positionMs / player.durationMs * 100 : 0} />
                          </button>
                          <span className="ndw-media-time">{clock(player.durationMs)}</span>
                        </span>
                        <span className="ndw-music-controls">
                          <button type="button" className="ndc-icon-button" onClick={() => musicPlayer.previous()} aria-label={t('widgets.music.previous')} title={t('widgets.music.previous')}><SkipBack size={14} /></button>
                          <button type="button" className="ndw-music-play is-large is-on" onClick={() => musicPlayer.toggle()} aria-label={t(player.playing ? 'widgets.music.pause' : 'widgets.music.play')} title={t(player.playing ? 'widgets.music.pause' : 'widgets.music.play')}>
                            {player.loading ? <span className="nd-spinner" aria-hidden="true" /> : player.playing ? <Pause size={16} /> : <Play size={16} />}
                          </button>
                          <button type="button" className="ndc-icon-button" disabled={player.index >= player.queue.length - 1} onClick={() => musicPlayer.next()} aria-label={t('widgets.music.nextTrack')} title={t('widgets.music.nextTrack')}><SkipForward size={14} /></button>
                          <button type="button" className="ndc-icon-button" onClick={() => musicPlayer.stop()} aria-label={t('widgets.music.stop')} title={t('widgets.music.stop')}><X size={14} /></button>
                        </span>
                      </span>
                      {settings.next !== false && player.index < player.queue.length - 1 && (
                        <UpNext tracks={player.queue.slice(player.index + 1, player.index + 4)} onPick={offset => musicPlayer.playTracks(player.widgetId!, player.queue, player.index + 1 + offset)} />
                      )}
                    </section>
                  )}
                  {sessions.map((session, index) => {
                    const { track } = session;
                    const position = session.positionMs === undefined ? undefined : Math.min(track.durationMs ?? Infinity, session.positionMs + (session.state === 'playing' ? Math.min(MAX_DRIFT, Math.max(0, now - data.fetchedAt)) : 0));
                    const paused = session.state !== 'playing';
                    const large = index === 0 && !here;
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
                          {session.canControl && (
                            <span className="ndw-music-controls">
                              {(['previous', 'playpause', 'next'] as const).map(action => (
                                <button key={action} type="button" className="ndc-icon-button" disabled={busy !== null} onClick={() => void control(session.id, action)}
                                  aria-label={t(`widgets.music.remote.${action}`)} title={t(`widgets.music.remote.${action}`)}>
                                  {busy === `${session.id}:${action}` ? <span className="nd-spinner" aria-hidden="true" /> : action === 'previous' ? <SkipBack size={13} /> : action === 'next' ? <SkipForward size={13} /> : paused ? <Play size={13} /> : <Pause size={13} />}
                                </button>
                              ))}
                            </span>
                          )}
                          {large && session.quality && <span className="ndw-mx-meta is-quiet">{session.quality}</span>}
                        </span>
                        {large && settings.next !== false && (session.next?.length ?? 0) > 0 && <UpNext tracks={session.next!.slice(0, 3)} />}
                      </section>
                    );
                  })}
                  {!sessions.length && !here && (
                    <>
                      <div className="ndw-mx-empty">
                        <span className="ndw-mx-calm">{t('widgets.music.idle')}</span>
                        {data.recent?.[0]?.playedAt && <span className="ndw-mx-meta">{t('widgets.music.lastPlayed', { when: relative(data.recent[0].playedAt), artist: data.recent[0].artist ?? '' })}</span>}
                      </div>
                      {(data.recent?.length ?? 0) > 0 && (
                        <div className="ndw-mx-section">
                          <span className="ndw-mx-label">{t('widgets.music.playedLately')}</span>
                          <div className="ndw-mx-rail" style={{ '--ndw-cols': columns } as React.CSSProperties}>
                            {data.recent!.slice(0, recentCount).map(album => <AlbumCard key={album.id} album={album} widgetId={widgetId} playable={canPlay} />)}
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

/** The next tracks; in this browser's queue, a click plays one. */
function UpNext({ tracks, onPick }: { tracks: MusicTrack[]; onPick?: (offset: number) => void }) {
  const { t } = useI18n();
  return (
    <div className="ndw-music-next">
      <span className="ndw-mx-label">{t('widgets.music.upNext')}</span>
      {tracks.map((next, position) => {
        const body = (
          <>
            <span className="ndw-music-next-rank">{position + 1}</span>
            <span className="ndw-music-next-title">{next.title}</span>
            {next.durationMs !== undefined && <span className="ndw-media-time">{clock(next.durationMs)}</span>}
          </>
        );
        return onPick
          ? <button key={`${next.id}-${position}`} type="button" className="ndw-music-next-row" onClick={() => onPick(position)}>{body}</button>
          : <span key={`${next.id}-${position}`} className="ndw-music-next-row">{body}</span>;
      })}
    </div>
  );
}

/** Finds tracks, albums and playlists on the server, each with its play button. */
function MusicSearch({ widgetId }: { widgetId: string }) {
  const { t } = useI18n();
  // A magnifier in the corner; opened, a bar above what plays.
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<MusicSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true); setFailed(false);
    try {
      const response = await demoFetch(`/api/widgets/music/search?${new URLSearchParams({ widgetId, q })}`);
      if (!response.ok) throw new Error(String(response.status));
      setResult(await response.json() as MusicSearchResponse);
    } catch { setFailed(true); setResult(null); }
    finally { setSearching(false); }
  };
  const empty = result && !result.tracks.length && !result.albums.length && !result.playlists.length;
  if (!open) return (
    <button type="button" className="ndw-music-search-toggle" onClick={() => setOpen(true)} aria-label={t('widgets.music.search')} title={t('widgets.music.search')}><Search size={18} /></button>
  );
  return (
    <div className="ndw-mx-section">
      {/* NasDash's own search field, at the width of the widget. */}
      <form className="nd-search ndw-music-searchbar" onSubmit={event => { event.preventDefault(); void run(); }}>
        <Search size={13} className="nd-search-icon" aria-hidden="true" />
        <input type="text" autoFocus value={query} onChange={event => { setQuery(event.target.value); if (!event.target.value) setResult(null); }} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); setResult(null); setQuery(''); } }} placeholder={t('widgets.music.searchPlaceholder')} aria-label={t('widgets.music.search')} maxLength={80} />
        {searching && <span className="nd-spinner ndw-music-searchbar-spin" aria-hidden="true" />}
        <button type="button" className="ndw-music-searchbar-close" onClick={() => { setResult(null); setQuery(''); setOpen(false); }} aria-label={t('widgets.music.clearSearch')} title={t('widgets.music.clearSearch')}><X size={13} /></button>
      </form>
      {failed && <p className="ndw-note ndw-down">{t('widgets.music.error.search')}</p>}
      {empty && <p className="ndw-note">{t('widgets.music.noResult')}</p>}
      {result && !empty && (
        <ul className="ndw-mx-hits">
          {result.tracks.slice(0, 6).map((track, index) => (
            <li key={`t-${track.id}`}>
              <Cover id={`s-${track.id}`} title={track.album ?? track.title} cover={track.cover} size={32} />
              <span className="ndw-media-row-text"><span className="ndw-media-title">{track.title}</span><span className="ndw-media-sub">{[t('widgets.music.kind.track'), track.artist].filter(Boolean).join(' · ')}</span></span>
              <PlayButton label={t('widgets.music.playOne', { name: track.title })} playingKey={track.id} onPlay={() => musicPlayer.playTracks(widgetId, result.tracks, index, track.id)} />
            </li>
          ))}
          {result.albums.slice(0, 4).map(album => (
            <li key={`a-${album.id}`}>
              <Cover id={`s-${album.id}`} title={album.title} cover={album.cover} size={32} />
              <span className="ndw-media-row-text"><span className="ndw-media-title">{album.title}</span><span className="ndw-media-sub">{[t('widgets.music.kind.album'), album.artist].filter(Boolean).join(' · ')}</span></span>
              <PlayButton label={t('widgets.music.playOne', { name: album.title })} playingKey={`album:${album.id}`} onPlay={() => void musicPlayer.playCollection(widgetId, 'album', album.id)} />
            </li>
          ))}
          {result.playlists.slice(0, 4).map(playlist => (
            <li key={`p-${playlist.id}`}>
              <Cover id={`s-${playlist.id}`} title={playlist.name} cover={playlist.cover} size={32} />
              <span className="ndw-media-row-text"><span className="ndw-media-title">{playlist.name}</span><span className="ndw-media-sub">{[t('widgets.music.kind.playlist'), playlist.trackCount ? t('widgets.music.tracks', { count: playlist.trackCount }) : ''].filter(Boolean).join(' · ')}</span></span>
              <PlayButton label={t('widgets.music.playOne', { name: playlist.name })} playingKey={`playlist:${playlist.id}`} onPlay={() => void musicPlayer.playCollection(widgetId, 'playlist', playlist.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
