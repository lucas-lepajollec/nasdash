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
  /** Supporting text (capacity, free space, core count, send rate). */
  detail?: string;
  points: [number, number][];
  /** Network: the send side, drawn as a second line. */
  second?: { label: string; points: [number, number][] };
  /** Load: the core count the load is read against. */
  cores?: number;
  /** The integration's measure behind it (sizes, temperature). */
  source?: Metric;
  /**
   * Name of the kind of measure, never a part's own name (`CPU`, `RAM`,
   * `iGPU`, `Disk`): what a row showing one reading per measure writes.
   */
  kindLabel?: string;
  /** Full name of the measured part (disk, GPU), for tooltips. */
  part?: string;
  /** Short name of the part a GPU temperature comes from (`GPU`, `iGPU`, `RTX 4070`). */
  partLabel?: string;
  /** Machine of the reading, beside its name in a several-machine widget. */
  owner?: string;
}

export type GpuKind = 'gpu' | 'igpu';

/**
 * Integrated graphics from the name the source reports: Intel graphics other
 * than discrete Arc cards, AMD APU graphics (`Radeon Graphics`, `Vega 8`,
 * `780M`), Apple silicon and NVIDIA Tegra/Jetson. Anything else is a GPU.
 */
export function gpuKind(name: string | undefined): GpuKind {
  const value = (name ?? '').toLowerCase();
  if (!value) return 'gpu';
  if (/\b(igpu|integrated|apple|tegra|jetson|orin)\b/.test(value)) return 'igpu';
  if (/\bintel\b|\buhd\b|\biris\b|\bhd graphics\b/.test(value)) return /\barc\s*(?:pro\s*)?[ab]\d{3}/.test(value) ? 'gpu' : 'igpu';
  if (/radeon|vega/.test(value)) return /\b(rx|pro|instinct|vii|frontier)\b/.test(value) ? 'gpu' : /graphics|vega|\b\d{3}m\b/.test(value) ? 'igpu' : 'gpu';
  return 'gpu';
}

/** `NVIDIA GeForce RTX 4070` → `RTX 4070`, `Intel(R) UHD Graphics 770` → `UHD 770`. */
export function shortGpuName(name: string): string {
  const short = name.replace(/\(r\)|\(tm\)|®|™/gi, ' ').replace(/\b(nvidia|geforce|amd|ati|intel|corporation|graphics)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  // Too little left (`Graphics A` → `A`): the reported name reads better.
  return short.length >= 3 ? short : name.trim();
}

/**
 * Names of the GPUs of one machine: their kind (`GPU`, `iGPU`) while it is
 * unique, else their short name, numbered when even that repeats.
 */
export function gpuNames(gpus: readonly Metric[]): string[] {
  const base = gpus.map(gpu => (gpuKind(gpu.name) === 'igpu' ? 'iGPU' : 'GPU'));
  const names = gpus.map((gpu, index) => {
    if (base.filter(item => item === base[index]).length === 1) return base[index];
    const raw = gpu.name?.trim();
    return raw && raw.toUpperCase() !== 'GPU' ? shortGpuName(raw) : '';
  });
  return names.map((name, index) => {
    if (name && names.filter(item => item === name).length === 1) return name;
    const rank = base.slice(0, index + 1).filter(item => item === base[index]).length;
    return [name || base[index], rank].join(' ');
  });
}

export function metricText(metric: MetricId, value: number | undefined, language: UiLanguage): string {
  switch (metric) {
    case 'temperature':
    case 'gpuTemperature': return temperatureText(value);
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
      return cpu ? [{ metric, key: cpu.key, label: 'CPU', kindLabel: 'CPU', value: cpu.percent, text: percentText(cpu.percent, language), points: seriesPoints(snapshot, cpu.key), source: cpu }] : [];
    case 'memory': {
      const memory = metrics.find(item => item.kind === 'memory');
      if (!memory) return [];
      const detail = memory.totalBytes ? [memory.usedBytes !== undefined ? formatBytes(memory.usedBytes, language) : '', formatBytes(memory.totalBytes, language)].filter(Boolean).join(' / ') : undefined;
      return [{ metric, key: memory.key, label: 'RAM', kindLabel: 'RAM', value: memory.percent, text: percentText(memory.percent, language), detail, points: seriesPoints(snapshot, memory.key), source: memory }];
    }
    case 'gpu': {
      // `GPU` or `iGPU`, never the card's full name (it stays in the tooltip).
      const gpus = metrics.filter(item => item.kind === 'gpu');
      const names = gpuNames(gpus);
      return gpus.map((gpu, index) => ({
        metric, key: gpu.key, label: names[index], kindLabel: gpuKind(gpu.name) === 'igpu' ? 'iGPU' : 'GPU', part: gpu.name,
        value: gpu.percent, text: percentText(gpu.percent, language), points: seriesPoints(snapshot, gpu.key), source: gpu,
      }));
    }
    case 'temperature': {
      if (cpu?.temperatureC === undefined || !Number.isFinite(cpu.temperatureC)) return [];
      const label = t('devices.calme.cpuTemperature');
      return [{ metric, key: `${cpu.key}@temp`, label, kindLabel: label, value: cpu.temperatureC, text: temperatureText(cpu.temperatureC), points: seriesPoints(snapshot, `${cpu.key}@temp`), source: cpu }];
    }
    case 'gpuTemperature': {
      const gpus = metrics.filter(item => item.kind === 'gpu');
      const names = gpuNames(gpus);
      return gpus.flatMap((gpu, index) => {
        if (gpu.temperatureC === undefined || !Number.isFinite(gpu.temperatureC)) return [];
        const kind = gpuKind(gpu.name) === 'igpu' ? 'iGPU' : 'GPU';
        const kindLabel = t(kind === 'iGPU' ? 'devices.calme.igpuTemperature' : 'devices.calme.gpuTemperature');
        // The kind of temperature already says `GPU`/`iGPU`; a repeated kind adds the card.
        const label = names[index] === kind ? kindLabel : [kindLabel, names[index]].join(' · ');
        return [{
          metric, key: `${gpu.key}@temp`, label, kindLabel, part: gpu.name, value: gpu.temperatureC, text: temperatureText(gpu.temperatureC),
          partLabel: names[index], points: seriesPoints(snapshot, `${gpu.key}@temp`), source: gpu,
        }];
      });
    }
    case 'load': {
      const label = t('devices.calme.load');
      return vitals.load?.length ? [{
        metric, key: 'load.1', label, kindLabel: label, value: vitals.load[0], text: decimal(vitals.load[0], 2, language),
        detail: vitals.cores ? t('devices.calme.ofCores', { cores: vitals.cores }) : undefined, points: seriesPoints(snapshot, 'load.1'), cores: vitals.cores,
      }] : [];
    }
    case 'network': {
      const label = t('devices.calme.network');
      if (vitals.netRxBps !== undefined) {
        return [{
          metric, key: 'net.rx', label, kindLabel: label, value: vitals.netRxBps, text: ['↓', rateText(vitals.netRxBps, language)].join(' '),
          detail: vitals.netTxBps !== undefined ? ['↑', rateText(vitals.netTxBps, language)].join(' ') : undefined,
          points: seriesPoints(snapshot, 'net.rx'), second: { label: t('devices.calme.sent'), points: seriesPoints(snapshot, 'net.tx') },
        }];
      }
      return vitals.netTotalBps !== undefined ? [{ metric, key: 'net.total', label, kindLabel: label, value: vitals.netTotalBps, text: rateText(vitals.netTotalBps, language), points: seriesPoints(snapshot, 'net.total') }] : [];
    }
    case 'disk': {
      const disks = metrics.filter(item => item.kind === 'disk');
      const kindLabel = t('devices.calme.disk');
      return disks.map((disk, index) => {
        const used = disk.usedBytes ?? (disk.totalBytes ? (disk.totalBytes * disk.percent) / 100 : undefined);
        const free = disk.totalBytes !== undefined && used !== undefined ? disk.totalBytes - used : undefined;
        // One disk is just "Disk"; several need their own names.
        const label = disks.length > 1 ? disk.name?.trim() || [kindLabel, index + 1].join(' ') : kindLabel;
        return {
          metric, key: disk.key, label, kindLabel, part: disk.name, value: disk.percent, text: percentText(disk.percent, language),
          detail: free !== undefined ? t('devices.calme.free', { size: formatBytes(free, language) }) : undefined, points: seriesPoints(snapshot, disk.key), source: disk,
        };
      });
    }
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
  if (facets.includes('part') && reading.partLabel) extra.push(reading.partLabel);
  const parts = [detail, ...extra].filter(Boolean);
  return { ...reading, text, detail: parts.length ? parts.join(' · ') : undefined };
}
