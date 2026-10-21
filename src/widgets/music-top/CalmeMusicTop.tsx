'use client';

import React, { useMemo } from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MusicTopResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSlider } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, ColumnRows, columnsOf, ColumnsSetting, DataError, useBoxWidth, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { Cover, MusicServerField, MusicSetup, useMusicConnection } from '@/components/widgets/music/shared';
import { musicPlayer, PlayButton, useCanPlay } from '@/components/widgets/music/player';

/** The albums played most (all time: the servers keep no count per period), ranked. */
export default function CalmeMusicTop({ widgetId, settings = {}, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings?: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t, locale } = useI18n();
  const connection = useMusicConnection(settings);
  const { data, error, mutate, stale } = useWidgetData<MusicTopResponse>('/api/widgets/music/top', widgetId, settings, { refreshMs: 15 * 60_000, isVisible, method: 'GET', enabled: !!connection });
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const title = t('widget.music-top.name');
  const albums = data?.albums ?? [];
  const canPlay = useCanPlay();

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data ? <span className="ndc-title-note">{data.name}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-media', label: t('widgets.media.manage') }}>
          {(draft, change) => (
            <>
              <MusicServerField draft={draft} change={change} />
              <CalmeRow label={t('widgets.music.albumCount')}>
                <CalmeSlider label={t('widgets.music.albumCount')} value={bounded(draft.count, 3, 20, 6)} min={3} max={20} step={1} onChange={value => change({ count: value })} onCommit={value => change({ count: value })} format={String} />
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
              : albums.length === 0 ? <div className="ndw-mx-empty"><span className="ndw-mx-calm">{t('widgets.music.noPlays')}</span></div>
                : (
                  <ColumnRows columns={columnsOf(settings, width, 320)} className="ndw-mx-lines">
                    {albums.map((album, index) => {
                      const body = (
                        <>
                          <span className="ndw-music-rank">{index + 1}</span>
                          <Cover id={album.id} title={album.title} cover={album.cover} size={46} />
                          <span className="ndw-mx-qrow-text">
                            <span className="ndw-media-title">{album.title}</span>
                            {album.artist && <span className="ndw-media-sub">{album.artist}</span>}
                          </span>
                          {canPlay && <PlayButton label={t('widgets.music.playOne', { name: album.title })} playingKey={`album:${album.id}`} onPlay={() => void musicPlayer.playCollection(widgetId, 'album', album.id)} />}
                          {album.plays !== undefined && (
                            <span className="ndw-mx-end">
                              <span className="ndw-mx-when">{number.format(album.plays)}</span>
                              <span className="ndw-media-time">{t('widgets.music.plays', { count: album.plays })}</span>
                            </span>
                          )}
                        </>
                      );
                      return album.link
                        ? <a key={album.id} className="ndw-mx-qrow ndw-music-toprow" href={album.link} target="_blank" rel="noopener noreferrer">{body}</a>
                        : <div key={album.id} className="ndw-mx-qrow ndw-music-toprow">{body}</div>;
                    })}
                  </ColumnRows>
                )}
      </div>
    </CalmeWidget>
  );
}
