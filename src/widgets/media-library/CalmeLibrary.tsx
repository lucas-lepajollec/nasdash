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
                  <div className="ndw-media-counts">
                    {shown.map(id => {
                      const Icon = ICONS[id];
                      const value = data.counts[id] ?? 0;
                      return (
                        <div key={id} className={`ndw-media-count is-${id}`} title={number.full.format(value)}>
                          <span className="ndw-media-count-icon" aria-hidden="true"><Icon size={16} /></span>
                          <span className="ndw-media-count-value">{number.short.format(value)}</span>
                          <span className="ndw-media-count-label">{t(`widgets.media.count.${id}`)}</span>
                        </div>
                      );
                    })}
                  </div>
                  {settings.libraries === true && data.libraries.length > 0 && (
                    <ul className="ndw-media-libraries">
                      {data.libraries.map(library => {
                        const Icon = LIBRARY_ICONS[library.kind] ?? Clapperboard;
                        return (
                          <li key={library.name}>
                            <Icon size={13} aria-hidden="true" />
                            <span className="ndw-media-title">{library.name}</span>
                            {library.count !== undefined && <span className="ndw-media-time">{number.full.format(library.count)}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
      </div>
    </CalmeWidget>
  );
}
