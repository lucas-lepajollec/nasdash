'use client';

import React from 'react';
import { BatteryCharging, BatteryWarning, PlugZap, Unplug } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { UPS_TYPES, type UpsSummary } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { DataError, pick, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { chosenConnection, ConnectionPicker } from '@/components/widgets/content/ConnectionPicker';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import { useEta } from '@/components/widgets/media/arr';
import { Figure, Stat, Track } from '@/components/widgets/media/visual';

const STYLES = ['full', 'compact'] as const;
/** Parts that can be hidden (shown by default), then the details (hidden by default). */
const PARTS = ['bar', 'runtime', 'shutdown', 'load', 'input', 'events'] as const;
type Part = typeof PARTS[number] | 'details';
const shown = (settings: WidgetSettings, part: Part) => part === 'details' ? settings.details === true : settings[part] !== false;

/**
 * A UPS read through NUT or apcupsd, for the many units that show nothing by
 * themselves: on mains or on battery, the charge left and how long it lasts,
 * the load it carries and the line voltage; a battery to replace or an
 * overload is said plainly.
 */
export default function CalmeUps({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const connection = chosenConnection(config?.integrations, UPS_TYPES, settings.integrationId);
  // On battery every second counts: the widget follows the UPS closely while it is shown.
  const { data, error, mutate, stale } = useWidgetData<UpsSummary>('/api/widgets/ups', widgetId, settings, { refreshMs: 10_000, isVisible, method: 'GET', enabled: !!connection });
  const title = t('widget.ups.name');

  return (
    <CalmeWidget title={title} editMode={editMode}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings}>
          {(draft, change) => (
            <>
              <CalmeField label={t('widgets.connection')}>
                <ConnectionPicker types={UPS_TYPES} section="power" value={typeof draft.integrationId === 'string' ? draft.integrationId : undefined} onChange={id => change({ integrationId: id, ups: null })} />
              </CalmeField>
              {/* A NUT server can serve several UPS: the ones it listed when the widget last read it. */}
              {(data?.devices?.length ?? 0) > 1 && (draft.integrationId ?? null) === (settings.integrationId ?? null) && (
                <CalmeRow label={t('widgets.ups.device')}>
                  <CalmeSegmented label={t('widgets.ups.device')} value={typeof draft.ups === 'string' ? draft.ups : data!.devices![0]} options={data!.devices!.map(name => ({ value: name, label: name }))} onChange={name => change({ ups: name === data!.devices![0] ? null : name })} />
                </CalmeRow>
              )}
              <CalmeField label={t('widgets.display')}>
                <CalmeSegmented label={t('widgets.display')} value={pick(draft.style, STYLES, 'full')} options={STYLES.map(value => ({ value, label: t(`widgets.ups.style.${value}`) }))} onChange={value => change({ style: value === 'full' ? null : value })} />
              </CalmeField>
              {pick(draft.style, STYLES, 'full') === 'full' && (
                <>
                  {PARTS.map(part => (
                    <CalmeRow key={part} label={t(`widgets.ups.part.${part}`)}>
                      <CalmeSwitch label={t(`widgets.ups.part.${part}`)} checked={draft[part] !== false} onChange={on => change({ [part]: on ? null : false })} />
                    </CalmeRow>
                  ))}
                  <CalmeRow label={t('widgets.ups.part.details')} info={t('widgets.ups.part.detailsHint')}>
                    <CalmeSwitch label={t('widgets.ups.part.details')} checked={draft.details === true} onChange={on => change({ details: on || null })} />
                  </CalmeRow>
                </>
              )}
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <SetupGuide kind="ups" />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 52 }} /><span className="ndw-skeleton-row" style={{ height: 36 }} /></div>
              : <Ups data={data} settings={settings} />}
      </div>
    </CalmeWidget>
  );
}

/**
 * Seconds before the monitoring software shuts the machines down, at the present load: the runtime left above its
 * runtime threshold, or the share of it above the charge threshold (a linear discharge), whichever comes first.
 */
export function untilShutdown(data: UpsSummary): number | undefined {
  const { runtimeSeconds: runtime, batteryPercent: charge, shutdownRuntimeSeconds: lowRuntime, shutdownPercent: lowCharge } = data;
  if (runtime === undefined || runtime <= 0) return undefined;
  const limits = [
    lowRuntime !== undefined && lowRuntime > 0 ? runtime - lowRuntime : undefined,
    lowCharge !== undefined && lowCharge > 0 && charge !== undefined && charge > 0 ? runtime * (charge - lowCharge) / charge : undefined,
  ].filter((value): value is number => value !== undefined);
  return limits.length ? Math.max(0, Math.round(Math.min(...limits))) : undefined;
}

function Ups({ data, settings }: { data: UpsSummary; settings: WidgetSettings }) {
  const { t, locale } = useI18n();
  const eta = useEta();
  const number = (value: number, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  // One word for the state, the gravest first; colour only on it.
  const state = data.offline ? 'offline' : data.lowBattery ? 'low' : data.power === 'battery' ? 'battery' : data.power === 'mains' ? (data.charging ? 'charging' : 'mains') : 'unknown';
  const tone = state === 'low' ? 'is-bad' : state === 'battery' || state === 'offline' ? 'is-warn' : '';
  const Icon = state === 'low' ? BatteryWarning : state === 'battery' ? Unplug : state === 'charging' ? BatteryCharging : PlugZap;
  const battery = data.batteryPercent;
  const compact = pick(settings.style, STYLES, 'full') === 'compact';
  const show = (part: Part) => !compact && shown(settings, part);
  const shutdown = show('shutdown') || compact ? untilShutdown(data) : undefined;
  const notes = [
    data.replaceBattery ? { text: t('widgets.ups.replaceBattery'), bad: true } : undefined,
    data.overload ? { text: t('widgets.ups.overload'), bad: true } : undefined,
    show('events') && data.power === 'battery' && data.onBatterySeconds ? { text: t('widgets.ups.onBatteryFor', { duration: eta(data.onBatterySeconds * 1000) }) } : undefined,
    show('events') && data.lastTransfer ? { text: t('widgets.ups.lastTransfer', { reason: data.lastTransfer }) } : undefined,
  ].filter((note): note is { text: string; bad?: boolean } => !!note);
  const details = show('details') ? ([
    ['output', data.outputVoltage, 'V', 0], ['batteryVoltage', data.batteryVoltage, 'V', 1], ['frequency', data.inputFrequency, 'Hz', 1], ['temperature', data.temperatureC, '°C', 0],
  ] as const).filter(([, value]) => value !== undefined) : [];
  const stateLine = (
    <span className={`ndw-ups-state ${tone}`}>
      <Icon size={13} aria-hidden="true" />
      <span className="ndw-ups-name" title={[data.manufacturer, data.model].filter(Boolean).join(' ') || undefined}>{data.description ?? data.model ?? data.ups ?? data.name}</span>
      <span className="ndw-ups-word">{t(`widgets.ups.state.${state}`)}</span>
    </span>
  );
  // One line: the state, then the battery and what it leaves; the warnings stay.
  if (compact) return (
    <div className="ndw-ups is-compact">
      {stateLine}
      <span className="ndw-ups-line">
        {battery !== undefined && <span className={`ndw-ups-big ${state === 'low' ? 'is-bad' : ''}`}>{number(battery)}<small>%</small></span>}
        <span className="ndw-media-sub">{[
          data.runtimeSeconds ? eta(data.runtimeSeconds * 1000) : '',
          shutdown !== undefined ? `${t(data.power === 'battery' ? 'widgets.ups.shutdownIn' : 'widgets.ups.shutdownAfter')} ~${eta(Math.max(60, shutdown) * 1000)}` : '',
          data.loadWatts !== undefined ? `${number(data.loadWatts)} W` : '',
        ].filter(Boolean).join(' · ')}</span>
      </span>
      {notes.map(note => <span key={note.text} className={`ndw-media-sub ${note.bad ? 'ndw-ups-bad' : ''}`}>{note.text}</span>)}
    </div>
  );
  return (
    <div className="ndw-ups">
      {stateLine}
      {battery !== undefined && (
        <div className="ndw-ups-hero">
          {/* Narrow widgets: the runtime and the shutdown go under the charge instead of over it. */}
          <div className="ndw-mx-figures is-wrap">
            <Figure size="xl" label={t('widgets.ups.battery')} value={number(battery)} unit="%" tone={state === 'low' ? 'bad' : undefined} />
            {show('runtime') && data.runtimeSeconds !== undefined && data.runtimeSeconds > 0 && <Figure size="medium" tone="muted" label={t('widgets.ups.runtime')} value={eta(data.runtimeSeconds * 1000)} />}
            {/* On battery it is a countdown; on mains, what an outage would leave before the machines stop. */}
            {shutdown !== undefined && <Figure size="medium" tone={data.power === 'battery' ? undefined : 'muted'} label={t(data.power === 'battery' ? 'widgets.ups.shutdownIn' : 'widgets.ups.shutdownAfter')} value={shutdown < 60 ? t('widgets.arr.eta.soon') : `~${eta(shutdown * 1000)}`} />}
          </div>
          {show('bar') && <Track value={battery} tone={state === 'low' ? 'bad' : state === 'battery' ? 'warn' : undefined} />}
        </div>
      )}
      {((show('load') && data.loadPercent !== undefined) || (show('input') && data.inputVoltage !== undefined) || details.length > 0) && (
        <div className="ndw-mx-statrow">
          {!show('load') ? null : data.loadWatts !== undefined
            ? <Stat value={`${number(data.loadWatts)}\u00a0W`} label={data.loadPercent !== undefined ? t('widgets.ups.loadShare', { percent: number(data.loadPercent) }) : t('widgets.ups.load')} />
            : data.loadPercent !== undefined && <Stat value={`${number(data.loadPercent)}\u00a0%`} label={t('widgets.ups.load')} />}
          {show('input') && data.inputVoltage !== undefined && <Stat value={`${number(data.inputVoltage)}\u00a0V`} label={t('widgets.ups.input')} tone={data.power === 'battery' ? 'muted' : undefined} />}
          {details.map(([key, value, unit, digits]) => <Stat key={key} value={`${number(value!, digits)}\u00a0${unit}`} label={t(`widgets.ups.detail.${key}`)} />)}
        </div>
      )}
      {notes.map(note => <span key={note.text} className={`ndw-media-sub ${note.bad ? 'ndw-ups-bad' : ''}`}>{note.text}</span>)}
    </div>
  );
}
