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

const PROWLARR = ['prowlarr'] as const;

/**
 * A Prowlarr's indexers: the last day's searches, grabs and failures, then
 * each indexer with its state (working, failing until…), failing ones first.
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
  const indexers = (data?.indexers ?? [])
    .filter(indexer => settings.onlyFailing !== true || !indexer.healthy)
    .sort((a, b) => Number(a.healthy) - Number(b.healthy) || Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name));

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data ? <span className={`ndc-title-note ${failing ? 'ndw-down' : ''}`}>{failing ? t('widgets.arr.failing', { count: failing }) : t('widgets.arr.allWorking')}</span> : undefined}>
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
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 48 }} /><span className="ndw-skeleton-row" /></div>
              : (
                <>
                  <div className="ndw-media-tally ndw-arr-totals">
                    {(['queries', 'grabs', 'failures'] as const).map(key => (
                      <span key={key} className={`ndw-media-tally-item ${key === 'failures' && data.totals.failures ? 'is-bad' : ''}`}>
                        <span className="ndw-media-tally-value">{number.format(data.totals[key])}</span>
                        <span className="ndw-media-tally-label">{t(`widgets.arr.totals.${key}`)}</span>
                      </span>
                    ))}
                  </div>
                  {indexers.length === 0 ? <div className="ndc-empty">{t('widgets.arr.noIndexer')}</div> : (
                    <ColumnRows columns={columnsOf(settings, width, 240)} className="ndw-arr-indexers">
                      {indexers.map(indexer => (
                        <div key={indexer.id} className={`ndw-arr-indexer ${!indexer.enabled ? 'is-off' : indexer.healthy ? 'is-ok' : 'is-down'}`}>
                          <span className="ndw-arr-dot" aria-hidden="true" />
                          <span className="ndw-media-row-text">
                            <span className="ndw-media-title">{indexer.name}</span>
                            <span className="ndw-media-sub">
                              {!indexer.enabled ? t('widgets.arr.disabled')
                                : !indexer.healthy ? (indexer.retryAt ? t('widgets.arr.retry', { when: relative(indexer.retryAt) }) : t('widgets.arr.failingNow'))
                                  : [indexer.queries !== undefined ? t('widgets.arr.queries', { count: indexer.queries }) : '', indexer.grabs ? t('widgets.arr.grabs', { count: indexer.grabs }) : ''].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span className="ndw-media-badge">{t(`widgets.arr.protocol.${indexer.protocol}`)}</span>
                        </div>
                      ))}
                    </ColumnRows>
                  )}
                </>
              )}
      </div>
    </CalmeWidget>
  );
}
