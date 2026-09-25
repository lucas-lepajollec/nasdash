import type { UiLanguage } from '@/i18n/messages';

/**
 * Numbers of the device widgets, per language: `23 %`, `2,4 Mo/s`, `46 °C`,
 * `12 j 4 h`. French keeps its comma and spaced units; the others use a point.
 */

type Translate = (key: string, variables?: Record<string, string | number>) => string;

export function decimal(value: number, digits: number, language: UiLanguage) {
  const text = value.toFixed(digits);
  return language === 'en' ? text : text.replace('.', ',');
}

export function percentText(value: number | undefined, language: UiLanguage) {
  if (value === undefined || !Number.isFinite(value)) return '–';
  return language === 'en' ? `${Math.round(value)}%` : `${Math.round(value)} %`;
}

export function temperatureText(value: number | undefined) {
  return value === undefined || !Number.isFinite(value) ? '–' : `${Math.round(value)} °C`;
}

const RATE_UNITS: Record<'fr' | 'other', string[]> = { fr: ['o/s', 'Ko/s', 'Mo/s', 'Go/s'], other: ['B/s', 'KB/s', 'MB/s', 'GB/s'] };

/** `830 Ko/s`, `2,4 Mo/s` (split so the unit can be drawn smaller). */
export function rateParts(bytesPerSecond: number | undefined, language: UiLanguage): { value: string; unit: string } {
  const units = RATE_UNITS[language === 'fr' ? 'fr' : 'other'];
  if (bytesPerSecond === undefined || !Number.isFinite(bytesPerSecond)) return { value: '–', unit: '' };
  let value = Math.max(0, bytesPerSecond);
  let index = 0;
  while (value >= 1000 && index < units.length - 1) { value /= 1024; index += 1; }
  return { value: value < 10 && index > 0 ? decimal(value, 1, language) : String(Math.round(value)), unit: units[index] };
}

export function rateText(bytesPerSecond: number | undefined, language: UiLanguage) {
  const { value, unit } = rateParts(bytesPerSecond, language);
  return unit ? `${value} ${unit}` : value;
}

/** `12 j 4 h`, `3 h 12 min`, `8 min`. */
export function uptimeText(seconds: number | undefined, t: Translate) {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return t('devices.calme.uptimeDays', { days, hours });
  if (hours > 0) return t('devices.calme.uptimeHours', { hours, minutes });
  return t('devices.calme.uptimeMinutes', { minutes: Math.max(1, minutes) });
}

export function loadText(load: number[] | undefined, language: UiLanguage) {
  return load?.length ? decimal(load[0], 2, language) : '–';
}

/** Hour of a chart point: with seconds over the last hour, without over 24 h. */
export function timeText(time: number, locale: string, withSeconds: boolean) {
  return new Date(time).toLocaleTimeString(locale, withSeconds ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : { hour: '2-digit', minute: '2-digit' });
}
