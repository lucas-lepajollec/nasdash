'use client';

import React, { useState } from 'react';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import type { HistoryRange } from '@/integrations/history';
import type { Device } from '@/lib/types';
import type { WidgetSettings } from '@/lib/pages/types';
import { useI18n } from '@/i18n/I18nProvider';
import { useWidgetSize } from '@/components/widgets/WidgetContainer';
import { TimeChart, type ChartSeries } from '@/components/charts/TimeChart';
import { UsageBar } from '@/components/charts/Gauges';
import { toReadings } from '@/components/widgets/deviceReadings';
import { CalmeWidget } from '../calme';
import { latestTime, useDeviceData, type DeviceSnapshot } from './deviceData';
import { percentText, timeText } from './format';
import { readLook, type Display, type LookDefaults, type MetricId, type WidgetLook } from './look';
import { MetricView, type Window } from './MetricView';
import { readingsOf, type Reading } from './readings';
import { DeviceHeader, KIND_COLOR, RangeSwitch, rangeSetting, stateOf } from './parts';
import { SettingsButton } from './SettingsButton';

/** The layout follows the width: small below 260 px, medium below 440 px, large above. */
const SMALL_BELOW_PX = 260;
const MEDIUM_BELOW_PX = 440;

export const DEVICE_DEFAULTS: LookDefaults = {
  offered: ['cpu', 'memory', 'gpu', 'temperature', 'load', 'network', 'disk', 'history'],
  shown: ['cpu', 'memory', 'gpu', 'temperature', 'load', 'network', 'disk', 'history'],
  display: 'ring',
  perMetricDisplay: true,
  displays: { cpu: 'ring', memory: 'ring', gpu: 'ring', temperature: 'value', load: 'value', network: 'value', disk: 'bar', history: 'chart' },
};

/**
 * One machine: its measures, each in its display (figure, bar, ring or
 * chart), grouped so rings and figures sit side by side, bars below, charts
 * across the width; then the CPU + RAM history. The size of rings and charts
 * follows the width of the widget. Settings (machine, measures, displays,
 * colours, danger thresholds) are in its dialog.
 */
export default function CalmeDevice({ devices, settings, editMode, isVisible, showSensitive, onUpdateSettings }: {
  devices: Device[];
  settings: WidgetSettings;
  editMode: boolean;
  isVisible: boolean;
  showSensitive: boolean;
  onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const { width } = useWidgetSize();
  const device = devices.find(candidate => candidate.id === settings.deviceId) ?? devices[0];
  const [range, setRange] = useState<HistoryRange>(rangeSetting(settings.range));
  const entry = useDeviceData(device?.id, range, isVisible);
  const size = width < SMALL_BELOW_PX ? 'small' : width < MEDIUM_BELOW_PX ? 'medium' : 'large';
  const look = readLook(settings, DEVICE_DEFAULTS);

  const settingsButton = editMode && (
    <SettingsButton
      options={{ title: t('devices.look.settingsOf', { name: t('widget.device.name') }), devices, deviceMode: 'single', deviceKey: 'deviceId', defaults: DEVICE_DEFAULTS, range: true }}
      settings={settings}
      onSave={next => { onUpdateSettings(next); setRange(rangeSetting(next.range)); }}
    />
  );

  if (!device) {
    return <CalmeWidget title={t('devices.calme.device')} editMode={editMode}>{settingsButton}<SetupGuide kind="devices" /></CalmeWidget>;
  }

  const state = stateOf(entry);
  return (
    <CalmeWidget title={t('devices.calme.device')} editMode={editMode}>
      {settingsButton}
      <div className={`ndc-dev ndc-dev--${size} ${state === 'offline' ? 'is-offline' : ''}`}>
        <DeviceHeader device={device} snapshot={entry.data} state={state} showSensitive={showSensitive} compact={size !== 'large'} />
        {state === 'offline' && entry.data?.error && <div className="ndc-dev-error">{t(entry.data.error)}</div>}
        {entry.data && <DeviceBody snapshot={entry.data} look={look} size={size} range={range} onRange={setRange} />}
      </div>
    </CalmeWidget>
  );
}

function DeviceBody({ snapshot, look, size, range, onRange }: { snapshot: DeviceSnapshot; look: WidgetLook; size: 'small' | 'medium' | 'large'; range: HistoryRange; onRange: (range: HistoryRange) => void }) {
  const { t, language, locale } = useI18n();
  // Devices without an integration: their hand-written stats as bars.
  if (!snapshot.metrics.length && snapshot.stats?.length) {
    return (
      <div className="ndc-dev-group ndc-dev-group--bar">
        {toReadings(snapshot.stats, language).map(reading => (
          <div key={reading.id} className="ndc-m ndc-m--bar">
            <span className="ndc-m-head"><span className="ndc-m-label">{reading.name}</span><span className="ndc-m-value">{reading.percent !== undefined ? percentText(reading.percent, language) : reading.capacity}</span></span>
            {reading.percent !== undefined && <UsageBar percent={reading.percent} color={KIND_COLOR.cpu} />}
          </div>
        ))}
      </div>
    );
  }

  const end = latestTime(snapshot);
  const window: Window = { start: end - (range === '1h' ? 3_600_000 : 86_400_000), end, withSeconds: range === '1h' };
  const shown = (Object.keys(look.metrics) as MetricId[]).filter(id => id !== 'history' && look.metrics[id].shown && DEVICE_DEFAULTS.offered.includes(id));
  const byDisplay = (display: Display) => shown.filter(id => look.metrics[id].display === display).flatMap(id => readingsOf(snapshot, id, t, language));
  const rings = byDisplay('ring');
  const values = byDisplay('value');
  const bars = byDisplay('bar');
  const charts = byDisplay('chart');
  const showHistory = look.metrics.history.shown && size !== 'small';
  const cell = (reading: Reading, display: Display) => <MetricView key={reading.key} reading={reading} look={look} display={display} window={window} size={size} />;

  const historySeries: ChartSeries[] = showHistory ? (['cpu', 'memory'] as const).flatMap(id => readingsOf(snapshot, id, t, language).map(reading => ({
    id, label: reading.label, color: look.metrics[id].color, points: reading.points, area: id === 'cpu',
  }))) : [];
  const needsRange = charts.length > 0 || historySeries.length > 0;

  return (
    <>
      {(rings.length > 0 || values.length > 0) && (
        <div className={`ndc-dev-top ${rings.length && values.length ? 'has-both' : ''}`}>
          {rings.length > 0 && <div className="ndc-dev-group ndc-dev-group--ring">{rings.map(reading => cell(reading, 'ring'))}</div>}
          {values.length > 0 && <div className="ndc-dev-group ndc-dev-group--value">{values.map(reading => cell(reading, 'value'))}</div>}
        </div>
      )}
      {bars.length > 0 && <div className="ndc-dev-group ndc-dev-group--bar">{bars.map(reading => cell(reading, 'bar'))}</div>}
      {needsRange && (
        <div className="ndc-dev-range">
          {historySeries.length > 0 && historySeries.map(item => <span key={item.id} className="ndc-legend-item"><span className="ndc-legend-mark" style={{ background: item.color }} />{item.label}</span>)}
          <span className="ndc-legend-note"><RangeSwitch value={range} onChange={onRange} /></span>
        </div>
      )}
      {historySeries.length > 0 && (
        <TimeChart
          series={historySeries}
          start={window.start}
          end={window.end}
          height={size === 'large' ? 132 : 96}
          max={100}
          formatValue={value => percentText(value, language)}
          formatTime={time => timeText(time, locale, window.withSeconds)}
          startLabel={range === '1h' ? t('devices.calme.hourAgo') : t('devices.calme.dayAgo')}
          endLabel={t('devices.calme.now')}
          ariaLabel={t('devices.calme.chartLabel')}
        />
      )}
      {charts.length > 0 && <div className="ndc-dev-group ndc-dev-group--chart">{charts.map(reading => cell(reading, 'chart'))}</div>}
    </>
  );
}
