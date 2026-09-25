'use client';

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

/**
 * Small building blocks of the Calme settings: a section heading, a row
 * (label and hint on the left, control on the right, hairline above), a
 * segmented choice and a slider with its value. Styles in design-calme.css.
 */

export function CalmeHeading({ children, action, info }: { children: React.ReactNode; action?: React.ReactNode; info?: string }) {
  return (
    <div className="ndc-set-heading">
      <h3>{children}{info && <CalmeInfo text={info} />}</h3>
      {action}
    </div>
  );
}

/**
 * A small ⓘ that shows its text on hover or focus, instead of a line of
 * explanation. The bubble is drawn above everything (portal, fixed position)
 * so no scroll area or dialog edge can cut it, and stays inside the window.
 */
export function CalmeInfo({ text }: { text: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; below: boolean } | null>(null);
  const show = () => {
    const box = anchor.current?.getBoundingClientRect();
    if (!box) return;
    const width = Math.min(260, window.innerWidth - 16);
    const left = Math.min(Math.max(8, box.left + box.width / 2 - width / 2), window.innerWidth - width - 8);
    const below = box.top < 90;
    setPlace({ left, top: below ? box.bottom + 8 : box.top - 8, below });
  };
  const hide = () => setPlace(null);
  return (
    <span ref={anchor} className="ndc-info" tabIndex={0} role="img" aria-label={text} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <Info size={13} aria-hidden="true" />
      {place && typeof document !== 'undefined' && createPortal(
        <span
          className={`ndc-info-bubble ${place.below ? 'is-below' : ''}`}
          aria-hidden="true"
          style={{ left: place.left, top: place.top, maxWidth: Math.min(260, window.innerWidth - 16) }}
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}

/**
 * One setting: its name (with an optional ⓘ explaining it) on the left, the
 * control on the right. `value` is a short current state shown under the name.
 */
export function CalmeRow({ label, info, value, children, stacked }: { label: React.ReactNode; info?: string; value?: React.ReactNode; children?: React.ReactNode; stacked?: boolean }) {
  return (
    <div className={`ndc-set-row ${stacked ? 'ndc-set-row--stacked' : ''}`}>
      <div className="ndc-set-row-text">
        <div className="ndc-set-row-label">{label}{info && <CalmeInfo text={info} />}</div>
        {value && <div className="ndc-set-row-hint">{value}</div>}
      </div>
      {children !== undefined && <div className="ndc-set-row-control">{children}</div>}
    </div>
  );
}

export function CalmeSegmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: Array<{ value: T; label: React.ReactNode }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="ndc-seg" role="radiogroup" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={option.value === value ? 'is-on' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function CalmeSlider({ value, min, max, step, onChange, onCommit, format, label }: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  format: (value: number) => string;
  label: string;
}) {
  return (
    <div className="ndc-slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={event => onChange(Number(event.target.value))}
        onPointerUp={event => onCommit(Number((event.target as HTMLInputElement).value))}
        onKeyUp={event => onCommit(Number((event.target as HTMLInputElement).value))}
        style={{ '--ndc-fill': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
      />
      <span className="ndc-slider-value">{format(value)}</span>
    </div>
  );
}

/** A bare switch, for the control side of a CalmeRow. */
export function CalmeSwitch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="ndc-switch-button" onClick={() => onChange(!checked)}>
      <span className={`ndc-switch ${checked ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
    </button>
  );
}

export interface CalmeOrderItem {
  id: string;
  label: React.ReactNode;
  /** Short state under the name (zone, "hidden"…). */
  sub?: React.ReactNode;
  enabled?: boolean;
  onToggle?: (value: boolean) => void;
  /** Extra control shown before the switch (an icon picker…). */
  extra?: React.ReactNode;
  /** Kept in place: no arrows. */
  fixed?: boolean;
}

/**
 * An ordered list with arrows to move each item and an optional switch: the
 * header elements, the mobile header, the tabs of the dock.
 */
export function CalmeOrderList({ items, onMove, moveUpLabel, moveDownLabel }: {
  items: CalmeOrderItem[];
  onMove: (index: number, direction: -1 | 1) => void;
  moveUpLabel: string;
  moveDownLabel: string;
}) {
  return (
    <ol className="ndc-order">
      {items.map((item, index) => (
        <li key={item.id} className={`ndc-order-item ${item.enabled === false ? 'is-off' : ''}`}>
          <span className="ndc-order-index">{index + 1}</span>
          <span className="ndc-order-text">
            <span className="ndc-order-label">{item.label}</span>
            {item.sub && <span className="ndc-order-sub">{item.sub}</span>}
          </span>
          {item.extra}
          {!item.fixed && (
            <span className="ndc-order-moves">
              <button type="button" className="ndc-icon-button" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={moveUpLabel} title={moveUpLabel}>
                <ChevronUp size={14} />
              </button>
              <button type="button" className="ndc-icon-button" disabled={index === items.length - 1} onClick={() => onMove(index, 1)} aria-label={moveDownLabel} title={moveDownLabel}>
                <ChevronDown size={14} />
              </button>
            </span>
          )}
          {item.onToggle && <CalmeSwitch label={String(typeof item.label === 'string' ? item.label : item.id)} checked={item.enabled !== false} onChange={item.onToggle} />}
        </li>
      ))}
    </ol>
  );
}
