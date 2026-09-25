import type { HistoryPoint, HistoryRange } from '@/integrations/history';
import type { DeviceVitals, Metric } from '@/integrations/types';

/**
 * Fictional readings of the public demo: the same shape as a real
 * integration, and a history computed from the time so every visitor sees
 * the same believable, moving curves.
 */

const GIB = 1024 ** 3;

const seedOf = (id: string) => Array.from(id).reduce((value, char) => value + char.charCodeAt(0), 0);

/** Smooth, repeatable wave around `base` (values stay in 0–100 for percentages). */
function wave(seed: number, base: number, amplitude: number, time: number) {
  const t = time / 60_000;
  const value = base
    + amplitude * Math.sin(t / 9 + seed)
    + amplitude * 0.45 * Math.sin(t / 3.1 + seed * 1.7)
    + amplitude * 0.12 * Math.sin(t / 0.9 + seed * 0.3);
  return Math.round(value * 10) / 10;
}

interface DemoSeries { id: string; base: number; amplitude: number; min?: number; max?: number }

function seriesOf(id: string): DemoSeries[] {
  const seed = seedOf(id);
  if (id === 'demo-device-1') return [
    { id: 'cpu.usage', base: 22, amplitude: 9 }, { id: 'cpu.usage@temp', base: 46, amplitude: 4 },
    { id: 'memory.usage', base: 39, amplitude: 2 },
    { id: 'disk.usage:data', base: 42, amplitude: 0.2 }, { id: 'disk.usage:system', base: 28, amplitude: 0.1 },
    { id: 'net.rx', base: 2.4e6, amplitude: 1.8e6, min: 0, max: Infinity }, { id: 'net.tx', base: 0.9e6, amplitude: 0.7e6, min: 0, max: Infinity },
    { id: 'load.1', base: 0.9, amplitude: 0.4, min: 0, max: Infinity },
  ];
  if (id === 'demo-device-2') return [
    { id: 'cpu.usage', base: 31, amplitude: 14 }, { id: 'cpu.usage@temp', base: 58, amplitude: 7 },
    { id: 'memory.usage', base: 64, amplitude: 4 },
    { id: 'disk.usage:storage', base: 58, amplitude: 0.2 },
    { id: 'gpu.usage', base: 24, amplitude: 16 }, { id: 'gpu.usage@temp', base: 52, amplitude: 8 },
    { id: 'net.rx', base: 6.5e6, amplitude: 5e6, min: 0, max: Infinity }, { id: 'net.tx', base: 3.1e6, amplitude: 2.6e6, min: 0, max: Infinity },
    { id: 'load.1', base: 2.1, amplitude: 1.1, min: 0, max: Infinity },
  ];
  return [
    { id: 'cpu.usage', base: 18 + (seed % 11), amplitude: 7 },
    { id: 'memory.usage', base: 39 + (seed % 8), amplitude: 3 },
  ];
}

const valueAt = (series: DemoSeries, seed: number, time: number) =>
  Math.min(series.max ?? 100, Math.max(series.min ?? 0, wave(seed + series.id.length, series.base, series.amplitude, time)));

export function demoDeviceMetrics(id: string, now = Date.now()): Metric[] {
  const seed = seedOf(id);
  const at = (series: string) => {
    const found = seriesOf(id).find(candidate => candidate.id === series);
    return found ? valueAt(found, seed, now) : undefined;
  };
  if (id === 'demo-device-1') return [
    { key: 'cpu.usage', kind: 'cpu', percent: at('cpu.usage')!, temperatureC: at('cpu.usage@temp') },
    { key: 'memory.usage', kind: 'memory', percent: at('memory.usage')!, usedBytes: (at('memory.usage')! / 100) * 16 * GIB, totalBytes: 16 * GIB },
    { key: 'disk.usage:data', kind: 'disk', name: 'Données', percent: 42, usedBytes: 210 * GIB, totalBytes: 500 * GIB },
    { key: 'disk.usage:system', kind: 'disk', name: 'Système', percent: 28, usedBytes: 36 * GIB, totalBytes: 128 * GIB },
  ];
  if (id === 'demo-device-2') return [
    { key: 'cpu.usage', kind: 'cpu', percent: at('cpu.usage')!, temperatureC: at('cpu.usage@temp') },
    { key: 'memory.usage', kind: 'memory', percent: at('memory.usage')!, usedBytes: (at('memory.usage')! / 100) * 64 * GIB, totalBytes: 64 * GIB },
    { key: 'disk.usage:storage', kind: 'disk', name: 'Stockage', percent: 58, usedBytes: 5800 * GIB, totalBytes: 10_000 * GIB },
    { key: 'gpu.usage', kind: 'gpu', name: 'GPU', percent: at('gpu.usage')!, temperatureC: at('gpu.usage@temp'), usedBytes: 3.8 * GIB, totalBytes: 16 * GIB },
  ];
  return [
    { key: 'cpu.usage', kind: 'cpu', percent: at('cpu.usage')! },
    { key: 'memory.usage', kind: 'memory', percent: at('memory.usage')!, usedBytes: (at('memory.usage')! / 100) * 8 * GIB, totalBytes: 8 * GIB },
  ];
}

export function demoDeviceVitals(id: string, now = Date.now()): DeviceVitals {
  const seed = seedOf(id);
  const at = (series: string) => {
    const found = seriesOf(id).find(candidate => candidate.id === series);
    return found ? valueAt(found, seed, now) : undefined;
  };
  const load1 = at('load.1');
  return {
    uptimeSeconds: 86_400 * (12 + (seed % 20)) + Math.floor((now / 1000) % 86_400),
    cores: id === 'demo-device-2' ? 16 : 8,
    ...(load1 !== undefined ? { load: [load1, Math.round(load1 * 90) / 100, Math.round(load1 * 80) / 100] } : {}),
    ...(at('net.rx') !== undefined ? { netRxBps: at('net.rx'), netTxBps: at('net.tx') } : {}),
  };
}

export function demoDeviceHistory(id: string, range: HistoryRange, since = 0, now = Date.now()): Record<string, HistoryPoint[]> {
  const seed = seedOf(id);
  const step = range === '1h' ? 10_000 : 60_000;
  const span = range === '1h' ? 3_600_000 : 86_400_000;
  const result: Record<string, HistoryPoint[]> = {};
  const end = now - (now % step);
  for (const series of seriesOf(id)) {
    const points: HistoryPoint[] = [];
    for (let time = Math.max(end - span, since + 1); time <= end; time += step) {
      const t = time - (time % step);
      if (t <= since) continue;
      const value = valueAt(series, seed, t);
      points.push(range === '1h' ? [t, value] : [t, value, Math.max(value, valueAt(series, seed, t + 20_000), valueAt(series, seed, t + 40_000))]);
    }
    if (points.length) result[series.id] = points;
  }
  return result;
}
