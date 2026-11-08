'use client';

import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented } from '@/components/modals/settings/shared/CalmeControls';
import { pick, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { CalmeWidget } from '../calme';

const MODES = ['date', 'timer'] as const;
export const TIMER_PRESETS = [1, 3, 5, 10, 15, 25, 30, 45, 60] as const;
const DEFAULT_PRESETS = [5, 15, 25];

/** The date and time to count to (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`, local time). */
export function countdownTarget(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value)) return undefined;
  const time = new Date(value.length === 10 ? `${value}T00:00` : value).getTime();
  return Number.isFinite(time) ? time : undefined;
}
/** Whole days, then hours and minutes, of a duration (ms). */
export function parts(ms: number) {
  const minutes = Math.floor(Math.abs(ms) / 60_000);
  return { days: Math.floor(minutes / 1440), hours: Math.floor(minutes / 60) % 24, minutes: minutes % 60 };
}

/**
 * A countdown to a date (an event, a renewal, holidays) or a kitchen-style
 * timer. The timer runs in this browser only and rings when it is over.
 */
export default function CalmeCountdown({ widgetId, settings, editMode, isVisible, onUpdateSettings }: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  const mode = pick(settings.mode, MODES, 'date');
  const title = t('widget.countdown.name');
  return (
    <CalmeWidget title={title} editMode={editMode}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings}>
          {(draft, change) => (
            <>
              <CalmeRow label={t('widgets.countdown.mode')}>
                <CalmeSegmented label={t('widgets.countdown.mode')} value={pick(draft.mode, MODES, 'date')} options={MODES.map(value => ({ value, label: t(`widgets.countdown.mode.${value}`) }))} onChange={value => change({ mode: value === 'date' ? null : value })} />
              </CalmeRow>
              {pick(draft.mode, MODES, 'date') === 'date' ? (
                <>
                  <CalmeField label={t('widgets.countdown.label')}>
                    <input className="nd-input" value={typeof draft.label === 'string' ? draft.label : ''} maxLength={60} placeholder={t('widgets.countdown.labelPlaceholder')} onChange={event => change({ label: event.target.value || null })} />
                  </CalmeField>
                  <CalmeField label={t('widgets.countdown.date')}>
                    <input className="nd-input" type="datetime-local" value={typeof draft.date === 'string' ? (draft.date.length === 10 ? `${draft.date}T00:00` : draft.date) : ''} onChange={event => change({ date: event.target.value || null })} />
                  </CalmeField>
                </>
              ) : (
                <CalmeField label={t('widgets.countdown.presets')}>
                  <span className="ndw-timer-presets">
                    {TIMER_PRESETS.map(minutes => {
                      const chosen = presetsOf(draft).includes(minutes);
                      return (
                        <button key={minutes} type="button" className={`ndw-chip ${chosen ? 'is-on' : ''}`} aria-pressed={chosen}
                          onClick={() => { const next = chosen ? presetsOf(draft).filter(value => value !== minutes) : [...presetsOf(draft), minutes].sort((a, b) => a - b); if (next.length) change({ presets: next }); }}>
                          {t('widgets.countdown.minutes', { count: minutes })}
                        </button>
                      );
                    })}
                  </span>
                </CalmeField>
              )}
            </>
          )}
        </WidgetSettingsButton>
      )}
      {mode === 'date' ? <DateCountdown settings={settings} isVisible={isVisible} /> : <Timer widgetId={widgetId} presets={presetsOf(settings)} isVisible={isVisible} />}
    </CalmeWidget>
  );
}

function presetsOf(settings: WidgetSettings): number[] {
  const list = Array.isArray(settings.presets) ? settings.presets.filter((value): value is number => (TIMER_PRESETS as readonly number[]).includes(value as number)) : [];
  return list.length ? [...new Set(list)].slice(0, 6) : DEFAULT_PRESETS;
}

/** The time, refreshed every `stepMs` while active; `sync` brings it up to date at once (after a start or a resume). */
function useNow(stepMs: number, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), stepMs);
    return () => window.clearInterval(timer);
  }, [stepMs, active]);
  return [now, () => setNow(Date.now())] as const;
}

function DateCountdown({ settings, isVisible }: { settings: WidgetSettings; isVisible: boolean }) {
  const { t, locale } = useI18n();
  const target = countdownTarget(settings.date);
  const [now] = useNow(30_000, isVisible && target !== undefined);
  if (target === undefined) return <p className="ndw-media-sub is-quiet">{t('widgets.countdown.noDate')}</p>;
  const left = target - now, { days, hours, minutes } = parts(left);
  const label = typeof settings.label === 'string' && settings.label.trim() ? settings.label.trim() : '';
  const hasTime = typeof settings.date === 'string' && settings.date.length > 10 && !settings.date.endsWith('T00:00');
  const when = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', ...(hasTime ? { timeStyle: 'short' } : {}) }).format(target);
  const big = days > 0 ? { value: days, unit: t(days === 1 ? 'widgets.countdown.day' : 'widgets.countdown.days') }
    : hours > 0 ? { value: hours, unit: t(hours === 1 ? 'widgets.countdown.hour' : 'widgets.countdown.hours') }
      : { value: minutes, unit: t(minutes === 1 ? 'widgets.countdown.minute' : 'widgets.countdown.minuteUnits') };
  return (
    <div className="ndw-countdown">
      {label && <span className="ndw-countdown-label">{label}</span>}
      <span className="ndw-countdown-big">
        {Math.abs(left) < 60_000 ? t('widgets.countdown.now') : <>{new Intl.NumberFormat(locale).format(big.value)}<small>{big.unit}</small></>}
      </span>
      <span className="ndw-media-sub">{Math.abs(left) < 60_000 ? when : t(left > 0 ? 'widgets.countdown.until' : 'widgets.countdown.since', { date: when })}</span>
    </div>
  );
}

/** Kept in this browser: `{ endsAt }` while it runs, `{ left }` when paused. */
interface TimerState { minutes: number; endsAt?: number; left?: number }
const timerKey = (widgetId: string) => `nd-timer-${widgetId}`;
/** A running timer with `left` ms to go from now. */
const runFrom = (minutes: number, left: number): TimerState => ({ minutes, endsAt: Date.now() + left });
function readTimer(widgetId: string): TimerState | null {
  try { const value = JSON.parse(localStorage.getItem(timerKey(widgetId)) ?? 'null') as TimerState | null; return value && typeof value.minutes === 'number' ? value : null; } catch { return null; }
}
function writeTimer(widgetId: string, state: TimerState | null) {
  try { if (state) localStorage.setItem(timerKey(widgetId), JSON.stringify(state)); else localStorage.removeItem(timerKey(widgetId)); } catch { /* private mode */ }
}
/** Three soft notes, made on the spot: no sound file. */
function ring() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    [0, 0.35, 0.7].forEach((delay, index) => {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.frequency.value = [880, 988, 1175][index];
      gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.3);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + 0.32);
    });
    window.setTimeout(() => void context.close(), 1500);
    navigator.vibrate?.([120, 80, 120]);
  } catch { /* no sound available */ }
}

function Timer({ widgetId, presets, isVisible }: { widgetId: string; presets: number[]; isVisible: boolean }) {
  const { t } = useI18n();
  const [state, setState] = useState<TimerState | null>(null);
  useEffect(() => { setState(readTimer(widgetId)); }, [widgetId]);
  const running = state?.endsAt !== undefined;
  // It keeps counting off screen: ringing does not depend on being visible.
  const [now, syncNow] = useNow(running ? 250 : 60_000, running || isVisible);
  // `now` may be a step behind a timer just started: never more than its duration.
  const remaining = !state ? 0 : running ? Math.min(state.minutes * 60_000, Math.max(0, state.endsAt! - now)) : state.left ?? state.minutes * 60_000;
  const done = running && remaining === 0;
  useEffect(() => {
    if (!done) return;
    ring();
    const finished = { minutes: state!.minutes, left: 0 };
    writeTimer(widgetId, finished);
    setState(finished);
  }, [done, state, widgetId]);
  // The clock is brought up to date with the state: a resumed timer never shows the seconds of a stale clock.
  const set = (next: TimerState | null) => { writeTimer(widgetId, next); setState(next); syncNow(); };
  const total = Math.ceil(remaining / 1000);
  const clock = [Math.floor(total / 60), total % 60].map(value => String(value).padStart(2, '0')).join(':');
  const over = !!state && !running && state.left === 0;
  return (
    <div className="ndw-countdown">
      <span className={`ndw-countdown-big is-clock ${over ? 'is-over' : ''}`} role="timer" aria-live="off">
        {state ? clock : '00:00'}
      </span>
      {over && <span className="ndw-media-sub" role="status">{t('widgets.countdown.over')}</span>}
      <span className="ndw-timer-actions" data-no-widget-drag>
        {state && !over && (
          <button type="button" className="ndc-icon-button" onClick={() => set(running ? { minutes: state.minutes, left: remaining } : runFrom(state.minutes, remaining))}
            aria-label={t(running ? 'widgets.countdown.pause' : 'widgets.countdown.resume')} title={t(running ? 'widgets.countdown.pause' : 'widgets.countdown.resume')}>
            {running ? <Pause size={12} /> : <Play size={12} />}
          </button>
        )}
        {state && (
          <button type="button" className="ndc-icon-button" onClick={() => set(null)} aria-label={t('widgets.countdown.reset')} title={t('widgets.countdown.reset')}>
            <RotateCcw size={12} />
          </button>
        )}
        {presets.map(minutes => (
          <button key={minutes} type="button" className={`ndw-chip ${state?.minutes === minutes && !over ? 'is-on' : ''}`} onClick={() => set(runFrom(minutes, minutes * 60_000))} aria-label={t('widgets.countdown.start', { count: minutes })}>
            {t('widgets.countdown.minutes', { count: minutes })}
          </button>
        ))}
      </span>
    </div>
  );
}
