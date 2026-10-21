'use client';

import React, { useMemo } from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import { PHOTO_STATS_TYPES, type PhotoStatsResponse } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { DataError, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { chosenConnection, ConnectionPicker } from '@/components/widgets/content/ConnectionPicker';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import { useByteFormat } from '@/components/widgets/media/arr';
import { AreaChart, Stat, Track } from '@/components/widgets/media/visual';
import { useAuth } from '@/providers/AuthProvider';

const PARTS = ['figures', 'storage', 'years', 'added', 'users'] as const;
type Part = typeof PARTS[number];

/**
 * What a photo library holds (Immich, PhotoPrism, Piwigo, LibrePhotos):
 * photos, videos, albums and people, the space they take, photos per year
 * taken, what arrived over the last month and, when allowed, per account.
 * Each part can be hidden; parts a provider does not report stay out.
 */
export default function CalmePhotoStats({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t, locale } = useI18n();
  const { config } = useConfig();
  const { user } = useAuth();
  const connection = chosenConnection(config?.integrations, PHOTO_STATS_TYPES, settings.integrationId);
  const { data, error, mutate, stale } = useWidgetData<PhotoStatsResponse>('/api/widgets/photos/stats', widgetId, settings, { refreshMs: 10 * 60_000, isVisible, method: 'GET', enabled: !!connection });
  const number = useMemo(() => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }), [locale]);
  const bytes = useByteFormat();
  const title = t('widget.photos-stats.name');
  const show = (part: Part) => settings[part] !== false;
  const figures = data ? ([['items', data.items], ['photos', data.photos], ['videos', data.videos], ['albums', data.albums], ['people', data.people], ['places', data.places], ['favorites', data.favorites]] as const).filter(([, value]) => value !== undefined) : [];
  const years = data?.byYear ?? [];

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data ? <span className="ndc-title-note">{data.name}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-photos', label: t('widgets.photos.manage') }}>
          {(draft, change) => (
            <>
              <CalmeField label={t('widgets.connection')}>
                <ConnectionPicker types={PHOTO_STATS_TYPES} section="photos" value={typeof draft.integrationId === 'string' ? draft.integrationId : undefined} onChange={id => change({ integrationId: id })} />
              </CalmeField>
              {PARTS.map(part => (
                <CalmeRow key={part} label={t(`widgets.photoStats.part.${part}`)}>
                  <CalmeSwitch label={t(`widgets.photoStats.part.${part}`)} checked={draft[part] !== false} onChange={on => change({ [part]: on ? null : false })} />
                </CalmeRow>
              ))}
              {draft.users !== false && (
                <CalmeRow label={t('widgets.media.showUsers')} info={t('widgets.photoStats.showUsersHint')}>
                  <CalmeSwitch label={t('widgets.media.showUsers')} checked={draft.showUsers === true} onChange={on => change({ showUsers: on || null })} />
                </CalmeRow>
              )}
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <SetupGuide kind="photos" />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 56 }} /><span className="ndw-skeleton-row" style={{ height: 80 }} /></div>
              : (
                <div className="ndw-mx-stack">
                  {data.limited && user?.role === 'admin' && (
                    // Only an administrator can act on it: what to give the key, said plainly.
                    <div className="ndw-mx-notice">
                      <span className="ndw-mx-notice-title">{t('widgets.photoStats.limited')}</span>
                      <span className="ndw-media-sub">{t('widgets.photoStats.limitedHint')}</span>
                    </div>
                  )}
                  {show('figures') && figures.length > 0 && (
                    <div className="ndw-mx-statrow">
                      {figures.map(([key, value]) => <Stat key={key} value={number.format(value!)} label={t(`widgets.photoStats.${key}`)} tone={value ? undefined : 'muted'} />)}
                    </div>
                  )}
                  {show('storage') && (data.libraryBytes !== undefined || data.disk) && (
                    <div className="ndw-mx-section">
                      <span className="ndw-mx-root-head">
                        <span className="ndw-mx-label">{t('widgets.photoStats.storage')}</span>
                        <span className="ndw-media-time">
                          {[data.libraryBytes !== undefined ? t('widgets.photoStats.library', { size: bytes.size(data.libraryBytes) }) : '',
                            data.disk ? t('widgets.arr.freeOf', { size: bytes.size(Math.max(0, data.disk.totalBytes - data.disk.usedBytes)), total: bytes.size(data.disk.totalBytes) }) : ''].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {data.disk && data.disk.totalBytes > 0 && <Track value={data.disk.usedBytes / data.disk.totalBytes * 100} tone={data.disk.usedBytes / data.disk.totalBytes > 0.9 ? 'warn' : 'muted'} />}
                    </div>
                  )}
                  {show('years') && years.length > 1 && <Years years={years} />}
                  {show('added') && data.added && data.added.some(Boolean) && (
                    <div className="ndw-mx-section">
                      <span className="ndw-mx-root-head">
                        <span className="ndw-mx-label">{t('widgets.photoStats.added')}</span>
                        <span className="ndw-media-time">{t('widgets.photoStats.addedTotal', { count: number.format(data.added.reduce((sum, value) => sum + value, 0)) })}</span>
                      </span>
                      <AreaChart values={data.added} height={56} />
                    </div>
                  )}
                  {show('users') && (data.users?.length ?? 0) > 1 && (
                    <div className="ndw-mx-section">
                      <span className="ndw-mx-label">{t('widgets.photoStats.users')}</span>
                      <div className="ndw-mx-lines">
                        {data.users!.map((user, index) => (
                          <div key={index} className="ndw-mx-line">
                            <span className="ndw-mx-line-name">{user.name ?? t('widgets.photoStats.account', { number: index + 1 })}</span>
                            <span className="ndw-mx-line-end">{[t('widgets.photoStats.photosCount', { count: number.format(user.photos) }), user.videos ? t('widgets.photoStats.videosCount', { count: number.format(user.videos) }) : '', user.bytes ? bytes.size(user.bytes) : ''].filter(Boolean).join(' · ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
      </div>
    </CalmeWidget>
  );
}

/** Years as labelled columns: the last ten, and everything before in one "Earlier" column. */
function Years({ years }: { years: NonNullable<PhotoStatsResponse['byYear']> }) {
  const { t, locale } = useI18n();
  const number = useMemo(() => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }), [locale]);
  const last = years[years.length - 1].year;
  const earlier = years.filter(year => year.year <= last - 10).reduce((sum, year) => sum + year.count, 0);
  const columns = [...(earlier ? [{ label: t('widgets.photoStats.earlier'), count: earlier }] : []), ...years.filter(year => year.year > last - 10).map(year => ({ label: String(year.year), count: year.count }))];
  const max = Math.max(1, ...columns.map(column => column.count));
  return (
    <div className="ndw-mx-section">
      <span className="ndw-mx-label">{t('widgets.photoStats.years')}</span>
      <div className="ndw-mx-years">
        {columns.map(column => (
          <span key={column.label} className="ndw-mx-year" title={[column.label, number.format(column.count)].join(' · ')}>
            <span className="ndw-mx-year-count">{number.format(column.count)}</span>
            <span className="ndw-mx-year-bar"><span style={{ height: `${Math.max(4, column.count / max * 100)}%` }} /></span>
            <span className="ndw-mx-year-label">{column.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
