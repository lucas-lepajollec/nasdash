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

/** One fictional machine: what it has, and how its readings move. */
interface DemoProfile {
  cores: number;
  cpu: [base: number, amplitude: number];
  cpuTemp?: [number, number];
  memoryGiB: number;
  memory: [number, number];
  disks: Array<{ key: string; name: string; percent: number; totalGiB: number }>;
  gpu?: { name: string; usage: [number, number]; temp: [number, number]; memoryGiB: number; usedGiB: number };
  net: [rx: number, tx: number];
  load: [number, number];
}

const MB = 1e6;
const PROFILES: Record<string, DemoProfile> = {
  // Atlas NAS (Glances): a quiet storage box with big disks.
  'demo-device-1': {
    cores: 8, cpu: [22, 9], cpuTemp: [46, 4], memoryGiB: 16, memory: [39, 2],
    disks: [{ key: 'data', name: 'Données', percent: 63, totalGiB: 12_000 }, { key: 'system', name: 'Système', percent: 28, totalGiB: 128 }],
    net: [2.4 * MB, 0.9 * MB], load: [0.9, 0.4],
  },
  // Orion Compute (Proxmox): the virtualisation host, with a GPU for transcoding.
  'demo-device-2': {
    cores: 16, cpu: [31, 14], cpuTemp: [58, 7], memoryGiB: 64, memory: [64, 4],
    disks: [{ key: 'storage', name: 'Stockage', percent: 58, totalGiB: 10_000 }, { key: 'local', name: 'local-lvm', percent: 44, totalGiB: 1_000 }],
    gpu: { name: 'GPU', usage: [24, 16], temp: [52, 8], memoryGiB: 16, usedGiB: 3.8 },
    net: [6.5 * MB, 3.1 * MB], load: [2.1, 1.1],
  },
  // Pi Edge (Glances): a Raspberry Pi running DNS, small and cool.
  'demo-device-3': {
    cores: 4, cpu: [9, 5], cpuTemp: [51, 3], memoryGiB: 8, memory: [38, 2],
    disks: [{ key: 'sd', name: 'microSD', percent: 41, totalGiB: 64 }],
    net: [0.3 * MB, 0.2 * MB], load: [0.3, 0.2],
  },
  // Nova Workstation (Libre Hardware Monitor): a gaming PC whose GPU sometimes
  // crosses the danger threshold, to show the alert colour.
  'demo-device-4': {
    cores: 12, cpu: [14, 10], cpuTemp: [49, 9], memoryGiB: 32, memory: [47, 5],
    disks: [{ key: 'nvme', name: 'NVMe', percent: 71, totalGiB: 2_000 }, { key: 'games', name: 'Jeux', percent: 83, totalGiB: 4_000 }],
    gpu: { name: 'RTX 4070', usage: [52, 40], temp: [63, 12], memoryGiB: 12, usedGiB: 7.4 },
    net: [1.2 * MB, 0.4 * MB], load: [1.4, 0.8],
  },
  // Edge VPS (Beszel): a small cloud server.
  'demo-device-5': {
    cores: 2, cpu: [12, 6], memoryGiB: 4, memory: [57, 3],
    disks: [{ key: 'root', name: 'Racine', percent: 67, totalGiB: 80 }],
    net: [0.8 * MB, 0.6 * MB], load: [0.4, 0.2],
  },
};

function seriesOf(id: string): DemoSeries[] {
  const seed = seedOf(id);
  const profile = PROFILES[id];
  if (!profile) return [
    { id: 'cpu.usage', base: 18 + (seed % 11), amplitude: 7 },
    { id: 'memory.usage', base: 39 + (seed % 8), amplitude: 3 },
  ];
  return [
    { id: 'cpu.usage', base: profile.cpu[0], amplitude: profile.cpu[1] },
    ...(profile.cpuTemp ? [{ id: 'cpu.usage@temp', base: profile.cpuTemp[0], amplitude: profile.cpuTemp[1] }] : []),
    { id: 'memory.usage', base: profile.memory[0], amplitude: profile.memory[1] },
    ...profile.disks.map(disk => ({ id: `disk.usage:${disk.key}`, base: disk.percent, amplitude: 0.2 })),
    ...(profile.gpu ? [{ id: 'gpu.usage', base: profile.gpu.usage[0], amplitude: profile.gpu.usage[1] }, { id: 'gpu.usage@temp', base: profile.gpu.temp[0], amplitude: profile.gpu.temp[1] }] : []),
    { id: 'net.rx', base: profile.net[0], amplitude: profile.net[0] * 0.75, min: 0, max: Infinity },
    { id: 'net.tx', base: profile.net[1], amplitude: profile.net[1] * 0.75, min: 0, max: Infinity },
    { id: 'load.1', base: profile.load[0], amplitude: profile.load[1], min: 0, max: Infinity },
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
  const profile = PROFILES[id];
  if (!profile) return [
    { key: 'cpu.usage', kind: 'cpu', percent: at('cpu.usage')! },
    { key: 'memory.usage', kind: 'memory', percent: at('memory.usage')!, usedBytes: (at('memory.usage')! / 100) * 8 * GIB, totalBytes: 8 * GIB },
  ];
  const memory = at('memory.usage')!;
  return [
    { key: 'cpu.usage', kind: 'cpu', percent: at('cpu.usage')!, ...(profile.cpuTemp ? { temperatureC: at('cpu.usage@temp') } : {}) },
    { key: 'memory.usage', kind: 'memory', percent: memory, usedBytes: (memory / 100) * profile.memoryGiB * GIB, totalBytes: profile.memoryGiB * GIB },
    ...profile.disks.map(disk => ({ key: `disk.usage:${disk.key}`, kind: 'disk' as const, name: disk.name, percent: disk.percent, usedBytes: (disk.percent / 100) * disk.totalGiB * GIB, totalBytes: disk.totalGiB * GIB })),
    ...(profile.gpu ? [{ key: 'gpu.usage', kind: 'gpu' as const, name: profile.gpu.name, percent: at('gpu.usage')!, temperatureC: at('gpu.usage@temp'), usedBytes: profile.gpu.usedGiB * GIB, totalBytes: profile.gpu.memoryGiB * GIB }] : []),
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
    cores: PROFILES[id]?.cores ?? 8,
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
