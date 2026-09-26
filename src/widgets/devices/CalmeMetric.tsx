'use client';

import React, { useState } from 'react';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import type { HistoryRange } from '@/integrations/history';
import type { Device } from '@/lib/types';
import type { WidgetSettings } from '@/lib/pages/types';
import { useI18n } from '@/i18n/I18nProvider';
import { useWidgetSize } from '@/components/widgets/WidgetContainer';
import { TimeChart, type ChartSeries } from '@/components/charts/TimeChart';
import { formatBytes } from '@/components/widgets/deviceReadings';
import { CalmeWidget } from '../calme';
import { latestTime, useDevicesData } from './deviceData';
import { timeText } from './format';
import { readLook, type ChartSize, type Display, type LookDefaults, type MetricId, thresholdOf } from './look';
import { MetricView } from './MetricView';
import { metricText, readingsOf, withFacets, type Reading } from './readings';
import { metricName } from './DeviceWidgetDialog';
import { RangeSwitch, rangeSetting, SERIES_COLORS } from './parts';
import { SettingsButton } from './SettingsButton';

/** Measures that have their own widget, and how each starts. */
export const METRIC_WIDGET_DISPLAY: Partial<Record<MetricId, Display>> = {
  cpu: 'bar', memory: 'bar', gpu: 'bar', temperature: 'value', load: 'value', network: 'chart', disk: 'bar',
};

export function metricDefaults(metric: MetricId): LookDefaults {
  const display = METRIC_WIDGET_DISPLAY[metric] ?? 'value';
  return { offered: [metric], shown: [metric], display, displays: { [metric]: display }, chart: { style: metric === 'network' ? 'area' : 'line', size: 'medium' } };
}

/** Height of the shared chart of a one-measure widget. */
const MULTI_CHART_HEIGHT: Record<ChartSize, number> = { small: 96, medium: 150, large: 220 };

/**
 * One measure for several machines (CPU, RAM, GPU, temperature, load,
 * network, disks for Storage): a figure, a bar or a ring per machine (per
 * disk for Storage, the fullest first), or one chart with a line per machine
 * and the danger threshold dashed. Each machine can have its own colour; the
 * extra figures (temperature, load, video memory, sizes…) are widget options.
 */
export default function CalmeMetric({ metric, devices, settings, editMode, isVisible, onUpdateSettings, title: customTitle }: {
  metric: MetricId;
  devices: Device[];
  settings: WidgetSettings;
  editMode: boolean;
  isVisible: boolean;
  onUpdateSettings: (settings: WidgetSettings) => void;
  title?: string;
}) {
  const { t, language, locale } = useI18n();
  const { width } = useWidgetSize();
  const defaults = metricDefaults(metric);
  const look = readLook(settings, defaults);
  const display = look.metrics[metric].display;
  const [range, setRange] = useState<HistoryRange>(rangeSetting(settings.range));
  const chosen = Array.isArray(settings.deviceIds) ? (settings.deviceIds as string[]) : null;
  const shown = chosen ? devices.filter(device => chosen.includes(device.id)) : devices;
  const data = useDevicesData(shown.map(device => device.id), display === 'chart' ? range : '1h', isVisible);
  const title = customTitle ?? (metric === 'disk' ? t('devices.calme.storage') : metricName(metric, t));
  const size = width < 300 ? 'small' : width < 520 ? 'medium' : 'large';

  // One entry per machine (per disk for Storage, the fullest first).
  const entries = shown.flatMap((device, deviceIndex) => readingsOf(data[device.id]?.data, metric, t, language).map(reading => ({ device, deviceIndex, reading })));
  if (metric === 'disk') entries.sort((a, b) => (b.reading.value ?? 0) - (a.reading.value ?? 0));
  const labelled = (entry: typeof entries[number]): Reading => withFacets({
    ...entry.reading,
    label: metric === 'disk' || (metric === 'gpu' && entry.reading.label !== 'GPU') ? [entry.reading.label, entry.device.name].join(' · ') : entry.device.name,
  }, data[entry.device.id]?.data, look.facets, look.valueParts, t, language, display);
  // A machine's colour: its own, else the measure's (a chart gives each machine a distinct one).
  const colorFor = (entry: typeof entries[number], index: number) => look.deviceColors[entry.device.id]
    ?? (display === 'chart' ? SERIES_COLORS[index % SERIES_COLORS.length] : look.metrics[metric].color);

  const totalFree = metric === 'disk' ? shown.reduce((sum, device) => sum + (data[device.id]?.data?.metrics ?? []).filter(item => item.kind === 'disk').reduce((inner, disk) => {
    const used = disk.usedBytes ?? (disk.totalBytes ? (disk.totalBytes * disk.percent) / 100 : 0);
    return inner + (disk.totalBytes ? disk.totalBytes - used : 0);
  }, 0), 0) : 0;

  const end = Math.max(0, ...shown.map(device => latestTime(data[device.id]?.data)));
  const span = range === '1h' ? 3_600_000 : 86_400_000;
  const threshold = thresholdOf(look, metric);
  const series: ChartSeries[] = entries.map((entry, index) => ({
    id: [entry.device.id, entry.reading.key].join('|'),
    label: labelled(entry).label,
    color: colorFor(entry, index),
    points: entry.reading.points,
    area: look.chart.style === 'area' && index === 0,
  })).filter(item => item.points.length > 0);
  const percentScale = metric !== 'network' && metric !== 'load';

  return (
    <CalmeWidget
      title={title}
      editMode={editMode}
      aside={totalFree > 0 && <span className="ndc-title-note">{t('devices.calme.free', { size: formatBytes(totalFree, language) })}</span>}
    >
      {editMode && (
        <SettingsButton
          options={{ title: t('devices.look.settingsOf', { name: title }), devices, deviceMode: 'multi', deviceKey: 'deviceIds', defaults, single: true, range: true, deviceColors: true }}
          settings={settings}
          onSave={next => { onUpdateSettings(next); setRange(rangeSetting(next.range)); }}
        />
      )}
      {entries.length === 0 ? (
        devices.length === 0 ? <SetupGuide kind="devices" /> : <div className="ndc-empty">{shown.length === 0 ? t('devices.calme.noDevice') : metric === 'disk' ? t('devices.calme.noDisk') : t('devices.calme.noData')}</div>
      ) : display === 'chart' ? (
        <div className="ndc-dev-chart ndc-dev-chart--multi">
          <div className="ndc-legend">
            {series.map(item => <span key={item.id} className="ndc-legend-item"><span className="ndc-legend-mark is-square" style={{ background: item.color }} />{item.label}</span>)}
            <span className="ndc-legend-note"><RangeSwitch value={range} onChange={setRange} /></span>
          </div>
          <TimeChart
            series={series}
            start={end - span}
            end={end}
            height={MULTI_CHART_HEIGHT[look.chart.size]}
            max={percentScale ? (metric === 'temperature' ? Math.max(100, (threshold ?? 0) + 10) : 100) : undefined}
            threshold={threshold !== null && percentScale ? { value: threshold, color: look.dangerColor } : undefined}
            formatValue={value => metricText(metric, value, language)}
            formatTime={time => timeText(time, locale, range === '1h')}
            startLabel={range === '1h' ? t('devices.calme.hourAgo') : t('devices.calme.dayAgo')}
            endLabel={t('devices.calme.now')}
            showScale
            labelledTooltip
            variant={look.chart.style}
            ariaLabel={title}
          />
        </div>
      ) : (
        <div className={`ndc-metric-list ndc-metric-list--${display}`}>
          {entries.map((entry, index) => (
            <MetricView
              key={[entry.device.id, entry.reading.key].join('|')}
              reading={labelled(entry)}
              look={look}
              display={display}
              window={{ start: end - span, end, withSeconds: true }}
              size={size}
              color={colorFor(entry, index)}
            />
          ))}
        </div>
      )}
    </CalmeWidget>
  );
}
