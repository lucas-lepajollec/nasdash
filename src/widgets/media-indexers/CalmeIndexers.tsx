'use client';

import React, { useMemo } from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { IndexersResponse } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, ColumnRows, columnsOf, ColumnsSetting, DataError, Pager, useBoxWidth, usePage, useRelativeTime, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { chosenConnection, ConnectionPicker } from '@/components/widgets/content/ConnectionPicker';
import { ArrSetup } from '@/components/widgets/media/arr';
import { Bars, Stat } from '@/components/widgets/media/visual';

const PROWLARR = ['prowlarr'] as const;

/**
 * A Prowlarr's indexers, in up to three parts the widget chooses: a row of
 * figures (indexers working, the last day's requests and grabs, indexers
 * failing), the requests per hour, and the indexers page by page, failing
 * ones first with when Prowlarr tries again.
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
    .filter(indexer => settings.onlyFailing !== true || (indexer.enabled && !indexer.healthy))
    .sort((a, b) => Number(a.healthy) - Number(b.healthy) || Number(b.enabled) - Number(a.enabled) || (b.queries ?? 0) - (a.queries ?? 0) || a.name.localeCompare(b.name));
  const page = usePage(sorted, bounded(settings.count, 1, 30, 8));
  const show = { summary: settings.summary !== false, chart: settings.chart !== false, list: settings.list !== false };

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data?.lastQueryAt ? <span className="ndc-title-note">{t('widgets.arr.lastSearch', { when: relative(data.lastQueryAt) })}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-arr', label: t('widgets.arr.manage') }}>
          {(draft, change) => (
            <>
              <CalmeField label={t('widgets.connection')}>
                <ConnectionPicker types={PROWLARR} section="arr" value={typeof draft.integrationId === 'string' ? draft.integrationId : undefined} onChange={id => change({ integrationId: id })} />
              </CalmeField>
              {(['summary', 'chart', 'list'] as const).map(part => (
                <CalmeRow key={part} label={t(`widgets.arr.indexers.${part}`)}>
                  <CalmeSwitch label={t(`widgets.arr.indexers.${part}`)} checked={draft[part] !== false} onChange={on => change({ [part]: on ? null : false })} />
                </CalmeRow>
              ))}
              {draft.list !== false && (
                <>
                  <CalmeRow label={t('widgets.arr.perPage')}>
                    <CalmeSlider label={t('widgets.arr.perPage')} value={bounded(draft.count, 1, 30, 8)} min={1} max={30} step={1} onChange={value => change({ count: value })} onCommit={value => change({ count: value })} format={String} />
                  </CalmeRow>
                  <CalmeRow label={t('widgets.arr.onlyFailing')}>
                    <CalmeSwitch label={t('widgets.arr.onlyFailing')} checked={draft.onlyFailing === true} onChange={on => change({ onlyFailing: on || null })} />
                  </CalmeRow>
                  <ColumnsSetting draft={draft} change={change} />
                </>
              )}
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
                  {show.summary && (
                    <div className="ndw-mx-statrow">
                      <Stat value={<>{enabled - failing}<span className="ndw-mx-stat-of">/{enabled}</span></>} label={t('widgets.arr.indexers.working')} />
                      <Stat value={number.format(data.totals.queries)} label={t('widgets.arr.totals.queries')} tone={data.totals.queries ? undefined : 'muted'} />
                      <Stat value={number.format(data.totals.grabs)} label={t('widgets.arr.totals.grabs')} tone={data.totals.grabs ? undefined : 'muted'} />
                      <Stat value={failing} label={t('widgets.arr.indexers.failing')} tone={failing ? 'bad' : 'muted'} />
                    </div>
                  )}
                  {show.chart && data.hourly && data.hourly.some(Boolean) && (
                    <div className="ndw-mx-section">
                      <span className="ndw-mx-label">{t('widgets.arr.indexers.perHour')}</span>
                      <Bars values={data.hourly} />
                      <span className="ndw-mx-axis"><span>{t('widgets.arr.last24h')}</span><span>{t('widgets.arr.now')}</span></span>
                    </div>
                  )}
                  {show.list && (sorted.length === 0 ? <div className="ndc-empty">{settings.onlyFailing === true ? t('widgets.arr.allWorking') : t('widgets.arr.noIndexer')}</div> : (
                    <div className="ndw-mx-section">
                      <ColumnRows columns={columnsOf(settings, width, 300)} className="ndw-mx-lines">
                        {page.visible.map(indexer => {
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
                      <Pager page={page.page} pages={page.pages} onChange={page.setPage} />
                    </div>
                  ))}
                </div>
              )}
      </div>
    </CalmeWidget>
  );
}
