import type { Metric, MetricKind } from '@/integrations/types';
import type { UiLanguage } from '@/i18n/messages';
import type { DeviceStat } from '@/lib/types';

/**
 * What the devices widget displays for one measurement, built from the
 * integration's numeric `Metric` (formatted here, per language) or, for
 * devices without an integration, from their hand-written `DeviceStat`.
 */
export interface DeviceReading {
  /**
   * Stable identity, used by the "visible stats" selection saved in widget
   * settings. It keeps the historical label (`CPU`, `RAM`, `Disque (data)`,
   * GPU name) so existing selections still match.
   */
  id: string;
  kind: MetricKind | 'other';
  /** Short name shown on the card (disk or GPU name, CPU, RAM). */
  name: string;
  percent?: number;
  temperatureC?: number;
  /** Capacity text without parentheses, already localised (`16 Go`, `5.6 GB / 16 GB`). */
  capacity: string;
  /** Colour hint of hand-written stats (`var(--nd-green)`…). */
  colorHint?: string;
}

const GIB = 1024 ** 3;

/** Historical label of a metric: the selection identity (see `DeviceReading.id`). */
export function metricLabel(metric: Metric): string {
  switch (metric.kind) {
    case 'cpu': return 'CPU';
    case 'memory': return 'RAM';
    case 'disk': return `Disque (${metric.name ?? ''})`;
    case 'gpu': return metric.name || 'GPU';
  }
}

/** `16 Go`, `5,6 Go`, `1,8 To` in French; `16 GB`, `5.6 GB`, `1.8 TB` otherwise (one decimal below 10 GB). */
export function formatBytes(bytes: number, language: UiLanguage): string {
  const gb = bytes / GIB;
  const french = language === 'fr';
  const [amount, unit] = gb >= 1000
    ? [(gb / 1000).toFixed(1), french ? 'To' : 'TB']
    : [gb < 10 && !Number.isInteger(Math.round(gb * 10) / 10) ? gb.toFixed(1) : gb.toFixed(0), french ? 'Go' : 'GB'];
  return `${french ? amount.replace('.', ',') : amount} ${unit}`;
}

export function readingFromMetric(metric: Metric, language: UiLanguage): DeviceReading {
  const capacity = metric.totalBytes
    ? metric.usedBytes !== undefined
      ? `${formatBytes(metric.usedBytes, language)} / ${formatBytes(metric.totalBytes, language)}`
      : formatBytes(metric.totalBytes, language)
    : '';
  return {
    id: metricLabel(metric),
    kind: metric.kind,
    name: metric.kind === 'disk' || metric.kind === 'gpu' ? metric.name || metricLabel(metric) : metricLabel(metric),
    percent: Math.min(100, Math.max(0, metric.percent)),
    ...(metric.temperatureC !== undefined ? { temperatureC: metric.temperatureC } : {}),
    capacity,
  };
}

/** Hand-written stats: `"42% (210 Go / 500 Go)"`, `"61°C"`… parsed once here. */
export function readingFromStat(stat: DeviceStat, language: UiLanguage): DeviceReading {
  const value = stat.value ?? '';
  const percentMatch = value.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const percent = stat.percent ?? (percentMatch ? Number.parseFloat(percentMatch[1].replace(',', '.')) : undefined);
  const tempMatch = value.match(/(\d+)\s*°[Cc]/);
  const capacityMatch = value.match(/\(([^)]+)\)/)?.[1] ?? value.match(/(\d+(?:[.,]\d+)?\s*(?:Go|To|GB|TB|Mo|MB|octets|Bytes))/i)?.[1] ?? '';
  const isDisk = /^(disque|disk)/i.test(stat.label);
  const name = isDisk ? (stat.label.match(/\(([^)]+)\)/)?.[1] || stat.label.replace(/disque|disk/i, '').trim()) : stat.label;
  return {
    id: stat.label,
    kind: isDisk ? 'disk' : 'other',
    name,
    ...(percent !== undefined ? { percent: Math.min(100, Math.max(0, percent)) } : {}),
    ...(tempMatch ? { temperatureC: Number(tempMatch[1]) } : {}),
    capacity: localizeUnits(capacityMatch.trim(), language),
    ...(stat.color ? { colorHint: stat.color } : {}),
  };
}

/** The route answers with metrics (integrations) or hand-written stats (other devices). */
export function toReadings(items: readonly (Metric | DeviceStat)[], language: UiLanguage): DeviceReading[] {
  return items.map(item => 'key' in item ? readingFromMetric(item, language) : readingFromStat(item, language));
}

function localizeUnits(capacity: string, language: UiLanguage): string {
  if (!capacity || language === 'fr') return capacity;
  return capacity
    .replace(/\bTo\b/g, 'TB')
    .replace(/\bGo\b/g, 'GB')
    .replace(/\bMo\b/g, 'MB')
    .replace(/\boctets\b/gi, language === 'en' ? 'bytes' : 'Bytes');
}

/** Percent text of the cards: whole number, truncated like before (`12.9` → `12%`). */
export function percentText(reading: DeviceReading): string {
  return reading.percent !== undefined ? `${Math.trunc(reading.percent)}%` : '';
}

export function temperatureText(reading: DeviceReading): string {
  return reading.temperatureC !== undefined ? `${Math.round(reading.temperatureC)}°C` : '';
}
