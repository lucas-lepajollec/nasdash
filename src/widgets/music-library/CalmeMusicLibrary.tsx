'use client';

import React, { useMemo } from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MusicLibraryResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { DataError, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { Stat } from '@/components/widgets/media/visual';
import { Cover, MusicServerField, MusicSetup, useMusicConnection } from '@/components/widgets/music/shared';

const PARTS = ['figures', 'genres', 'week'] as const;

/** What a music library holds: artists, albums, tracks and hours, its main genres, the albums of the week. */
export default function CalmeMusicLibrary({ widgetId, settings = {}, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings?: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t, locale } = useI18n();
  const connection = useMusicConnection(settings);
  const { data, error, mutate, stale } = useWidgetData<MusicLibraryResponse>('/api/widgets/music/library', widgetId, settings, { refreshMs: 15 * 60_000, isVisible, method: 'GET', enabled: !!connection });
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const title = t('widget.music-library.name');
  const show = (part: typeof PARTS[number]) => settings[part] !== false;
  const genres = data?.genres ?? [];
  const genreTotal = genres.reduce((sum, genre) => sum + genre.count, 0);
  const figures = data ? ([['artists', data.artists], ['albums', data.albums], ['tracks', data.tracks], ['hours', data.durationMs !== undefined ? Math.round(data.durationMs / 3_600_000) : undefined]] as const).filter(([, value]) => value !== undefined) : [];

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data ? <span className="ndc-title-note">{data.name}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-media', label: t('widgets.media.manage') }}>
          {(draft, change) => (
            <>
              <MusicServerField draft={draft} change={change} />
              {PARTS.map(part => (
                <CalmeRow key={part} label={t(`widgets.music.part.${part}`)}>
                  <CalmeSwitch label={t(`widgets.music.part.${part}`)} checked={draft[part] !== false} onChange={on => change({ [part]: on ? null : false })} />
                </CalmeRow>
              ))}
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <MusicSetup settings={settings} />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 56 }} /><span className="ndw-skeleton-row" style={{ height: 100 }} /></div>
              : (
                <div className="ndw-mx-stack">
                  {show('figures') && figures.length > 0 && (
                    <div className="ndw-mx-statrow">
                      {figures.map(([key, value]) => <Stat key={key} value={key === 'hours' ? t('widgets.music.hoursValue', { count: number.format(value!) }) : number.format(value!)} label={t(`widgets.music.count.${key}`)} tone={value ? undefined : 'muted'} />)}
                    </div>
                  )}
                  {show('genres') && genres.length > 0 && (
                    <div className="ndw-mx-section">
                      <span className="ndw-mx-label">{t('widgets.music.genres')}</span>
                      <div className="ndw-music-genres">
                        {genres.slice(0, 6).map((genre, index) => (
                          <span key={genre.name} className="ndw-music-genre">
                            <span className="ndw-music-genre-name">{genre.name}</span>
                            <span className={`ndw-music-genre-bar ${index === 0 ? 'is-first' : ''}`}><span style={{ width: `${genre.count / genres[0].count * 100}%` }} /></span>
                            <span className="ndw-media-time">{genreTotal ? t('widgets.arr.percent', { value: Math.round(genre.count / genreTotal * 100) }) : number.format(genre.count)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {show('week') && (data.week?.length ?? 0) > 0 && (
                    <div className="ndw-mx-section">
                      <span className="ndw-mx-root-head">
                        <span className="ndw-mx-label">{t('widgets.music.week')}</span>
                        {data.weekCount !== undefined && <span className="ndw-media-time">{t('widgets.music.weekCount', { count: data.weekCount })}</span>}
                      </span>
                      <div className="ndw-music-strip">
                        {data.week!.map(album => <span key={album.id} title={[album.title, album.artist].filter(Boolean).join(' · ')}><Cover id={album.id} title={album.title} cover={album.cover} size={56} /></span>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
      </div>
    </CalmeWidget>
  );
}
