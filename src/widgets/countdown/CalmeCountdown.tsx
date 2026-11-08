'use client';

import React, { useEffect, useState } from 'react';
import { BookmarkPlus, Pause, Play, RotateCcw, X } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented } from '@/components/modals/settings/shared/CalmeControls';
import { pick, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { CalmeWidget } from '../calme';

const MODES = ['date', 'timer'] as const;
const STYLES = ['standard', 'large', 'animated'] as const;
type Style = typeof STYLES[number];
/** Durations offered at first (seconds): five, fifteen and twenty-five minutes (a pomodoro). */
export const DEFAULT_DURATIONS = [300, 900, 1500];
export const MAX_DURATIONS = 8;
export const DURATION = { min: 10, max: 24 * 3600 } as const;

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
 * A duration typed freely: `25` (minutes), `1:30` (minutes and seconds),
 * `1:05:00`, `90s`, `45m`, `1h`, `1h30`. Between ten seconds and a day.
 */
export function parseDuration(text: string): number | undefined {
  const value = text.trim().toLowerCase().replace(',', '.');
  let seconds: number | undefined;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{1,3}(?:\.\d+)?)$/.exec(value))) seconds = Number(match[1]) * 60;
  else if ((match = /^(\d{1,3}):([0-5]\d)$/.exec(value))) seconds = Number(match[1]) * 60 + Number(match[2]);
  else if ((match = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(value))) seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  else if ((match = /^(\d{1,5})\s*s$/.exec(value))) seconds = Number(match[1]);
  else if ((match = /^(\d{1,4})\s*m(?:in)?$/.exec(value))) seconds = Number(match[1]) * 60;
  else if ((match = /^(\d{1,2})\s*h(?:\s*(\d{1,2}))?$/.exec(value))) seconds = Number(match[1]) * 3600 + Number(match[2] ?? 0) * 60;
  if (seconds === undefined || !Number.isFinite(seconds)) return undefined;
  seconds = Math.round(seconds);
  return seconds >= DURATION.min && seconds <= DURATION.max ? seconds : undefined;
}
/** The widget's durations (seconds); an older list of minutes (`presets`) is read too. */
export function durationsOf(settings: WidgetSettings): number[] {
  const seconds = Array.isArray(settings.durations) ? settings.durations
    : Array.isArray(settings.presets) ? settings.presets.map(value => typeof value === 'number' ? value * 60 : NaN) : [];
  const valid = seconds.filter((value): value is number => typeof value === 'number' && Number.isInteger(value) && value >= DURATION.min && value <= DURATION.max);
  return valid.length ? [...new Set(valid)].slice(0, MAX_DURATIONS) : DEFAULT_DURATIONS;
}
/** `h:mm:ss` from one hour, `mm:ss` below. */
export function clockText(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = seconds % 60;
  return (h ? [h, m, s] : [m, s]).map((value, index) => index === 0 && h ? String(value) : String(value).padStart(2, '0')).join(':');
}

/**
 * A countdown to a date (an event, a renewal, holidays) or a timer: a few
 * durations at hand, any other typed on the spot, and in edit mode durations
 * kept or removed. The timer runs in this browser only and rings when it is
 * over. Three looks: standard, large, and animated (a little tomato walking
 * to its flag as time passes, CSS only and still when paused).
 */
export default function CalmeCountdown({ widgetId, settings, editMode, isVisible, onUpdateSettings }: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  const mode = pick(settings.mode, MODES, 'date');
  const style = pick(settings.style, STYLES, 'standard');
  const title = t('widget.countdown.name');
  return (
    <CalmeWidget title={title} editMode={editMode}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings}>
          {(draft, change) => {
            const draftMode = pick(draft.mode, MODES, 'date');
            const styles = draftMode === 'timer' ? STYLES : STYLES.filter(value => value !== 'animated');
            return (
              <>
                <CalmeRow label={t('widgets.countdown.mode')}>
                  <CalmeSegmented label={t('widgets.countdown.mode')} value={draftMode} options={MODES.map(value => ({ value, label: t(`widgets.countdown.mode.${value}`) }))} onChange={value => change({ mode: value === 'date' ? null : value })} />
                </CalmeRow>
                <CalmeRow label={t('widgets.countdown.style')}>
                  <CalmeSegmented label={t('widgets.countdown.style')} value={pick(draft.style, styles, 'standard')} options={styles.map(value => ({ value, label: t(`widgets.countdown.style.${value}`) }))} onChange={value => change({ style: value === 'standard' ? null : value })} />
                </CalmeRow>
                {draftMode === 'date' ? (
                  <>
                    <CalmeField label={t('widgets.countdown.label')}>
                      <input className="nd-input" value={typeof draft.label === 'string' ? draft.label : ''} maxLength={60} placeholder={t('widgets.countdown.labelPlaceholder')} onChange={event => change({ label: event.target.value || null })} />
                    </CalmeField>
                    <CalmeField label={t('widgets.countdown.date')}>
                      <input className="nd-input" type="datetime-local" value={typeof draft.date === 'string' ? (draft.date.length === 10 ? `${draft.date}T00:00` : draft.date) : ''} onChange={event => change({ date: event.target.value || null })} />
                    </CalmeField>
                  </>
                ) : <p className="ndw-media-sub ndw-countdown-hint">{t('widgets.countdown.durationsHint')}</p>}
              </>
            );
          }}
        </WidgetSettingsButton>
      )}
      {mode === 'date'
        ? <DateCountdown settings={settings} isVisible={isVisible} large={style !== 'standard'} />
        : <Timer widgetId={widgetId} settings={settings} style={style} editMode={editMode} isVisible={isVisible} onUpdateSettings={onUpdateSettings} />}
    </CalmeWidget>
  );
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

function DateCountdown({ settings, isVisible, large }: { settings: WidgetSettings; isVisible: boolean; large: boolean }) {
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
    <div className={`ndw-countdown ${large ? 'is-large' : ''}`}>
      {label && <span className="ndw-countdown-label">{label}</span>}
      <span className="ndw-countdown-big">
        {Math.abs(left) < 60_000 ? t('widgets.countdown.now') : <>{new Intl.NumberFormat(locale).format(big.value)}<small>{big.unit}</small></>}
      </span>
      <span className="ndw-media-sub">{Math.abs(left) < 60_000 ? when : t(left > 0 ? 'widgets.countdown.until' : 'widgets.countdown.since', { date: when })}</span>
    </div>
  );
}

/** Kept in this browser: `{ endsAt }` while it runs, `{ left }` when paused (ms), with its whole duration (s). */
interface TimerState { seconds: number; endsAt?: number; left?: number }
const timerKey = (widgetId: string) => `nd-timer-${widgetId}`;
function readTimer(widgetId: string): TimerState | null {
  try {
    const value = JSON.parse(localStorage.getItem(timerKey(widgetId)) ?? 'null') as (TimerState & { minutes?: number }) | null;
    if (!value) return null;
    // Saved by the first version of the widget, in minutes.
    const seconds = typeof value.seconds === 'number' ? value.seconds : typeof value.minutes === 'number' ? value.minutes * 60 : NaN;
    return Number.isFinite(seconds) && seconds > 0 ? { seconds, ...(value.endsAt ? { endsAt: value.endsAt } : {}), ...(value.left !== undefined ? { left: value.left } : {}) } : null;
  } catch { return null; }
}
function writeTimer(widgetId: string, state: TimerState | null) {
  try { if (state) localStorage.setItem(timerKey(widgetId), JSON.stringify(state)); else localStorage.removeItem(timerKey(widgetId)); } catch { /* private mode */ }
}
/** A running timer with `left` ms to go from now. */
const runFrom = (seconds: number, left: number): TimerState => ({ seconds, endsAt: Date.now() + left });
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

function Timer({ widgetId, settings, style, editMode, isVisible, onUpdateSettings }: { widgetId: string; settings: WidgetSettings; style: Style; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  const durations = durationsOf(settings);
  const [state, setState] = useState<TimerState | null>(null);
  const [custom, setCustom] = useState('');
  useEffect(() => { setState(readTimer(widgetId)); }, [widgetId]);
  const running = state?.endsAt !== undefined;
  // It keeps counting off screen: ringing does not depend on being visible.
  const [now, syncNow] = useNow(running ? 250 : 60_000, running || isVisible);
  const total = (state?.seconds ?? 0) * 1000;
  // `now` may be a step behind a timer just started: never more than its duration.
  const remaining = !state ? 0 : running ? Math.min(total, Math.max(0, state.endsAt! - now)) : state.left ?? total;
  const done = running && remaining === 0;
  useEffect(() => {
    if (!done) return;
    ring();
    const finished = { seconds: state!.seconds, left: 0 };
    writeTimer(widgetId, finished);
    setState(finished);
  }, [done, state, widgetId]);
  // The clock is brought up to date with the state: a resumed timer never shows the seconds of a stale clock.
  const set = (next: TimerState | null) => { writeTimer(widgetId, next); setState(next); syncNow(); };
  const over = !!state && !running && state.left === 0;
  const clock = state ? clockText(Math.ceil(remaining / 1000)) : clockText(durations[0]);
  const progress = total ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0;
  const typed = parseDuration(custom);
  const durationLabel = (seconds: number) => seconds % 60 ? clockText(seconds) : seconds >= 3600 && seconds % 3600 === 0 ? t('widgets.countdown.hoursShort', { count: seconds / 3600 }) : t('widgets.countdown.minutes', { count: seconds / 60 });
  const save = (next: number[]) => onUpdateSettings({ durations: next, presets: null });

  return (
    <div className={`ndw-countdown is-timer ${style === 'large' ? 'is-large' : ''}`}>
      {style === 'animated' && <Walker progress={progress} running={running && isVisible} over={over} />}
      <span className={`ndw-countdown-big is-clock ${over ? 'is-over' : ''}`} role="timer" aria-live="off">{clock}</span>
      {over && <span className="ndw-media-sub" role="status">{t('widgets.countdown.over')}</span>}
      <span className="ndw-timer-actions" data-no-widget-drag>
        {state && !over && (
          <button type="button" className="ndc-icon-button" onClick={() => set(running ? { seconds: state.seconds, left: remaining } : runFrom(state.seconds, remaining))}
            aria-label={t(running ? 'widgets.countdown.pause' : 'widgets.countdown.resume')} title={t(running ? 'widgets.countdown.pause' : 'widgets.countdown.resume')}>
            {running ? <Pause size={12} /> : <Play size={12} />}
          </button>
        )}
        {state && (
          <button type="button" className="ndc-icon-button" onClick={() => set(null)} aria-label={t('widgets.countdown.reset')} title={t('widgets.countdown.reset')}>
            <RotateCcw size={12} />
          </button>
        )}
        {durations.map(seconds => (
          <span key={seconds} className={`ndw-chip-group ${state?.seconds === seconds && !over ? 'is-on' : ''}`}>
            <button type="button" className="ndw-chip" onClick={() => set(runFrom(seconds, seconds * 1000))} aria-label={t('widgets.countdown.startFor', { duration: durationLabel(seconds) })}>
              {durationLabel(seconds)}
            </button>
            {editMode && durations.length > 1 && (
              <button type="button" className="ndw-chip-remove" onClick={() => save(durations.filter(value => value !== seconds))} aria-label={t('widgets.countdown.removeDuration', { duration: durationLabel(seconds) })} title={t('widgets.countdown.removeDuration', { duration: durationLabel(seconds) })}>
                <X size={10} />
              </button>
            )}
          </span>
        ))}
      </span>
      {/* Any other duration, typed on the spot; kept with the widget from edit mode. */}
      <form className="ndw-timer-custom" data-no-widget-drag onSubmit={event => { event.preventDefault(); if (typed) { set(runFrom(typed, typed * 1000)); setCustom(''); } }}>
        <input value={custom} maxLength={9} inputMode="text" placeholder={t('widgets.countdown.customPlaceholder')} aria-label={t('widgets.countdown.custom')} aria-invalid={custom.trim() !== '' && !typed} onChange={event => setCustom(event.target.value)} />
        <button type="submit" className="ndc-icon-button" disabled={!typed} aria-label={t('widgets.countdown.startCustom')} title={t('widgets.countdown.startCustom')}><Play size={12} /></button>
        {editMode && (
          <button type="button" className="ndc-icon-button" disabled={!typed || durations.includes(typed) || durations.length >= MAX_DURATIONS}
            onClick={() => { if (typed) { save([...durations, typed].sort((a, b) => a - b)); setCustom(''); } }}
            aria-label={t('widgets.countdown.saveDuration')} title={t('widgets.countdown.saveDuration')}>
            <BookmarkPlus size={12} />
          </button>
        )}
      </form>
    </div>
  );
}

/**
 * A little tomato walking along the track to its flag as time passes: its
 * place follows the progress, its steps are a CSS animation that stops when
 * the timer is paused, hidden or the system asks for less motion. At the
 * flag it hops once.
 */
function Walker({ progress, running, over }: { progress: number; running: boolean; over: boolean }) {
  return (
    <span className={`ndw-walker ${running ? 'is-running' : ''} ${over ? 'is-over' : ''}`} aria-hidden="true">
      <span className="ndw-walker-track"><span className="ndw-walker-done" style={{ transform: `scaleX(${progress})` }} /></span>
      <svg className="ndw-walker-flag" viewBox="0 0 12 16" width="12" height="16"><path d="M2 15V1" /><path d="M2 2h8l-2 3 2 3H2z" /></svg>
      <span className="ndw-walker-runner" style={{ left: `${progress * 100}%` }}>
        <svg viewBox="0 0 24 28" width="24" height="28">
          <g className="ndw-walker-body">
            <path className="ndw-walker-leaf" d="M12 5c-1.6-2.6-4-2.8-5-2 1.4.4 2.4 1.2 3 2.4M12 5c1.2-2.4 3.6-3 5-2.2-1.6.3-2.8 1.2-3.5 2.4" />
            <ellipse className="ndw-walker-tomato" cx="12" cy="12.5" rx="7.5" ry="7" />
            <circle className="ndw-walker-eye" cx="9.6" cy="11.6" r="0.9" />
            <circle className="ndw-walker-eye" cx="14.4" cy="11.6" r="0.9" />
            <path className="ndw-walker-mouth" d="M10.4 14.6q1.6 1.2 3.2 0" />
          </g>
          <path className="ndw-walker-leg is-left" d="M10 19v5" />
          <path className="ndw-walker-leg is-right" d="M14 19v5" />
        </svg>
      </span>
    </span>
  );
}
