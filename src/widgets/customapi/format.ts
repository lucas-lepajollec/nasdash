import type { CustomApiField, CustomApiValue } from '@/lib/widgetData/contracts';

export type Tone = 'ok' | 'warn' | 'crit' | undefined;

/** A number in the answer, also when it came as a numeric string. */
export function numeric(value: CustomApiValue): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

/** A date in the answer: ISO text, or seconds / milliseconds since 1970. */
export function dateOf(value: CustomApiValue): number | undefined {
  const number = numeric(value);
  if (number !== undefined) return number > 1e12 ? number : number > 1e9 ? number * 1000 : undefined;
  if (typeof value === 'string') { const time = Date.parse(value); return Number.isFinite(time) ? time : undefined; }
  return undefined;
}

/** Colour of a value against its thresholds (higher is worse unless `lowIsBad`). */
export function toneOf(field: CustomApiField, value: CustomApiValue): Tone {
  const number = numeric(value);
  if (number === undefined || (field.warn === undefined && field.crit === undefined)) return undefined;
  const worse = (limit: number | undefined) => limit !== undefined && (field.lowIsBad ? number <= limit : number >= limit);
  return worse(field.crit) ? 'crit' : worse(field.warn) ? 'warn' : 'ok';
}

/** Share of a gauge (0–100) on the field's scale, 0–100 by default. */
export function shareOf(field: CustomApiField, value: CustomApiValue): number | undefined {
  const number = numeric(value);
  if (number === undefined) return undefined;
  const min = field.min ?? 0, max = field.max ?? 100;
  if (max <= min) return undefined;
  return Math.min(100, Math.max(0, ((number - min) / (max - min)) * 100));
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
const BIT_UNITS = ['bit/s', 'kbit/s', 'Mbit/s', 'Gbit/s', 'Tbit/s'];

export interface Formatted { text: string; unit?: string }

/**
 * A value as shown: its number (with the field's decimals) and unit apart,
 * so the unit can be set smaller. `relative` gives a time from now.
 */
export function formatValue(field: CustomApiField, value: CustomApiValue, locale: string, relative: (time: number) => string): Formatted {
  if (value === null || value === undefined) return { text: '—' };
  const format = field.format ?? 'auto';
  const number = numeric(value);
  const digits = (fallback: number) => field.decimals ?? fallback;
  const plain = (n: number, fallback = Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits(fallback), minimumFractionDigits: field.decimals ?? 0 }).format(n);
  const scaled = (n: number, base: number, units: string[]) => {
    let index = 0, current = Math.abs(n);
    while (current >= base && index < units.length - 1) { current /= base; index++; }
    return { text: plain(Math.sign(n) * current, current >= 100 ? 0 : 1), unit: units[index] };
  };
  switch (format) {
    case 'text': return { text: String(value), unit: field.unit };
    case 'boolean': return { text: value === true || value === 'true' || number === 1 ? '✓' : '✕' };
    case 'percent':
      if (number === undefined) break;
      // 0–1 ratios become percentages; 0–100 values stay.
      return { text: plain(Math.abs(number) <= 1 && !Number.isInteger(number) ? number * 100 : number, 1), unit: '%' };
    case 'bytes': if (number !== undefined) return scaled(number, 1024, BYTE_UNITS); break;
    case 'bitrate': if (number !== undefined) return scaled(number, 1000, BIT_UNITS); break;
    case 'duration': {
      if (number === undefined) break;
      const seconds = Math.round(Math.abs(number));
      const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
      return { text: d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s` };
    }
    case 'date': {
      const time = dateOf(value);
      if (time === undefined) break;
      return { text: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(time) };
    }
    case 'relative': {
      const time = dateOf(value);
      if (time === undefined) break;
      return { text: relative(time) };
    }
    case 'number': if (number !== undefined) return { text: plain(number), unit: field.unit }; break;
    default:
      if (typeof value === 'boolean') return { text: value ? '✓' : '✕' };
      if (number !== undefined) return { text: plain(number), unit: field.unit };
  }
  return { text: String(value), unit: field.unit };
}
