'use client';

import React, { useMemo } from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { IndexersResponse } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { ColumnRows, columnsOf, ColumnsSetting, DataError, useBoxWidth, useRelativeTime, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { chosenConnection, ConnectionPicker } from '@/components/widgets/content/ConnectionPicker';
import { ArrSetup } from '@/components/widgets/media/arr';
import { Bars, Ring, Stat } from '@/components/widgets/media/visual';

const PROWLARR = ['prowlarr'] as const;
/** Working indexers listed before the rest is summed up. */
const VISIBLE = 6;

/**
 * A Prowlarr's indexers: how many work, the last day's searches, grabs and
 * failures with the searches per hour, then each indexer (failing ones
 * first, with when Prowlarr tries again).
 */
export default function CalmeIndexers({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t, locale } = useI18n();
  const { config } = useConfig();
  const connection = chosenConnection(config?.integrations, PROWLARR, settings.integrationId);
  const { data, error, mutate, stale } = useWidgetData<IndexersResponse>('/api/widgets/arr/indexers', widgetId, settings, { refreshMs: 2 * 60_000, isVisible, method: 'GET', enabled: !!connection });
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const relative = useRelativeTime();
  const number = useMemo(() => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }), [locale]);
  const title = t('widget.media-indexers.name');
  const failing = data?.indexers.filter(indexer => indexer.enabled && !indexer.healthy).length ?? 0;
  const enabled = data?.indexers.filter(indexer => indexer.enabled).length ?? 0;
  const sorted = (data?.indexers ?? [])
    .filter(indexer => settings.onlyFailing !== true || !indexer.healthy)
    .sort((a, b) => Number(a.healthy) - Number(b.healthy) || Number(b.enabled) - Number(a.enabled) || (b.queries ?? 0) - (a.queries ?? 0) || a.name.localeCompare(b.name));
  // Every failing indexer, then the busiest working ones; the rest counted in one line.
  const shown = Math.max(sorted.filter(indexer => indexer.enabled && !indexer.healthy).length, VISIBLE);
  const indexers = sorted.slice(0, shown), hidden = sorted.length - indexers.length;

  return (
    <CalmeWidget title={title} editMode={editMode}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-arr', label: t('widgets.arr.manage') }}>
          {(draft, change) => (
            <>
              <CalmeField label={t('widgets.connection')}>
                <ConnectionPicker types={PROWLARR} section="arr" value={typeof draft.integrationId === 'string' ? draft.integrationId : undefined} onChange={id => change({ integrationId: id })} />
              </CalmeField>
              <CalmeRow label={t('widgets.arr.onlyFailing')}>
                <CalmeSwitch label={t('widgets.arr.onlyFailing')} checked={draft.onlyFailing === true} onChange={on => change({ onlyFailing: on || null })} />
              </CalmeRow>
              <ColumnsSetting draft={draft} change={change} />
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div ref={box} className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <ArrSetup kind="prowlarr" />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 64 }} /><span className="ndw-skeleton-row" /></div>
              : (
                <div className="ndw-mx-stack">
                  <div className="ndw-mx-summary">
                    <span className="ndw-mx-ring-figure">
                      <Ring value={enabled ? (enabled - failing) / enabled * 100 : 0} size={64} stroke={3.5} label={t('widgets.arr.working', { count: enabled - failing, total: enabled })} />
                      <span className="ndw-mx-ring-text">{enabled - failing}<span>/{enabled}</span></span>
                    </span>
                    <span className="ndw-mx-summary-main">
                      <span className="ndw-mx-tile-name">{failing ? t('widgets.arr.failing', { count: failing }) : t('widgets.arr.allWorking')}</span>
                      <span className="ndw-media-sub">{[t('widgets.arr.indexerCount', { count: enabled }), data.lastQueryAt ? t('widgets.arr.lastSearch', { when: relative(data.lastQueryAt) }) : ''].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="ndw-mx-tile-stats is-end">
                      {(['queries', 'grabs', 'failures'] as const).map(key => <Stat key={key} value={number.format(data.totals[key])} label={t(`widgets.arr.totals.${key}`)} tone={!data.totals[key] ? 'muted' : key === 'failures' ? 'bad' : undefined} />)}
                    </span>
                  </div>
                  {data.hourly && data.hourly.some(Boolean) && (
                    <div className="ndw-mx-section">
                      <Bars values={data.hourly} />
                      <span className="ndw-mx-axis"><span>{t('widgets.arr.last24h')}</span><span>{t('widgets.arr.now')}</span></span>
                    </div>
                  )}
                  {indexers.length === 0 ? <div className="ndc-empty">{t('widgets.arr.noIndexer')}</div> : (
                    <ColumnRows columns={columnsOf(settings, width, 300)} className="ndw-mx-lines">
                      {indexers.map(indexer => {
                        const down = indexer.enabled && !indexer.healthy;
                        return (
                          <div key={indexer.id} className={`ndw-mx-line ${!indexer.enabled ? 'is-off' : ''}`}>
                            <span className="ndw-mx-line-name">{indexer.name}</span>
                            <span className={`ndw-mx-line-end ${down ? 'ndw-down' : ''}`}>
                              {!indexer.enabled ? t('widgets.arr.disabled')
                                : down ? (indexer.retryAt ? t('widgets.arr.retry', { when: relative(indexer.retryAt) }) : t('widgets.arr.failingNow'))
                                  : [indexer.queries !== undefined ? t('widgets.arr.queries', { count: number.format(indexer.queries) }) : '', indexer.averageMs ? `${Math.round(indexer.averageMs)} ms` : ''].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                        );
                      })}
                    </ColumnRows>
                  )}
                  {hidden > 0 && <span className="ndw-media-sub">{t('widgets.arr.othersWorking', { count: hidden })}</span>}
                </div>
              )}
      </div>
    </CalmeWidget>
  );
}
