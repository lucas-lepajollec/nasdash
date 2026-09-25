'use client';

import React, { useEffect, useId, useState } from 'react';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { useConfig } from '@/hooks/useConfig';
import { useSystemStats } from '@/hooks/useSystemStats';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeWidget } from '../calme';

/**
 * Calme latency graph: the current latency in large with its state, then a
 * smooth line over the last minute (fading in from the left, a soft glow
 * under it, the average as a faint dashed line, a live dot on the last
 * value). Average, range, jitter and quality are an option of the widget
 * (Settings → Widgets → Network graph), off by default.
 */
export default function CalmeNetworkGraph({ editMode, isVisible = true }: { editMode?: boolean; isVisible?: boolean }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { history } = useSystemStats();
  const id = useId().replace(/:/g, '');
  const [ready, setReady] = useState(false);
  // The chart measures its box: wait for the grid to place the widget.
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const title = t('network.calme.latency');
  if (!ready || history.length === 0) {
    return <CalmeWidget title={title} editMode={editMode}><div className="ndc-empty"><span className="nd-spinner" style={{ width: 18, height: 18 }} /></div></CalmeWidget>;
  }

  const latencies = history.map(point => point.latency).filter(value => typeof value === 'number');
  const current = latencies.at(-1) ?? 0;
  const min = latencies.length ? Math.min(...latencies) : 0;
  const max = latencies.length ? Math.max(...latencies) : 0;
  const average = latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0;
  // Mean deviation between consecutive pings (RFC 1889 estimate).
  let jitter = 0;
  if (latencies.length > 1) {
    let total = 0;
    for (let i = 1; i < latencies.length; i++) total += Math.abs(latencies[i] - latencies[i - 1]);
    jitter = Math.round((total / (latencies.length - 1)) * 10) / 10;
  }
  const quality = Math.max(10, Math.min(100, Math.round(100 - average * 0.12 - jitter * 1.2)));
  const state = current > 150 ? { label: t('Lent'), tone: 'bad' } : current > 80 ? { label: t('Moyen'), tone: 'warn' } : { label: t('Excellent'), tone: 'good' };
  const showStats = !!config?.settings?.networkGraphStats;
  // A single measure draws a flat line instead of a lone dot.
  const data = history.length === 1 ? [history[0], history[0]] : history;
  const lastIndex = data.length - 1;

  const figures = [
    { label: t('network.calme.average'), value: `${average} ms` },
    { label: t('network.calme.range'), value: `${min}–${max} ms` },
    { label: t('network.calme.jitter'), value: `${jitter} ms` },
    { label: t('network.calme.quality'), value: `${quality} %` },
  ];

  return (
    <CalmeWidget title={title} editMode={editMode}>
      <div className={`ndc-net ${showStats ? 'ndc-net--stats' : ''}`}>
        <div className="ndc-net-graph">
          <div className="ndc-net-now">
            <span className="ndc-net-value">{current}<small> ms</small></span>
            <span className={`ndc-net-state ndc-net-state--${state.tone}`}>{state.label}</span>
          </div>
          <div className="ndc-net-chart">
            {/* Hidden pages keep the box but draw no chart: it would redraw every 5 s for nothing. */}
            {isVisible && <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 2 }}>
                <defs>
                  <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--nd-accent)" stopOpacity={0.28} />
                    <stop offset="70%" stopColor="var(--nd-accent)" stopOpacity={0.04} />
                    <stop offset="100%" stopColor="var(--nd-accent)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--nd-accent)" stopOpacity={0.15} />
                    <stop offset="35%" stopColor="var(--nd-accent)" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="var(--nd-accent)" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.6))]} />
                <ReferenceLine y={average} stroke="var(--nd-text-dimmed)" strokeOpacity={0.45} strokeDasharray="2 5" />
                <Tooltip
                  cursor={{ stroke: 'var(--nd-card-hover-border)', strokeWidth: 1 }}
                  contentStyle={{ background: 'var(--nd-bg-surface)', border: '1px solid var(--nd-card-hover-border)', borderRadius: 6, fontSize: '0.72rem', padding: '6px 10px', boxShadow: 'none' }}
                  itemStyle={{ color: 'var(--nd-text)' }}
                  labelStyle={{ color: 'var(--nd-text-dimmed)', marginBottom: 2 }}
                  formatter={(value) => [`${value} ms`, '']}
                  separator=""
                />
                <Area
                  type="basis"
                  dataKey="latency"
                  stroke={`url(#${id}-line)`}
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill={`url(#${id}-fill)`}
                  isAnimationActive={false}
                  activeDot={{ r: 3.5, fill: 'var(--nd-accent)', stroke: 'var(--nd-bg-surface)', strokeWidth: 2 }}
                  dot={(props: { cx?: number; cy?: number; index?: number }) => props.index === lastIndex && props.cx !== undefined && props.cy !== undefined
                    ? <g key="live"><circle className="ndc-net-pulse" cx={props.cx} cy={props.cy} r={7} /><circle cx={props.cx} cy={props.cy} r={3} fill="var(--nd-accent)" /></g>
                    : <g key={`d${props.index}`} />}
                />
              </AreaChart>
            </ResponsiveContainer>}
          </div>
        </div>
        {showStats && (
          <dl className="ndc-net-figures">
            {figures.map(figure => (
              <div key={figure.label}>
                <dt>{figure.label}</dt>
                <dd>{figure.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </CalmeWidget>
  );
}
