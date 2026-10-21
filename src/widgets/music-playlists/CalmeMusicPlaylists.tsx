'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MusicPlaylist, MusicPlaylistsResponse, MusicTrack, MusicTracksResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { demoFetch } from '@/lib/demoTransport';
import { CalmeRow, CalmeSlider } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, ColumnRows, columnsOf, ColumnsSetting, DataError, useBoxWidth, useRelativeTime, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { clock } from '@/components/widgets/media/shared';
import { Cover, MusicServerField, MusicSetup, useMusicConnection } from '@/components/widgets/music/shared';
import { musicPlayer, PlayButton, useCanPlay } from '@/components/widgets/music/player';

/**
 * The server's playlists: cover, name, tracks and length, each to play;
 * opened, its tracks, each to play from there.
 */
export default function CalmeMusicPlaylists({ widgetId, settings = {}, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings?: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const connection = useMusicConnection(settings);
  const { data, error, mutate, stale } = useWidgetData<MusicPlaylistsResponse>('/api/widgets/music/playlists', widgetId, settings, { refreshMs: 15 * 60_000, isVisible, method: 'GET', enabled: !!connection });
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const title = t('widget.music-playlists.name');
  const playlists = data?.playlists ?? [];

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data ? <span className="ndc-title-note">{data.name}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-media', label: t('widgets.media.manage') }}>
          {(draft, change) => (
            <>
              <MusicServerField draft={draft} change={change} />
              <CalmeRow label={t('widgets.music.playlistCount')}>
                <CalmeSlider label={t('widgets.music.playlistCount')} value={bounded(draft.count, 3, 40, 12)} min={3} max={40} step={1} onChange={value => change({ count: value })} onCommit={value => change({ count: value })} format={String} />
              </CalmeRow>
              <ColumnsSetting draft={draft} change={change} />
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div ref={box} className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <MusicSetup settings={settings} />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true">{[0, 1, 2].map(row => <span key={row} className="ndw-skeleton-row" />)}</div>
              : playlists.length === 0 ? <div className="ndw-mx-empty"><span className="ndw-mx-calm">{t('widgets.music.noPlaylist')}</span></div>
                : <ColumnRows columns={columnsOf(settings, width, 320)} className="ndw-mx-lines">{playlists.map(playlist => <Playlist key={playlist.id} playlist={playlist} widgetId={widgetId} />)}</ColumnRows>}
      </div>
    </CalmeWidget>
  );
}

function Playlist({ playlist, widgetId }: { playlist: MusicPlaylist; widgetId: string }) {
  const { t } = useI18n();
  const relative = useRelativeTime();
  const canPlay = useCanPlay();
  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState<MusicTrack[] | null>(null);
  const [loading, setLoading] = useState(false);
  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || tracks) return;
    setLoading(true);
    try {
      const response = await demoFetch(`/api/widgets/music/tracks?${new URLSearchParams({ widgetId, kind: 'playlist', id: playlist.id })}`);
      setTracks(response.ok ? (await response.json() as MusicTracksResponse).tracks : []);
    } catch { setTracks([]); }
    finally { setLoading(false); }
  };
  const key = `playlist:${playlist.id}`;
  return (
    <div className="ndw-music-playlist">
      <div className="ndw-mx-qrow">
        <Cover id={playlist.id} title={playlist.name} cover={playlist.cover} size={46} />
        <button type="button" className="ndw-music-playlist-head" onClick={() => void toggle()} aria-expanded={open}>
          <span className="ndw-mx-qrow-text">
            <span className="ndw-media-title">{playlist.name}</span>
            <span className="ndw-media-sub">{[playlist.trackCount ? t('widgets.music.tracks', { count: playlist.trackCount }) : '', playlist.durationMs ? clock(playlist.durationMs) : '', playlist.changedAt ? relative(playlist.changedAt) : ''].filter(Boolean).join(' · ')}</span>
          </span>
          {loading ? <span className="nd-spinner" aria-hidden="true" /> : <ChevronDown size={14} className={`ndw-music-chevron ${open ? 'is-open' : ''}`} aria-hidden="true" />}
        </button>
        {canPlay && <PlayButton label={t('widgets.music.playOne', { name: playlist.name })} playingKey={key} onPlay={() => tracks?.length ? musicPlayer.playTracks(widgetId, tracks, 0, key) : void musicPlayer.playCollection(widgetId, 'playlist', playlist.id)} />}
      </div>
      {open && tracks && (
        <ol className="ndw-music-tracklist">
          {tracks.length === 0 ? <li className="ndw-media-sub">{t('widgets.music.error.empty')}</li> : tracks.slice(0, 50).map((track, index) => (
            <li key={`${track.id}-${index}`}>
              <span className="ndw-music-next-rank">{index + 1}</span>
              <span className="ndw-media-row-text"><span className="ndw-media-title">{track.title}</span>{track.artist && <span className="ndw-media-sub">{track.artist}</span>}</span>
              {track.durationMs !== undefined && <span className="ndw-media-time">{clock(track.durationMs)}</span>}
              {canPlay && <PlayButton label={t('widgets.music.playOne', { name: track.title })} playingKey={`${key}:${index}`} onPlay={() => musicPlayer.playTracks(widgetId, tracks, index, `${key}:${index}`)} />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
