'use client';

import React from 'react';
import { BatteryCharging, BatteryWarning, PlugZap, Unplug } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { UPS_TYPES, type UpsSummary } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { DataError, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { chosenConnection, ConnectionPicker } from '@/components/widgets/content/ConnectionPicker';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import { useEta } from '@/components/widgets/media/arr';
import { Figure, Stat, Track } from '@/components/widgets/media/visual';

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
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <SetupGuide kind="ups" />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 52 }} /><span className="ndw-skeleton-row" style={{ height: 36 }} /></div>
              : <Ups data={data} />}
      </div>
    </CalmeWidget>
  );
}

function Ups({ data }: { data: UpsSummary }) {
  const { t, locale } = useI18n();
  const eta = useEta();
  const number = (value: number, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  // One word for the state, the gravest first; colour only on it.
  const state = data.offline ? 'offline' : data.lowBattery ? 'low' : data.power === 'battery' ? 'battery' : data.power === 'mains' ? (data.charging ? 'charging' : 'mains') : 'unknown';
  const tone = state === 'low' ? 'is-bad' : state === 'battery' || state === 'offline' ? 'is-warn' : '';
  const Icon = state === 'low' ? BatteryWarning : state === 'battery' ? Unplug : state === 'charging' ? BatteryCharging : PlugZap;
  const battery = data.batteryPercent;
  const notes = [
    data.replaceBattery ? { text: t('widgets.ups.replaceBattery'), bad: true } : undefined,
    data.overload ? { text: t('widgets.ups.overload'), bad: true } : undefined,
    data.power === 'battery' && data.onBatterySeconds ? { text: t('widgets.ups.onBatteryFor', { duration: eta(data.onBatterySeconds * 1000) }) } : undefined,
    data.lastTransfer ? { text: t('widgets.ups.lastTransfer', { reason: data.lastTransfer }) } : undefined,
  ].filter((note): note is { text: string; bad?: boolean } => !!note);
  return (
    <div className="ndw-ups">
      <span className={`ndw-ups-state ${tone}`}>
        <Icon size={13} aria-hidden="true" />
        <span className="ndw-ups-name" title={[data.manufacturer, data.model].filter(Boolean).join(' ') || undefined}>{data.model ?? data.ups ?? data.name}</span>
        <span className="ndw-ups-word">{t(`widgets.ups.state.${state}`)}</span>
      </span>
      {battery !== undefined && (
        <div className="ndw-ups-hero">
          <div className="ndw-mx-figures">
            <Figure size="xl" label={t('widgets.ups.battery')} value={number(battery)} unit="%" tone={state === 'low' ? 'bad' : undefined} />
            {data.runtimeSeconds !== undefined && data.runtimeSeconds > 0 && <Figure size="medium" tone="muted" label={t('widgets.ups.runtime')} value={eta(data.runtimeSeconds * 1000)} />}
          </div>
          <Track value={battery} tone={state === 'low' ? 'bad' : state === 'battery' ? 'warn' : undefined} />
        </div>
      )}
      {(data.loadPercent !== undefined || data.inputVoltage !== undefined) && (
        <div className="ndw-mx-statrow">
          {data.loadWatts !== undefined
            ? <Stat value={`${number(data.loadWatts)} W`} label={data.loadPercent !== undefined ? t('widgets.ups.loadShare', { percent: number(data.loadPercent) }) : t('widgets.ups.load')} />
            : data.loadPercent !== undefined && <Stat value={`${number(data.loadPercent)} %`} label={t('widgets.ups.load')} />}
          {data.inputVoltage !== undefined && <Stat value={`${number(data.inputVoltage)} V`} label={t('widgets.ups.input')} tone={data.power === 'battery' ? 'muted' : undefined} />}
        </div>
      )}
      {notes.map(note => <span key={note.text} className={`ndw-media-sub ${note.bad ? 'ndw-ups-bad' : ''}`}>{note.text}</span>)}
    </div>
  );
}
