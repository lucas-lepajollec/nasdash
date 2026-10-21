'use client';

import React, { useState } from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MusicAlbum, MusicRecentResponse, MusicTrack } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSlider } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, ColumnRows, columnsOf, ColumnsSetting, DataError, OrderedChoice, pick, useBoxWidth, useRelativeTime, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { AlbumCard, Cover, MusicServerField, MusicSetup, PlaybackSetting, useMusicConnection } from '@/components/widgets/music/shared';
import { musicPlayer, PlayButton, useCanPlay } from '@/components/widgets/music/player';

const DISPLAYS = ['grid', 'list'] as const;
type Page = 'added' | 'albums' | 'tracks';
const PAGES: readonly Page[] = ['added', 'albums', 'tracks'];
const CONTENTS = ['added', 'albums', 'tracks', 'pages'] as const;

/** The pages shown in the `pages` content, in their order (all three by default). */
function pagesOf(settings: WidgetSettings): Page[] {
  const list = Array.isArray(settings.pages) ? settings.pages.filter((page, index, all): page is Page => PAGES.includes(page as Page) && all.indexOf(page) === index) : [];
  return list.length ? list : [...PAGES];
}

/**
 * Music activity: albums added, albums played or tracks played lately, as
 * covers or a list, each to play; or the three as pages switched from the
 * widget itself, in the chosen order.
 */
export default function CalmeMusicRecent({ widgetId, settings = {}, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings?: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const connection = useMusicConnection(settings);
  const { data, error, mutate, stale } = useWidgetData<MusicRecentResponse>('/api/widgets/music/recent', widgetId, settings, { refreshMs: 15 * 60_000, isVisible, method: 'GET', enabled: !!connection });
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const title = t('widget.music-recent.name');
  const content = pick(settings.content, CONTENTS, 'added');
  const pages = pagesOf(settings);
  const [tab, setTab] = useState<Page | null>(null);
  const page: Page = content === 'pages' ? (tab && pages.includes(tab) ? tab : pages[0]) : content;
  const canPlay = useCanPlay(settings);
  const list = (which: Page) => which === 'tracks' ? data?.tracks : which === 'albums' ? (content === 'pages' ? data?.played : data?.albums) : data?.albums;

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data ? <span className="ndc-title-note">{data.name}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-media', label: t('widgets.media.manage') }}>
          {(draft, change) => <RecentSettings draft={draft} change={change} />}
        </WidgetSettingsButton>
      )}
      <div ref={box} className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <MusicSetup settings={settings} />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 140 }} /></div>
              : (
                <div className="ndw-mx-stack">
                  {content === 'pages' && pages.length > 1 && (
                    <div className="ndw-mx-tabs" role="tablist" aria-label={title}>
                      {pages.map(which => (
                        <button key={which} type="button" role="tab" aria-selected={page === which} className={page === which ? 'is-on' : ''} onClick={() => setTab(which)}>
                          {t(`widgets.music.content.${which}`)}
                        </button>
                      ))}
                    </div>
                  )}
                  {page === 'tracks'
                    ? <Tracks tracks={list('tracks') ?? []} widgetId={widgetId} columns={columnsOf(settings, width, 300)} canPlay={canPlay} />
                    : <Albums albums={list(page) ?? []} played={page === 'albums'} widgetId={widgetId} display={pick(settings.display, DISPLAYS, 'grid')} width={width} columns={columnsOf(settings, width, 300)} canPlay={canPlay} />}
                </div>
              )}
      </div>
    </CalmeWidget>
  );
}

function Albums({ albums, played, widgetId, display, width, columns, canPlay }: { albums: MusicAlbum[]; played: boolean; widgetId: string; display: typeof DISPLAYS[number]; width: number; columns: number; canPlay: boolean }) {
  const { t } = useI18n();
  const relative = useRelativeTime();
  if (!albums.length) return <div className="ndw-mx-empty"><span className="ndw-mx-calm">{t(played ? 'widgets.music.noPlays' : 'widgets.music.noAlbum')}</span></div>;
  const when = (album: MusicAlbum) => (played ? album.playedAt : album.addedAt);
  if (display === 'list') return (
    <ColumnRows columns={columns} className="ndw-mx-lines">
      {albums.map(album => (
        <div key={album.id} className="ndw-mx-qrow">
          <Cover id={album.id} title={album.title} cover={album.cover} size={44} />
          <span className="ndw-mx-qrow-text">
            <span className="ndw-mx-qrow-head"><span className="ndw-media-title">{album.title}</span>{when(album) && <span className="ndw-media-time">{relative(when(album)!)}</span>}</span>
            <span className="ndw-media-sub">{[album.artist, album.year, album.trackCount ? t('widgets.music.tracks', { count: album.trackCount }) : ''].filter(Boolean).join(' · ')}</span>
          </span>
          {canPlay && <PlayButton label={t('widgets.music.playOne', { name: album.title })} playingKey={`album:${album.id}`} onPlay={() => void musicPlayer.playCollection(widgetId, 'album', album.id)} />}
        </div>
      ))}
    </ColumnRows>
  );
  return (
    <div className="ndw-mx-rail" style={{ '--ndw-cols': Math.max(2, Math.min(8, Math.floor((width + 14) / 124))) } as React.CSSProperties}>
      {albums.map(album => <AlbumCard key={album.id} album={album} widgetId={widgetId} playable={canPlay} line={when(album) ? relative(when(album)!) : undefined} />)}
    </div>
  );
}

function Tracks({ tracks, widgetId, columns, canPlay }: { tracks: MusicTrack[]; widgetId: string; columns: number; canPlay: boolean }) {
  const { t } = useI18n();
  const relative = useRelativeTime();
  if (!tracks.length) return <div className="ndw-mx-empty"><span className="ndw-mx-calm">{t('widgets.music.noPlays')}</span></div>;
  return (
    <ColumnRows columns={columns} className="ndw-mx-lines">
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
  );
}

function RecentSettings({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  const content = pick(draft.content, CONTENTS, 'added');
  const pages = pagesOf(draft);
  const setPages = (next: Page[]) => change({ pages: next.length === PAGES.length && next.every((page, index) => page === PAGES[index]) ? null : next });
  return (
    <>
      <MusicServerField draft={draft} change={change} />
      <CalmeField label={t('widgets.music.content')}>
        <CalmeSegmented label={t('widgets.music.content')} value={content} options={CONTENTS.map(value => ({ value, label: t(`widgets.music.content.${value}`) }))} onChange={value => change({ content: value === 'added' ? null : value })} />
      </CalmeField>
      {content === 'pages' && (
        <CalmeField label={t('widgets.music.pages')} info={t('widgets.music.pagesHint')}>
          <OrderedChoice all={PAGES} value={pages} labelOf={page => t(`widgets.music.content.${page}`)} onChange={setPages} />
        </CalmeField>
      )}
      {content !== 'tracks' && (
        <CalmeField label={t('widgets.display')}>
          <CalmeSegmented label={t('widgets.display')} value={pick(draft.display, DISPLAYS, 'grid')} options={DISPLAYS.map(value => ({ value, label: t(`widgets.music.display.${value}`) }))} onChange={value => change({ display: value === 'grid' ? null : value })} />
        </CalmeField>
      )}
      <CalmeRow label={t('widgets.music.shown')}>
        <CalmeSlider label={t('widgets.music.shown')} value={bounded(draft.count, 4, 40, 12)} min={4} max={40} step={1} onChange={value => change({ count: value })} onCommit={value => change({ count: value })} format={String} />
      </CalmeRow>
      <ColumnsSetting draft={draft} change={change} />
      <PlaybackSetting draft={draft} change={change} />
    </>
  );
}
