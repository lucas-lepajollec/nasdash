import type { UiLanguage } from '@/i18n/messages';
import { formatBytes } from '@/components/widgets/deviceReadings';
import { seriesPoints, type DeviceSnapshot } from './deviceData';
import { decimal, percentText, rateText, temperatureText } from './format';
import type { MetricId } from './look';
import type { Metric } from '@/integrations/types';

type Translate = (key: string, variables?: Record<string, string | number>) => string;

/** One measure of one machine, ready to draw in any display. */
export interface Reading {
  metric: MetricId;
  /** Stable key (a disk or a GPU has several). */
  key: string;
  label: string;
  value?: number;
  /** Text of the value (`23 %`, `46 °C`, `↓ 2,4 Mo/s`). */
  text: string;
  /** Second line (capacity, free space, core count, send rate). */
  detail?: string;
  points: [number, number][];
  /** Network: the send side, drawn as a second line. */
  second?: { label: string; points: [number, number][] };
  /** Load: the core count the load is read against. */
  cores?: number;
  /** The integration's measure behind it (sizes, temperature). */
  source?: Metric;
}

export function metricText(metric: MetricId, value: number | undefined, language: UiLanguage): string {
  switch (metric) {
    case 'temperature': return temperatureText(value);
    case 'load': return value === undefined ? '–' : decimal(value, 2, language);
    case 'network': return rateText(value, language);
    default: return percentText(value, language);
  }
}

/** Readings of a measure for a machine (several for disks and GPUs, none when unreported). */
export function readingsOf(snapshot: DeviceSnapshot | undefined, metric: MetricId, t: Translate, language: UiLanguage): Reading[] {
  if (!snapshot) return [];
  const metrics = snapshot.metrics;
  const cpu = metrics.find(item => item.kind === 'cpu');
  const vitals = snapshot.vitals;
  switch (metric) {
    case 'cpu':
      return cpu ? [{ metric, key: cpu.key, label: 'CPU', value: cpu.percent, text: percentText(cpu.percent, language), points: seriesPoints(snapshot, cpu.key), source: cpu }] : [];
    case 'memory': {
      const memory = metrics.find(item => item.kind === 'memory');
      if (!memory) return [];
      const detail = memory.totalBytes ? [memory.usedBytes !== undefined ? formatBytes(memory.usedBytes, language) : '', formatBytes(memory.totalBytes, language)].filter(Boolean).join(' / ') : undefined;
      return [{ metric, key: memory.key, label: 'RAM', value: memory.percent, text: percentText(memory.percent, language), detail, points: seriesPoints(snapshot, memory.key), source: memory }];
    }
    case 'gpu':
      return metrics.filter(item => item.kind === 'gpu').map((gpu, index, all) => ({
        metric, key: gpu.key, label: all.length > 1 ? gpu.name || 'GPU' : 'GPU', value: gpu.percent, text: percentText(gpu.percent, language),
        detail: all.length > 1 ? undefined : gpu.name, points: seriesPoints(snapshot, gpu.key), source: gpu,
      }));
    case 'temperature': {
      // The hottest part, and its history.
      const hot = [cpu, ...metrics.filter(item => item.kind === 'gpu')].filter(item => item?.temperatureC !== undefined).sort((a, b) => (b!.temperatureC ?? 0) - (a!.temperatureC ?? 0))[0];
      if (!hot) return [];
      return [{ metric, key: `${hot.key}@temp`, label: t('devices.calme.tempShort'), value: hot.temperatureC, text: temperatureText(hot.temperatureC), detail: hot.kind === 'gpu' ? hot.name || 'GPU' : 'CPU', points: seriesPoints(snapshot, `${hot.key}@temp`) }];
    }
    case 'load':
      return vitals.load?.length ? [{
        metric, key: 'load.1', label: t('devices.calme.load'), value: vitals.load[0], text: decimal(vitals.load[0], 2, language),
        detail: vitals.cores ? t('devices.calme.ofCores', { cores: vitals.cores }) : undefined, points: seriesPoints(snapshot, 'load.1'), cores: vitals.cores,
      }] : [];
    case 'network': {
      if (vitals.netRxBps !== undefined) {
        return [{
          metric, key: 'net.rx', label: t('devices.calme.network'), value: vitals.netRxBps, text: ['↓', rateText(vitals.netRxBps, language)].join(' '),
          detail: vitals.netTxBps !== undefined ? ['↑', rateText(vitals.netTxBps, language)].join(' ') : undefined,
          points: seriesPoints(snapshot, 'net.rx'), second: { label: t('devices.calme.sent'), points: seriesPoints(snapshot, 'net.tx') },
        }];
      }
      return vitals.netTotalBps !== undefined ? [{ metric, key: 'net.total', label: t('devices.calme.network'), value: vitals.netTotalBps, text: rateText(vitals.netTotalBps, language), points: seriesPoints(snapshot, 'net.total') }] : [];
    }
    case 'disk':
      return metrics.filter(item => item.kind === 'disk').map(disk => {
        const used = disk.usedBytes ?? (disk.totalBytes ? (disk.totalBytes * disk.percent) / 100 : undefined);
        const free = disk.totalBytes !== undefined && used !== undefined ? disk.totalBytes - used : undefined;
        return {
          metric, key: disk.key, label: disk.name || t('devices.calme.disk'), value: disk.percent, text: percentText(disk.percent, language),
          detail: free !== undefined ? t('devices.calme.free', { size: formatBytes(free, language) }) : undefined, points: seriesPoints(snapshot, disk.key), source: disk,
        };
      });
    case 'history':
      return [];
  }
}

/**
 * The figures a one-measure widget shows for a machine, from its options:
 * how RAM and disks are written, and the extra figures (CPU temperature and
 * load, GPU temperature and video memory, upload, load averages, cores, the
 * part a temperature comes from).
 */
export function withFacets(reading: Reading, snapshot: DeviceSnapshot | undefined, facets: readonly string[], valueParts: readonly ('percent' | 'used' | 'free' | 'total')[], t: Translate, language: UiLanguage, display?: string): Reading {
  const source = reading.source;
  const vitals = snapshot?.vitals;
  const extra: string[] = [];
  let text = reading.text;
  let detail: string | undefined;
  if ((reading.metric === 'memory' || reading.metric === 'disk') && source?.totalBytes) {
    // Only the chosen values, a size followed by the total when both are chosen.
    const used = source.usedBytes ?? (source.totalBytes * source.percent) / 100;
    const total = formatBytes(source.totalBytes, language);
    const withTotal = (size: string) => (valueParts.includes('total') ? [size, total].join(' / ') : size);
    const shown: string[] = [];
    if (valueParts.includes('percent')) shown.push(reading.text);
    if (valueParts.includes('used')) shown.push(withTotal(formatBytes(used, language)));
    if (valueParts.includes('free')) shown.push(t('devices.calme.free', { size: withTotal(formatBytes(source.totalBytes - used, language)) }));
    if (valueParts.includes('total') && !valueParts.includes('used') && !valueParts.includes('free')) shown.push(total);
    // A ring shows the share in its centre: everything else goes under it.
    const sizes = display === 'ring' ? shown.filter(part => part !== reading.text) : shown;
    if (display === 'ring') detail = sizes.join(' · ') || undefined;
    else if (sizes.length) { text = sizes[0]; detail = sizes.slice(1).join(' · ') || undefined; }
  }
  if (facets.includes('temperature') && source?.temperatureC !== undefined) extra.push(temperatureText(source.temperatureC));
  if (facets.includes('load') && vitals?.load?.length) extra.push([t('devices.calme.load'), decimal(vitals.load[0], 2, language)].join(' '));
  if (facets.includes('vram') && source?.totalBytes) extra.push([t('devices.look.vram'), [formatBytes(source.usedBytes ?? 0, language), formatBytes(source.totalBytes, language)].join(' / ')].join(' '));
  if (facets.includes('upload') && reading.detail) extra.push(reading.detail);
  if (facets.includes('averages') && vitals?.load && vitals.load.length >= 3) extra.push([decimal(vitals.load[1], 2, language), decimal(vitals.load[2], 2, language)].join(' · '));
  if (facets.includes('cores') && vitals?.cores) extra.push(t('devices.calme.ofCores', { cores: vitals.cores }));
  if (facets.includes('part') && reading.detail) extra.push(reading.detail);
  const parts = [detail, ...extra].filter(Boolean);
  return { ...reading, text, detail: parts.length ? parts.join(' · ') : undefined };
}
