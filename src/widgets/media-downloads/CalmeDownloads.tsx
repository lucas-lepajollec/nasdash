'use client';

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Pause, Play } from 'lucide-react';
import { demoFetch } from '@/lib/demoTransport';
import type { WidgetSettings } from '@/lib/pages/types';
import { DOWNLOAD_CLIENT_TYPES, type DownloadClientStatus, type DownloadsResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSegmented, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { IntegrationLogo } from '@/components/integrations/IntegrationLogo';
import { CalmeWidget } from '../calme';
import { bounded, DataError, useRelativeTime, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { AreaChart, Figure, Ring } from '@/components/widgets/media/visual';
import { ArrSetup, chosenSources, FailuresNote, SourcesField, useByteFormat, useConnections, useEta } from '@/components/widgets/media/arr';

/** Speed samples kept per client for the curve (one per refresh, 3 s apart: three minutes). */
const SAMPLES = 60;

/**
 * qBittorrent, Transmission, Deluge, SABnzbd and NZBGet, live: the speeds
 * large over a curve of the last minutes, the counts, free space and the
 * busiest downloads. At rest: what came and went since the client started,
 * and what finished lately. Several clients: one at a time, chosen above.
 */
export default function CalmeDownloads({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const connections = useConnections(DOWNLOAD_CLIENT_TYPES);
  const sources = chosenSources(connections, settings);
  const { data, error, mutate, stale } = useWidgetData<DownloadsResponse>('/api/widgets/downloads', widgetId, settings, { refreshMs: 3_000, isVisible, method: 'GET', enabled: sources.length > 0 });
  const history = useSpeedHistory(data);
  const [chosen, setChosen] = useState<string>();
  const title = t('widget.media-downloads.name');
  const clients = data?.clients ?? [];
  const client = clients.find(item => item.id === chosen) ?? clients[0];
  // Pause or resume a download (or the whole client), then show the client's answer at once.
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const act = async (clientId: string, action: 'pause' | 'resume', itemId?: string) => {
    setBusy(itemId ?? clientId); setFailed(null);
    try {
      const response = await demoFetch('/api/widgets/downloads/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ widgetId, clientId, action, ...(itemId ? { itemId } : {}) }) });
      const answer = await response.json().catch(() => null) as (DownloadClientStatus & { error?: string }) | null;
      if (!response.ok || !answer) throw new Error(answer?.error ?? 'widgets.error.network');
      if (data) void mutate({ ...data, clients: data.clients.map(item => item.id === clientId ? answer : item) }, { revalidate: false });
    } catch (cause) { setFailed(cause instanceof Error && cause.message.startsWith('widgets.') ? cause.message : 'widgets.error.network'); }
    finally { setBusy(null); }
  };

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
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 120 }} /></div>
              : !client ? <div className="ndc-empty">{t('widgets.arr.noClient')}</div>
                : (
                  <div className="ndw-mx-stack">
                    <header className="ndw-mx-head">
                      <IntegrationLogo id={client.type} size={20} bare />
                      <span className="ndw-mx-title">{client.name}</span>
                      {clients.length > 1
                        ? <CalmeSegmented label={t('widgets.arr.client')} value={client.id} options={clients.map(item => ({ value: item.id, label: item.name }))} onChange={setChosen} />
                        : <span className="ndw-mx-meta is-quiet">{state(client, t)}</span>}
                      {client.canControl && (
                        <button type="button" className="ndc-icon-button" disabled={busy !== null} onClick={() => void act(client.id, client.clientPaused ? 'resume' : 'pause')}
                          aria-label={t(client.clientPaused ? 'widgets.arr.resumeAll' : 'widgets.arr.pauseAll')} title={t(client.clientPaused ? 'widgets.arr.resumeAll' : 'widgets.arr.pauseAll')}>
                          {busy === client.id ? <span className="nd-spinner" style={{ width: 12, height: 12 }} aria-hidden="true" /> : client.clientPaused ? <Play size={13} /> : <Pause size={13} />}
                        </button>
                      )}
                    </header>
                    {failed && <p className="ndw-note ndw-down">{t(failed)}</p>}
                    <Client client={client} samples={history[client.id] ?? []} chart={settings.chart !== false} count={bounded(settings.items, 0, 10, 5)} busy={busy} onAct={(action, itemId) => void act(client.id, action, itemId)} />
                  </div>
                )}
      </div>
    </CalmeWidget>
  );
}

const resting = (client: DownloadClientStatus) => client.downloadBps < 1024 && !client.items.some(item => item.state === 'downloading');
const state = (client: DownloadClientStatus, t: (key: string, values?: Record<string, string | number>) => string) => client.altSpeed ? t('widgets.arr.altSpeedShort') : resting(client) ? t('widgets.arr.resting') : '';

/** Each client's recent speeds, kept in this browser while the widget is open. */
function useSpeedHistory(data: DownloadsResponse | undefined): Record<string, [number, number][]> {
  const [store, setStore] = useState<{ stamp?: number; history: Record<string, [number, number][]> }>({ history: {} });
  if (data && data.fetchedAt !== store.stamp) {
    const history: Record<string, [number, number][]> = {};
    for (const client of data.clients) history[client.id] = [...(store.history[client.id] ?? []), [client.downloadBps, client.uploadBps ?? 0] as [number, number]].slice(-SAMPLES);
    setStore({ stamp: data.fetchedAt, history });
  }
  return store.history;
}

function Client({ client, samples, chart, count, busy, onAct }: { client: DownloadClientStatus; samples: [number, number][]; chart: boolean; count: number; busy: string | null; onAct: (action: 'pause' | 'resume', itemId: string) => void }) {
  const { t } = useI18n();
  const bytes = useByteFormat();
  const eta = useEta();
  const relative = useRelativeTime();
  const down = bytes.speed(client.downloadBps), up = client.uploadBps !== undefined ? bytes.speed(client.uploadBps) : undefined;
  const rest = resting(client);
  const sizeParts = (value: number) => { const [number, unit] = bytes.size(value).split(' '); return { number, unit }; };
  const received = client.sessionDownloaded !== undefined ? sizeParts(client.sessionDownloaded) : undefined;
  const sent = client.sessionUploaded !== undefined ? sizeParts(client.sessionUploaded) : undefined;
  const counts = [
    client.active ? t('widgets.arr.active', { count: client.active }) : '',
    client.paused ? t('widgets.arr.paused', { count: client.paused }) : '',
    client.queued ? t('widgets.arr.queued', { count: client.queued }) : '',
    client.seeding ? t('widgets.arr.seeding', { count: client.seeding }) : '',
  ].filter(Boolean);
  const items = client.items.filter(item => item.state !== 'seeding' && item.state !== 'completed').slice(0, count);
  // A paused SABnzbd or NZBGet queue holds every item: only the client's own button can start them again.
  const itemControl = client.canControl && !(client.clientPaused && (client.type === 'sabnzbd' || client.type === 'nzbget'));
  return (
    <>
      <div className="ndw-mx-figures">
        {rest && !client.sessionDownloaded && !client.items.length ? (
          <span className="ndw-mx-empty">
            <span className="ndw-mx-calm">{t('widgets.arr.nothingDownloading')}</span>
            <span className="ndw-mx-meta">{[`${down.value} ${down.unit}`, up ? `${up.value} ${up.unit}` : ''].filter(Boolean).join(' · ')}</span>
          </span>
        ) : rest && received ? (
          <>
            <Figure size="xl" label={t('widgets.arr.received')} value={received.number} unit={received.unit} />
            {sent && <Figure size="medium" tone="muted" label={t('widgets.arr.sent')} value={sent.number} unit={sent.unit} />}
          </>
        ) : (
          <>
            <Figure size="xl" label={<><ArrowDown size={11} aria-hidden="true" />{t('widgets.arr.download')}</>} value={down.value} unit={down.unit} />
            {up && <Figure size="medium" tone="muted" label={<><ArrowUp size={11} aria-hidden="true" />{t('widgets.arr.upload')}</>} value={up.value} unit={up.unit} />}
          </>
        )}
        <span className="ndw-mx-figures-end">
          {rest && !!client.sessionDownloaded && <span className="ndw-mx-meta">{[`${down.value} ${down.unit}`, up ? `↑ ${up.value} ${up.unit}` : ''].filter(Boolean).join(' · ')}</span>}
          {client.freeBytes !== undefined && <span className="ndw-mx-meta">{t('widgets.arr.free', { size: bytes.size(client.freeBytes) })}</span>}
        </span>
      </div>
      {chart && samples.length >= 4 && <AreaChart values={samples.map(([value]) => value)} ghost={samples.map(([, value]) => value)} muted={rest} />}
      {counts.length > 0 && <span className="ndw-mx-meta">{counts.join(' · ')}</span>}
      {items.length > 0 && (
        <ul className="ndw-mx-dl">
          {items.map(item => (
            <li key={item.id} title={item.name}>
              <Ring value={item.progress} tone={item.state === 'error' ? 'bad' : item.state === 'paused' || item.state === 'queued' ? 'muted' : undefined} />
              <span className="ndw-media-row-text">
                <span className="ndw-mx-dl-name">{item.name}</span>
                <span className="ndw-media-sub">{[item.sizeBytes ? bytes.size(item.sizeBytes) : '', item.downloadBps ? `${bytes.speed(item.downloadBps).value} ${bytes.speed(item.downloadBps).unit}` : '', `${Math.round(item.progress)} %`].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="ndw-media-time">{item.state === 'downloading' ? eta(item.etaMs) : t(`widgets.arr.state.${item.state}`)}</span>
              {itemControl && (
                <button type="button" className="ndc-icon-button ndw-mx-dl-action" disabled={busy !== null} onClick={() => onAct(item.state === 'paused' ? 'resume' : 'pause', item.id)}
                  aria-label={t(item.state === 'paused' ? 'widgets.arr.resumeOne' : 'widgets.arr.pauseOne', { name: item.name })} title={t(item.state === 'paused' ? 'widgets.arr.resumeOne' : 'widgets.arr.pauseOne', { name: item.name })}>
                  {busy === item.id ? <span className="nd-spinner" style={{ width: 11, height: 11 }} aria-hidden="true" /> : item.state === 'paused' ? <Play size={12} /> : <Pause size={12} />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {rest && (client.completed?.length ?? 0) > 0 && (
        <div className="ndw-mx-section">
          <span className="ndw-mx-label">{t('widgets.arr.finished')}</span>
          <ul className="ndw-mx-done-list">
            {client.completed!.map(item => (
              <li key={item.id} title={item.name}>
                <span className="ndw-mx-dl-name">{item.name}</span>
                <span className="ndw-media-time">{[item.sizeBytes ? bytes.size(item.sizeBytes) : '', item.at ? relative(item.at) : ''].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
