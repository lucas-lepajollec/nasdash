'use client';

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Turtle } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { DOWNLOAD_CLIENT_TYPES, type DownloadClientStatus, type DownloadsResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { IntegrationLogo } from '@/components/integrations/IntegrationLogo';
import { CalmeWidget } from '../calme';
import { bounded, DataError, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { ArrSetup, chosenSources, FailuresNote, SourcesField, useByteFormat, useConnections, useEta } from '@/components/widgets/media/arr';

/** Speed samples kept per client for the little chart (one per refresh, 3 s apart: three minutes). */
const SAMPLES = 60;

/**
 * qBittorrent, Transmission, Deluge, SABnzbd and NZBGet, live: download and
 * upload speed large with the last minutes as a line, how many are active,
 * paused or waiting, free space, and the busiest downloads.
 */
export default function CalmeDownloads({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const connections = useConnections(DOWNLOAD_CLIENT_TYPES);
  const sources = chosenSources(connections, settings);
  const { data, error, mutate, stale } = useWidgetData<DownloadsResponse>('/api/widgets/downloads', widgetId, settings, { refreshMs: 3_000, isVisible, method: 'GET', enabled: sources.length > 0 });
  const history = useSpeedHistory(data);
  const title = t('widget.media-downloads.name');

  return (
    <CalmeWidget title={title} editMode={editMode} aside={<FailuresNote failures={data?.failures} />}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-downloads', label: t('widgets.arr.manageClients') }}>
          {(draft, change) => (
            <>
              <SourcesField connections={connections} draft={draft} change={change} />
              <CalmeRow label={t('widgets.arr.items')}>
                <CalmeSlider label={t('widgets.arr.items')} value={bounded(draft.items, 0, 10, 5)} min={0} max={10} step={1} onChange={value => change({ items: value })} onCommit={value => change({ items: value })} format={String} />
              </CalmeRow>
              <CalmeRow label={t('widgets.arr.chart')}>
                <CalmeSwitch label={t('widgets.arr.chart')} checked={draft.chart !== false} onChange={on => change({ chart: on ? null : false })} />
              </CalmeRow>
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connections.length ? <ArrSetup kind="downloads" />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 64 }} /></div>
              : (
                <div className="ndw-dl-clients">
                  {data.clients.map(client => <Client key={client.id} client={client} samples={history[client.id] ?? []} chart={settings.chart !== false} count={bounded(settings.items, 0, 10, 5)} />)}
                </div>
              )}
      </div>
    </CalmeWidget>
  );
}

/** Each client's recent speeds, kept in this browser while the widget is open. */
function useSpeedHistory(data: DownloadsResponse | undefined): Record<string, [number, number][]> {
  const [state, setState] = useState<{ stamp?: number; history: Record<string, [number, number][]> }>({ history: {} });
  if (data && data.fetchedAt !== state.stamp) {
    const history: Record<string, [number, number][]> = {};
    for (const client of data.clients) history[client.id] = [...(state.history[client.id] ?? []), [client.downloadBps, client.uploadBps ?? 0] as [number, number]].slice(-SAMPLES);
    setState({ stamp: data.fetchedAt, history });
  }
  return state.history;
}

function Client({ client, samples, chart, count }: { client: DownloadClientStatus; samples: [number, number][]; chart: boolean; count: number }) {
  const { t } = useI18n();
  const bytes = useByteFormat();
  const eta = useEta();
  const down = bytes.speed(client.downloadBps), up = client.uploadBps !== undefined ? bytes.speed(client.uploadBps) : undefined;
  const counts = [
    t('widgets.arr.active', { count: client.active }),
    client.paused ? t('widgets.arr.paused', { count: client.paused }) : '',
    client.queued ? t('widgets.arr.queued', { count: client.queued }) : '',
    client.freeBytes !== undefined ? t('widgets.arr.free', { size: bytes.size(client.freeBytes) }) : '',
  ].filter(Boolean);
  return (
    <section className="ndw-dl-client">
      <header className="ndw-dl-head">
        <IntegrationLogo id={client.type} size={22} />
        <span className="ndw-media-title">{client.name}</span>
        {client.altSpeed && <span className="ndw-dl-alt" title={t('widgets.arr.altSpeed')}><Turtle size={12} />{t('widgets.arr.altSpeedShort')}</span>}
      </header>
      <div className="ndw-dl-speeds">
        <span className="ndw-dl-speed is-down"><ArrowDown size={14} aria-hidden="true" /><span className="ndw-dl-value">{down.value}</span><span className="ndw-dl-unit">{down.unit}</span></span>
        {up && <span className="ndw-dl-speed is-up"><ArrowUp size={14} aria-hidden="true" /><span className="ndw-dl-value">{up.value}</span><span className="ndw-dl-unit">{up.unit}</span></span>}
        {chart && samples.length >= 4 && <Sparkline samples={samples} />}
      </div>
      <span className="ndw-media-sub">{counts.join(' · ')}</span>
      {count > 0 && client.items.length > 0 && (
        <ul className="ndw-dl-items">
          {client.items.slice(0, count).map(item => (
            <li key={item.id} title={item.name}>
              <span className="ndw-dl-item-head">
                <span className="ndw-dl-item-name">{item.name}</span>
                <span className="ndw-media-time">{[item.downloadBps ? `${bytes.speed(item.downloadBps).value} ${bytes.speed(item.downloadBps).unit}` : '', item.state === 'downloading' ? eta(item.etaMs) : t(`widgets.arr.state.${item.state}`)].filter(Boolean).join(' · ')}</span>
              </span>
              <span className={`ndw-arr-progress is-${item.state}`} aria-hidden="true"><span style={{ width: `${Math.round(item.progress)}%` }} /></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Download (filled) and upload (line) over the last minutes, on one scale. */
function Sparkline({ samples }: { samples: [number, number][] }) {
  const width = 120, height = 34;
  const max = Math.max(1, ...samples.flat());
  const point = (value: number, index: number) => `${(index / (SAMPLES - 1)) * width},${height - (value / max) * (height - 2) - 1}`;
  const offset = SAMPLES - samples.length;
  const down = samples.map(([value], index) => point(value, index + offset)).join(' ');
  const up = samples.map(([, value], index) => point(value, index + offset)).join(' ');
  const first = `${(offset / (SAMPLES - 1)) * width},${height}`;
  return (
    <svg className="ndw-dl-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon className="ndw-dl-chart-down" points={`${first} ${down} ${width},${height}`} />
      <polyline className="ndw-dl-chart-down-line" points={down} />
      <polyline className="ndw-dl-chart-up" points={up} />
    </svg>
  );
}
