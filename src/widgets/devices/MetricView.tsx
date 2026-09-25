'use client';

import React from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { TimeChart } from '@/components/charts/TimeChart';
import { RingGauge, Sparkline, UsageBar } from '@/components/charts/Gauges';
import { timeText } from './format';
import { CHART_HEIGHT, colorOf, fillOf, isDanger, type ChartLook, type Display, type WidgetLook } from './look';
import { metricText, type Reading } from './readings';

/** Chart window of a reading. */
export interface Window { start: number; end: number; withSeconds: boolean }

/**
 * One measure drawn in its display: a figure, a bar, a ring or a small
 * chart (values under the pointer, danger threshold dashed). Past its
 * threshold the measure takes the widget's danger colour.
 */
export function MetricView({ reading, look, display, window, size = 'medium', hideLabel, inline, color: base, chart }: {
  reading: Reading;
  look: WidgetLook;
  display: Display;
  window: Window;
  /** Ring and chart sizes: follows the widget width. */
  size?: 'small' | 'medium' | 'large';
  hideLabel?: boolean;
  /** Inside a list row: small ring beside its value, sparkline instead of a chart. */
  inline?: boolean;
  /** Colour of this reading (a machine's colour in one-measure widgets); the measure's otherwise. */
  color?: string;
  /** Chart type and height (the measure's by default). */
  chart?: ChartLook;
}) {
  const { language, locale } = useI18n();
  const danger = isDanger(look, reading.metric, reading.value, reading.cores);
  const color = colorOf(look, reading.metric, reading.value, reading.cores, base);
  const chartLook = chart ?? look.metrics[reading.metric].chart;
  const fill = fillOf(reading.metric, reading.value, reading.cores);
  const threshold = look.metrics[reading.metric].danger;

  if (inline && display === 'ring') {
    return (
      <div className="ndc-m ndc-m--inline-ring" title={[reading.label, reading.text, reading.detail].filter(Boolean).join(' · ')}>
        <RingGauge percent={fill} color={color} label={reading.label} size={30} text="" unit="" />
        <span className="ndc-m-head">
          {!hideLabel && <span className="ndc-m-label">{reading.label}</span>}
          <span className={`ndc-m-value ${danger ? 'is-danger' : ''}`} style={danger ? { color } : undefined}>{reading.text}</span>
        </span>
      </div>
    );
  }

  if (inline && display === 'chart') {
    return (
      <div className="ndc-m ndc-m--inline-chart">
        <span className="ndc-m-head">
          {!hideLabel && <span className="ndc-m-label">{reading.label}</span>}
          <span className={`ndc-m-value ${danger ? 'is-danger' : ''}`} style={danger ? { color } : undefined}>{reading.text}</span>
        </span>
        <Sparkline points={reading.points} color={color} height={20} max={reading.metric === 'network' || reading.metric === 'load' ? Math.max(1, ...reading.points.map(point => point[1])) : 100} filled label={reading.label} />
      </div>
    );
  }

  if (display === 'ring') {
    const ringSize = size === 'small' ? 56 : size === 'medium' ? 76 : 92;
    const [number, ...unit] = reading.text.split(' ');
    const custom = reading.metric === 'temperature' || reading.metric === 'load';
    // Short names (CPU, RAM) sit in the ring; a machine or disk name goes under it.
    const inside = reading.label.length <= 5 && ringSize >= 64;
    return (
      <div className="ndc-m ndc-m--ring" title={[reading.label, reading.text, reading.detail].filter(Boolean).join(' · ')}>
        <RingGauge percent={fill} color={color} label={inside ? reading.label : ''} size={ringSize} {...(custom ? { text: number, unit: unit.join(' ') } : {})} />
        {!inside && !hideLabel && <span className="ndc-m-label ndc-m-ring-name">{reading.label}</span>}
        {reading.detail && size !== 'small' && <span className="ndc-m-detail">{reading.detail}</span>}
      </div>
    );
  }

  const head = (
    <span className="ndc-m-head">
      {!hideLabel && <span className="ndc-m-label">{reading.label}</span>}
      <span className={`ndc-m-value ${danger ? 'is-danger' : ''}`} style={danger ? { color } : undefined}>{reading.text}</span>
      {reading.detail && display !== 'value' && !inline && <span className="ndc-m-detail">{reading.detail}</span>}
    </span>
  );

  if (display === 'bar') {
    return (
      <div className="ndc-m ndc-m--bar">
        {head}
        <UsageBar percent={fill} color={color} height={4} />
      </div>
    );
  }

  if (display === 'chart') {
    const percentScale = reading.metric !== 'network' && reading.metric !== 'load';
    return (
      <div className="ndc-m ndc-m--chart">
        {head}
        <TimeChart
          series={[
            { id: reading.key, label: reading.label, color, points: reading.points, area: true },
            ...(reading.second ? [{ id: `${reading.key}-second`, label: reading.second.label, color: 'var(--ndc-kind-memory)', points: reading.second.points }] : []),
          ]}
          start={window.start}
          end={window.end}
          height={CHART_HEIGHT[chartLook.size]}
          variant={chartLook.style}
          max={percentScale ? (reading.metric === 'temperature' ? Math.max(100, (threshold ?? 0) + 10) : 100) : undefined}
          threshold={threshold !== null && reading.metric !== 'network' && reading.metric !== 'load' ? { value: threshold, color: look.dangerColor } : undefined}
          formatValue={value => metricText(reading.metric, value, language)}
          formatTime={time => timeText(time, locale, window.withSeconds)}
          ariaLabel={reading.label}
        />
      </div>
    );
  }

  // Figure only (in a row: as small as the other cells).
  if (inline) return <div className="ndc-m ndc-m--inline-value">{head}</div>;
  return (
    <div className={`ndc-m ndc-m--value ndc-m--${reading.metric}`}>
      {!hideLabel && <span className="ndc-m-label">{reading.label}</span>}
      <span className={`ndc-m-big ${danger ? 'is-danger' : ''}`} style={danger ? { color } : undefined}>{reading.text}</span>
      {reading.detail && <span className="ndc-m-detail">{reading.detail}</span>}
    </div>
  );
}
