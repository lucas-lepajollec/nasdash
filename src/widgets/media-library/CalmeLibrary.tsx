'use client';

import React, { useMemo } from 'react';
import { BookOpen, Clapperboard, Disc3, Film, Mic2, Music, Tv } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MediaCounts, MediaLibraryResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField, CalmeCheckRow } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { DataError, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { MediaConnectionField, MediaSetup, useMediaConnection } from '@/components/widgets/media/shared';

type Count = keyof MediaCounts;
const COUNTS: readonly Count[] = ['movies', 'series', 'episodes', 'artists', 'albums', 'tracks', 'books'];
const ICONS: Record<Count, typeof Film> = { movies: Film, series: Tv, episodes: Clapperboard, artists: Mic2, albums: Disc3, tracks: Music, books: BookOpen };
const LIBRARY_ICONS = { movies: Film, series: Tv, music: Music, books: BookOpen, other: Clapperboard } as const;
/** One tile per shelf: its main total large, the others beneath, over the newest title's art. */
const SHELVES: readonly { id: string; counts: Count[]; cover?: string }[] = [
  { id: 'movies', counts: ['movies'], cover: 'movies' },
  { id: 'series', counts: ['series', 'episodes'], cover: 'series' },
  { id: 'music', counts: ['albums', 'artists', 'tracks'], cover: 'music' },
  { id: 'books', counts: ['books'] },
];

/**
 * What a Jellyfin, Emby or Plex server holds: movies, series, episodes,
 * music, books (the ones it has, or the ones chosen), and its libraries.
 */
export default function CalmeLibrary({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t, locale } = useI18n();
  const connection = useMediaConnection(settings);
  const { data, error, mutate } = useWidgetData<MediaLibraryResponse>('/api/widgets/media/library', widgetId, settings, { refreshMs: 15 * 60_000, isVisible, method: 'GET', enabled: !!connection });
  const number = useMemo(() => ({ full: new Intl.NumberFormat(locale), short: new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }) }), [locale]);
  const title = t('widget.media-library.name');
  const chosen = Array.isArray(settings.counts) ? COUNTS.filter(id => (settings.counts as unknown[]).includes(id)) : undefined;
  // Without a choice: every total the server has and that is not zero.
  const shown = data ? (chosen ?? COUNTS.filter(id => (data.counts[id] ?? 0) > 0)).filter(id => data.counts[id] !== undefined) : [];

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data ? <span className="ndc-title-note">{data.name}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-media', label: t('widgets.media.manage') }}>
          {(draft, change) => {
            const current = Array.isArray(draft.counts) ? COUNTS.filter(id => (draft.counts as unknown[]).includes(id)) : null;
            return (
              <>
                <MediaConnectionField draft={draft} change={change} />
                <CalmeField label={t('widgets.media.counts')} info={t('widgets.media.countsHint')}>
                  <div className="ndc-dlg-stack">
                    {COUNTS.map(id => (
                      <CalmeCheckRow key={id} checked={current ? current.includes(id) : true} onChange={() => {
                        const base = current ?? [...COUNTS];
                        const next = base.includes(id) ? base.filter(item => item !== id) : COUNTS.filter(item => item === id || base.includes(item));
                        change({ counts: next.length === COUNTS.length ? null : next });
                      }}>
                        <span className="ndc-dlg-name">{t(`widgets.media.count.${id}`)}</span>
                      </CalmeCheckRow>
                    ))}
                  </div>
                </CalmeField>
                <CalmeRow label={t('widgets.media.showLibraries')}>
                  <CalmeSwitch label={t('widgets.media.showLibraries')} checked={draft.libraries === true} onChange={on => change({ libraries: on || null })} />
                </CalmeRow>
              </>
            );
          }}
        </WidgetSettingsButton>
      )}
      <div className="ndw-media-box">
        {!connection ? <MediaSetup settings={settings} />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 64 }} /></div>
              : (
                <>
                  <div className="ndw-media-shelves">
                    {SHELVES.map(shelf => {
                      const ids = shelf.counts.filter(id => shown.includes(id));
                      if (!ids.length) return null;
                      const [main, ...more] = ids;
                      const Icon = ICONS[main];
                      const cover = data.covers?.[shelf.cover as keyof NonNullable<MediaLibraryResponse['covers']>];
                      return (
                        <div key={shelf.id} className={`ndw-media-shelf is-${shelf.id} ${cover ? 'has-cover' : ''}`} title={ids.map(id => `${number.full.format(data.counts[id] ?? 0)} ${t(`widgets.media.count.${id}`)}`).join(' · ')}>
                          {cover && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img className="ndw-media-shelf-art" src={cover} alt="" loading="lazy" decoding="async" />
                          )}
                          <span className="ndw-media-shelf-shade" aria-hidden="true" />
                          <span className="ndw-media-shelf-head"><Icon size={14} aria-hidden="true" />{t(`widgets.media.shelf.${shelf.id}`)}</span>
                          <span className="ndw-media-shelf-value">{number.short.format(data.counts[main] ?? 0)}<span className="ndw-media-shelf-unit">{t(`widgets.media.count.${main}`)}</span></span>
                          {more.length > 0 && (
                            <span className="ndw-media-shelf-more">
                              {more.map(id => <span key={id}>{number.short.format(data.counts[id] ?? 0)} {t(`widgets.media.count.${id}`)}</span>)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {settings.libraries === true && data.libraries.length > 0 && (
                    <div className="ndw-media-library-chips">
                      {data.libraries.map(library => {
                        const Icon = LIBRARY_ICONS[library.kind] ?? Clapperboard;
                        return (
                          <span key={library.name} className="ndw-media-library-chip">
                            <Icon size={12} aria-hidden="true" />
                            <span>{library.name}</span>
                            {library.count !== undefined && <span className="ndw-media-library-count">{number.short.format(library.count)}</span>}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
      </div>
    </CalmeWidget>
  );
}
