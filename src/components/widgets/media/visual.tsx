'use client';

import React, { useState } from 'react';

/**
 * The visual pieces shared by the media and *arr widgets: a title's art
 * behind its text, progress as a line or a ring, a filled curve. Colours
 * come from the theme; nothing here carries a shadow or a tinted badge.
 */

/** A wide picture, faded in once loaded; nothing (the surface) while it loads or when it fails. */
export function Backdrop({ src, className = '', blur }: { src?: string; className?: string; blur?: boolean }) {
  const [state, setState] = useState<{ src?: string; ok: boolean }>({ ok: false });
  if (!src || failed.has(src)) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`ndw-mx-backdrop ${blur ? 'is-blurred' : ''} ${state.src === src && state.ok ? 'is-loaded' : ''} ${className}`}
      src={src} alt="" loading="lazy" decoding="async"
      onLoad={() => setState({ src, ok: true })}
      onError={() => { failed.add(src); setState({ src, ok: false }); }}
    />
  );
}
/** Pictures that failed once in this page are not asked again. */
const failed = new Set<string>();

/**
 * A title in large over its art: the backdrop, a scrim from the reading side,
 * the poster and the text. `children` is the text column.
 */
export function Hero({ backdrop, poster, children, href, size = 'large' }: { backdrop?: string; poster?: React.ReactNode; children: React.ReactNode; href?: string; size?: 'large' | 'medium' }) {
  const body = (
    <>
      <Backdrop src={backdrop} />
      <span className="ndw-mx-scrim" aria-hidden="true" />
      <span className="ndw-mx-hero-body">
        {poster}
        <span className="ndw-mx-hero-text">{children}</span>
      </span>
    </>
  );
  return href
    ? <a className={`ndw-mx-hero is-${size}`} href={href} target="_blank" rel="noopener noreferrer">{body}</a>
    : <div className={`ndw-mx-hero is-${size}`}>{body}</div>;
}

/** Progress as a line, 0–100; `tone` only when the state matters (a warning, done). */
export function Track({ value, tone, thin }: { value: number; tone?: 'muted' | 'warn' | 'bad' | 'done'; thin?: boolean }) {
  return (
    <span className={`ndw-mx-track ${thin ? 'is-thin' : ''} ${tone ? `is-${tone}` : ''}`} aria-hidden="true">
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

/** Progress as a ring (a download, a share of healthy indexers). */
export function Ring({ value, size = 34, stroke = 3.5, tone, label }: { value: number; size?: number; stroke?: number; tone?: 'muted' | 'warn' | 'bad' | 'done'; label?: string }) {
  const radius = (36 - stroke) / 2, length = 2 * Math.PI * radius, share = Math.max(0, Math.min(100, value)) / 100;
  return (
    <svg className={`ndw-mx-ring ${tone ? `is-${tone}` : ''}`} width={size} height={size} viewBox="0 0 36 36" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle className="ndw-mx-ring-bg" cx="18" cy="18" r={radius} strokeWidth={stroke} />
      {share > 0 && <circle className="ndw-mx-ring-fg" cx="18" cy="18" r={radius} strokeWidth={stroke} strokeDasharray={`${share * length} ${length}`} transform="rotate(-90 18 18)" />}
    </svg>
  );
}

/** A large figure with its unit and a small label above. */
export function Figure({ label, value, unit, size = 'large', tone }: { label?: React.ReactNode; value: React.ReactNode; unit?: string; size?: 'xl' | 'large' | 'medium'; tone?: 'muted' | 'bad' }) {
  return (
    <span className={`ndw-mx-figure is-${size} ${tone ? `is-${tone}` : ''}`}>
      {label && <span className="ndw-mx-label">{label}</span>}
      <span className="ndw-mx-figure-line"><span className="ndw-mx-figure-value">{value}</span>{unit && <span className="ndw-mx-figure-unit">{unit}</span>}</span>
    </span>
  );
}

/** A smooth filled curve of values (oldest first), scaled to its own maximum; `ghost` a second, dashed line. */
export function AreaChart({ values, ghost, height = 72, muted }: { values: number[]; ghost?: number[]; height?: number; muted?: boolean }) {
  const width = 600;
  if (values.length < 2) return null;
  const max = Math.max(1, ...values, ...(ghost ?? []));
  const points = (list: number[]) => list.map((value, index) => [index / (list.length - 1) * width, height - 2 - value / max * (height - 8)] as const);
  const path = (list: number[]) => points(list).map(([x, y], index, all) => {
    if (!index) return `M${x.toFixed(1)},${y.toFixed(1)}`;
    const [px, py] = all[index - 1], mid = (px + x) / 2;
    return `C${mid.toFixed(1)},${py.toFixed(1)} ${mid.toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const line = path(values);
  return (
    <svg className={`ndw-mx-area ${muted ? 'is-muted' : ''}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      <path className="ndw-mx-area-fill" d={`${line} L${width},${height} L0,${height} Z`} />
      <path className="ndw-mx-area-line" d={line} vectorEffect="non-scaling-stroke" />
      {ghost && ghost.length > 1 && <path className="ndw-mx-area-ghost" d={path(ghost)} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/** Thin bars (activity per hour), the last ones brighter. */
export function Bars({ values, height = 32 }: { values: number[]; height?: number }) {
  const max = Math.max(1, ...values);
  return (
    <span className="ndw-mx-bars" style={{ height }} aria-hidden="true">
      {values.map((value, index) => <span key={index} className={value ? 'is-on' : ''} style={{ height: value ? `${Math.max(12, value / max * 100)}%` : 2 }} />)}
    </span>
  );
}
