'use client';

import React from 'react';
import { areaPath, downsample, smoothPath, type Point } from './chartMath';

/** A thin ring with the value in its centre. */
export function RingGauge({ percent, color, label, size = 92, text, unit }: {
  percent: number | undefined;
  color: string;
  label: string;
  size?: number;
  /** Value shown in the centre instead of the percentage (temperature, load). */
  text?: string;
  unit?: string;
}) {
  const stroke = Math.max(4, Math.round(size / 15));
  const radius = size / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const value = percent === undefined ? 0 : Math.min(100, Math.max(0, percent));
  return (
    <div className="ndc-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} className="ndc-ring-track" strokeWidth={stroke} />
        {percent !== undefined && (
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} strokeLinecap="round"
            style={{ stroke: color, transition: 'stroke-dasharray 0.6s ease' }}
            strokeDasharray={`${(circumference * value) / 100} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span className="ndc-ring-center">
        <span className="ndc-ring-value" style={{ fontSize: Math.round(size * (text && text.length > 3 ? 0.21 : 0.26)) }}>
          {text ?? (percent === undefined ? '–' : Math.round(value))}<span className="ndc-ring-unit">{text !== undefined ? unit ?? '' : percent === undefined ? '' : '%'}</span>
        </span>
        {size >= 64 && label && <span className="ndc-ring-label">{label}</span>}
      </span>
    </div>
  );
}

/**
 * A small curve that fills the width of its block (drawn in a 100-wide box
 * stretched to fit; the stroke keeps its thickness).
 */
export function Sparkline({ points, color, height = 22, max = 100, filled = false, label }: { points: readonly Point[]; color: string; height?: number; max?: number; filled?: boolean; label?: string }) {
  const thin = downsample(points, 60);
  if (thin.length < 2) return <svg className="ndc-spark" height={height} aria-hidden="true" />;
  const start = thin[0][0], end = thin[thin.length - 1][0];
  const span = Math.max(1, end - start);
  const top = 2, bottom = height - 1;
  const xy: Point[] = thin.map(([time, value]) => [((time - start) / span) * 100, bottom - (Math.min(max, Math.max(0, value)) / max) * (bottom - top)]);
  return (
    <svg className="ndc-spark" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {filled && <path d={areaPath(xy, bottom, top)} style={{ fill: color }} className="ndc-spark-fill" />}
      <path d={smoothPath(xy, top, bottom)} className="ndc-spark-line" style={{ stroke: color }} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A thin usage bar. */
export function UsageBar({ percent, color, height = 4 }: { percent: number | undefined; color: string; height?: number }) {
  return (
    <span className="ndc-usage" style={{ height }}>
      <span className="ndc-usage-fill" style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%`, background: color }} />
    </span>
  );
}
