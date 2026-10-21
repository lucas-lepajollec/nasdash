'use client';

import React from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MusicRecentResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSlider } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, ColumnRows, columnsOf, ColumnsSetting, DataError, pick, useBoxWidth, useRelativeTime, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { AlbumCard, Cover, MusicServerField, MusicSetup, useMusicConnection } from '@/components/widgets/music/shared';
import { musicPlayer, PlayButton, useCanPlay } from '@/components/widgets/music/player';

const DISPLAYS = ['grid', 'list'] as const;
const CONTENTS = ['added', 'albums', 'tracks'] as const;

/** What is new or was played lately on a music server: albums added, albums played or tracks played, as covers or a list, each to play. */
export default function CalmeMusicRecent({ widgetId, settings = {}, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings?: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const connection = useMusicConnection(settings);
  const { data, error, mutate, stale } = useWidgetData<MusicRecentResponse>('/api/widgets/music/recent', widgetId, settings, { refreshMs: 15 * 60_000, isVisible, method: 'GET', enabled: !!connection });
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const relative = useRelativeTime();
  const title = t('widget.music-recent.name');
  const display = pick(settings.display, DISPLAYS, 'grid');
  const albums = data?.albums ?? [];
  const content = pick(settings.content, CONTENTS, 'added');
  const tracks = data?.tracks ?? [];
  const canPlay = useCanPlay();
  const columns = Math.max(2, Math.min(8, Math.floor((width + 14) / 124)));

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data ? <span className="ndc-title-note">{data.name}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-media', label: t('widgets.media.manage') }}>
          {(draft, change) => (
            <>
              <MusicServerField draft={draft} change={change} />
              <CalmeField label={t('widgets.music.content')}>
                <CalmeSegmented label={t('widgets.music.content')} value={pick(draft.content, CONTENTS, 'added')} options={CONTENTS.map(value => ({ value, label: t(`widgets.music.content.${value}`) }))} onChange={value => change({ content: value === 'added' ? null : value })} />
              </CalmeField>
              {pick(draft.content, CONTENTS, 'added') !== 'tracks' && <CalmeField label={t('widgets.display')}>
                <CalmeSegmented label={t('widgets.display')} value={pick(draft.display, DISPLAYS, 'grid')} options={DISPLAYS.map(value => ({ value, label: t(`widgets.music.display.${value}`) }))} onChange={value => change({ display: value === 'grid' ? null : value })} />
              </CalmeField>}
              <CalmeRow label={t('widgets.music.albumCount')}>
                <CalmeSlider label={t('widgets.music.albumCount')} value={bounded(draft.count, 4, 40, 12)} min={4} max={40} step={1} onChange={value => change({ count: value })} onCommit={value => change({ count: value })} format={String} />
              </CalmeRow>
              {pick(draft.display, DISPLAYS, 'grid') === 'list' && <ColumnsSetting draft={draft} change={change} />}
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div ref={box} className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <MusicSetup settings={settings} />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 140 }} /></div>
              : content === 'tracks' ? (
                tracks.length === 0 ? <div className="ndw-mx-empty"><span className="ndw-mx-calm">{t('widgets.music.noPlays')}</span></div> : (
                  <ColumnRows columns={columnsOf(settings, width, 300)} className="ndw-mx-lines">
                    {tracks.map((track, index) => (
                      <div key={`${track.id}-${index}`} className="ndw-mx-qrow">
                        <Cover id={`t-${track.id}-${index}`} title={track.album ?? track.title} cover={track.cover} size={40} />
                        <span className="ndw-mx-qrow-text">
                          <span className="ndw-mx-qrow-head"><span className="ndw-media-title">{track.title}</span>{track.playedAt && <span className="ndw-media-time">{relative(track.playedAt)}</span>}</span>
                          <span className="ndw-media-sub">{[track.artist, track.album].filter(Boolean).join(' · ')}</span>
                        </span>
                        {canPlay && <PlayButton label={t('widgets.music.playOne', { name: track.title })} playingKey={`recent:${track.id}`} onPlay={() => musicPlayer.playTracks(widgetId, tracks, index, `recent:${track.id}`)} />}
                      </div>
                    ))}
                  </ColumnRows>
                ))
              : albums.length === 0 ? <div className="ndw-mx-empty"><span className="ndw-mx-calm">{t('widgets.music.noAlbum')}</span></div>
                : display === 'list' ? (
                  <ColumnRows columns={columnsOf(settings, width, 300)} className="ndw-mx-lines">
                    {albums.map(album => (
                      <div key={album.id} className="ndw-mx-qrow">
                        <Cover id={album.id} title={album.title} cover={album.cover} size={44} />
                        <span className="ndw-mx-qrow-text">
                          <span className="ndw-mx-qrow-head"><span className="ndw-media-title">{album.title}</span>{(content === 'albums' ? album.playedAt : album.addedAt) && <span className="ndw-media-time">{relative((content === 'albums' ? album.playedAt : album.addedAt)!)}</span>}</span>
                          <span className="ndw-media-sub">{[album.artist, album.year, album.trackCount ? t('widgets.music.tracks', { count: album.trackCount }) : ''].filter(Boolean).join(' · ')}</span>
                        </span>
                        {canPlay && <PlayButton label={t('widgets.music.playOne', { name: album.title })} playingKey={`album:${album.id}`} onPlay={() => void musicPlayer.playCollection(widgetId, 'album', album.id)} />}
                      </div>
                    ))}
                  </ColumnRows>
                ) : (
                  <div className="ndw-mx-rail" style={{ '--ndw-cols': columns } as React.CSSProperties}>
                    {albums.map(album => <AlbumCard key={album.id} album={album} widgetId={widgetId} line={content === 'albums' ? (album.playedAt ? relative(album.playedAt) : undefined) : album.addedAt ? relative(album.addedAt) : undefined} />)}
                  </div>
                )}
      </div>
    </CalmeWidget>
  );
}
