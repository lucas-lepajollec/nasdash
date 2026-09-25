'use client';

import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { areaPath, downsample, nearestIndex, scaleFor, smoothPath, tooltipLeft, type Point } from './chartMath';

export interface ChartSeries {
  id: string;
  label: string;
  /** CSS colour (a variable such as `var(--ndc-kind-cpu)` follows the theme). */
  color: string;
  points: readonly Point[];
  /** Filled under the line (the first series of a device chart). */
  area?: boolean;
}

export interface TimeChartProps {
  series: ChartSeries[];
  /** Shown time window (ms). */
  start: number;
  end: number;
  height: number;
  /** Fixed top of the scale (100 for percentages); otherwise rounded up from the data. */
  max?: number;
  formatValue: (value: number, series: ChartSeries) => string;
  formatTime: (time: number) => string;
  /** Labels under the plot: its start and its end ("now"). */
  startLabel?: string;
  endLabel?: string;
  /** Scale labels on the right (top and middle). */
  showScale?: boolean;
  /** Dashed line at a danger threshold. */
  threshold?: { value: number; color: string };
  /** `area`: the first line filled (default); `line`: lines only; `bars`: one bar per time slot and series. */
  variant?: 'area' | 'line' | 'bars';
  /** Series names in the tooltip (several machines); otherwise colours only. */
  labelledTooltip?: boolean;
  ariaLabel: string;
}

const PLOT_TOP = 8;
const AXIS = 16;
/** Points drawn at most (the pointer still reads the thinned series). */
const MAX_POINTS = 240;

/**
 * The Calme time chart: smooth lines (the first one filled with a fading
 * gradient), a live dot on the latest value and, under the pointer, a dashed
 * line with the exact values in a tooltip that always stays inside the block.
 * It follows the width of its block.
 */
export function TimeChart({ series, start, end, height, max, formatValue, formatTime, startLabel, endLabel, showScale, labelledTooltip, variant = 'area', threshold, ariaLabel }: TimeChartProps) {
  const gradient = `ndc-chart-fill-${useId().replace(/:/g, '')}`;
  const box = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [tipWidth, setTipWidth] = useState(120);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(entries => setWidth(Math.round(entries[0]?.contentRect.width ?? 0)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const plotHeight = Math.max(20, height - PLOT_TOP - (startLabel || endLabel ? AXIS : 4));
  const thinned = useMemo(() => series.map(item => ({ ...item, points: downsample(item.points.filter(point => point[0] >= start - 60_000), MAX_POINTS) })), [series, start]);
  const scale = useMemo(() => scaleFor({
    width: Math.max(1, width), top: PLOT_TOP, height: plotHeight, start, end, max,
    values: thinned.flatMap(item => item.points.map(point => point[1])),
  }), [width, plotHeight, start, end, max, thinned]);
  const baseline = PLOT_TOP + plotHeight;
  const toXY = (points: readonly Point[]): Point[] => points.map(([time, value]) => [scale.x(time), scale.y(value)]);

  // Values under the pointer: the nearest point of each series.
  const hovered = hover === null ? null : thinned.map(item => {
    const index = nearestIndex(item.points.map(point => point[0]), hover);
    return index < 0 ? null : { series: item, point: item.points[index] };
  }).filter((entry): entry is { series: typeof thinned[number]; point: Point } => entry !== null);
  const hoverX = hovered?.length ? scale.x(hovered[0].point[0]) : null;

  useLayoutEffect(() => {
    if (tip.current) setTipWidth(tip.current.offsetWidth);
  }, [hover]);

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
    setHover(start + ratio * (end - start));
  };

  const last = thinned[0]?.points[thinned[0].points.length - 1];

  return (
    <div ref={box} className="ndc-chart" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={thinned[0]?.color ?? 'currentColor'} stopOpacity="0.26" />
              <stop offset="1" stopColor={thinned[0]?.color ?? 'currentColor'} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="ndc-chart-grid" d={`M0 ${PLOT_TOP}H${width}M0 ${PLOT_TOP + plotHeight / 2}H${width}M0 ${baseline}H${width}`} />
          {threshold && threshold.value <= scale.max && (
            <path className="ndc-chart-threshold" d={`M0 ${scale.y(threshold.value)}H${width}`} style={{ stroke: threshold.color }} />
          )}
          {showScale && (
            <>
              <text className="ndc-chart-scale" x={width} y={PLOT_TOP - 1} textAnchor="end">{formatValue(scale.max, thinned[0])}</text>
              <text className="ndc-chart-scale" x={width} y={PLOT_TOP + plotHeight / 2 - 2} textAnchor="end">{formatValue(scale.max / 2, thinned[0])}</text>
            </>
          )}
          {variant === 'area' && thinned.map(item => item.area && item.points.length > 1 && (
            <path key={`${item.id}-area`} d={areaPath(toXY(item.points), baseline, PLOT_TOP)} fill={`url(#${gradient})`} />
          ))}
          {variant === 'bars'
            ? barsOf(thinned, start, end, width, scale, baseline).map(bar => <rect key={bar.key} x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx={Math.min(1.5, bar.width / 2)} style={{ fill: bar.color }} className="ndc-chart-bar" />)
            : [...thinned].reverse().map(item => item.points.length > 0 && (
              <path key={item.id} className="ndc-chart-line" d={smoothPath(toXY(item.points), PLOT_TOP, baseline)} style={{ stroke: item.color }} />
            ))}
          {last && hover === null && variant !== 'bars' && (
            <g className="ndc-chart-live" style={{ color: thinned[0].color }}>
              <circle cx={Math.min(width - 3, scale.x(last[0]))} cy={scale.y(last[1])} r={6} className="ndc-chart-live-halo" />
              <circle cx={Math.min(width - 3, scale.x(last[0]))} cy={scale.y(last[1])} r={2.6} fill="currentColor" />
            </g>
          )}
          {hoverX !== null && hovered && (
            <g>
              <path className="ndc-chart-cursor" d={`M${hoverX} ${PLOT_TOP - 4}V${baseline}`} />
              {hovered.map(entry => (
                <circle key={entry.series.id} cx={hoverX} cy={scale.y(entry.point[1])} r={3.5} className="ndc-chart-dot" style={{ stroke: entry.series.color }} />
              ))}
            </g>
          )}
          {startLabel && <text className="ndc-chart-axis" x={0} y={height - 3}>{startLabel}</text>}
          {endLabel && <text className="ndc-chart-axis" x={width} y={height - 3} textAnchor="end">{endLabel}</text>}
        </svg>
      )}
      {hoverX !== null && hovered && hovered.length > 0 && (
        <div ref={tip} className="ndc-chart-tip" style={{ left: tooltipLeft(hoverX, tipWidth, width) }} aria-hidden="true">
          <span className="ndc-chart-tip-time">{formatTime(hovered[0].point[0])}</span>
          <span className={labelledTooltip ? 'ndc-chart-tip-rows' : 'ndc-chart-tip-row'}>
            {hovered.map(entry => (
              <span key={entry.series.id} className="ndc-chart-tip-value">
                <span className="ndc-chart-tip-mark" style={{ background: entry.series.color }} />
                {labelledTooltip && <span className="ndc-chart-tip-label">{entry.series.label}</span>}
                {formatValue(entry.point[1], entry.series)}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

/** Time slots of the bars view: at most one every 6 px, series side by side in each slot. */
function barsOf(series: ChartSeries[], start: number, end: number, width: number, scale: { x: (time: number) => number; y: (value: number) => number }, baseline: number) {
  const slots = Math.max(8, Math.min(72, Math.floor(width / 6)));
  const slotWidth = width / slots;
  const span = (end - start) / slots;
  const drawn = series.filter(item => item.points.length > 0);
  const inner = (slotWidth * 0.72) / Math.max(1, drawn.length);
  const bars: Array<{ key: string; x: number; y: number; width: number; height: number; color: string }> = [];
  drawn.forEach((item, index) => {
    const sums = new Array<number>(slots).fill(0), counts = new Array<number>(slots).fill(0);
    for (const [time, value] of item.points) {
      const slot = Math.floor((time - start) / span);
      if (slot < 0 || slot >= slots) continue;
      sums[slot] += value; counts[slot] += 1;
    }
    for (let slot = 0; slot < slots; slot++) {
      if (!counts[slot]) continue;
      const top = scale.y(sums[slot] / counts[slot]);
      bars.push({ key: `${item.id}-${slot}`, x: slot * slotWidth + slotWidth * 0.14 + index * inner, y: top, width: Math.max(1, inner - 0.6), height: Math.max(1, baseline - top), color: item.color });
    }
  });
  return bars;
}
