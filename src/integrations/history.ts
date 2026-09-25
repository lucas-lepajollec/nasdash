import fs from 'fs';
import path from 'path';
import type { DeviceVitals, Metric } from './types';

/**
 * Short history of every device, kept by the server so charts are full as
 * soon as a page opens (the browser used to start them empty).
 *
 * - `1h`: every poll (10 s while someone watches, 1 min otherwise), last hour;
 * - `24h`: one point per minute (average and peak), last 24 hours.
 *
 * The 24 h series are saved to `<data>/metrics-history.json` every few
 * minutes and read back on start, so a restart keeps the day. Series ids:
 * a metric key (`cpu.usage`, `disk.usage:/data`…) holds its percentage,
 * `<key>@temp` its temperature, `net.rx` / `net.tx` / `net.total` bytes per
 * second, `load.1` the 1-minute load.
 */

export type HistoryRange = '1h' | '24h';

/** `[time (ms), value]`, or `[time, average, peak]` for the 24 h series. */
export type HistoryPoint = [number, number] | [number, number, number];

interface Series {
  /** Flat `[t, v, t, v…]` of the last hour. */
  fine: number[];
  /** Flat `[t, avg, max, …]`, one per minute, last 24 hours. */
  coarse: number[];
  /** Minute being accumulated. */
  bucket?: { start: number; sum: number; count: number; max: number };
}

type DeviceHistory = Record<string, Series>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MINUTE = 60 * 1000;
const SAVE_EVERY_MS = 5 * MINUTE;

interface HistoryGlobal {
  __deviceHistory?: Record<string, DeviceHistory>;
  __deviceHistoryLoaded?: boolean;
  __deviceHistorySavedAt?: number;
}

const store = globalThis as typeof globalThis & HistoryGlobal;
store.__deviceHistory ??= {};
const histories = store.__deviceHistory;

/** The values of one poll, by series id. */
export function samplesOf(metrics: Metric[] | undefined, vitals: DeviceVitals | undefined): Record<string, number> {
  const samples: Record<string, number> = {};
  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  for (const metric of metrics ?? []) {
    if (finite(metric.percent)) samples[metric.key] = Math.max(0, Math.min(100, metric.percent));
    if (finite(metric.temperatureC)) samples[`${metric.key}@temp`] = metric.temperatureC;
  }
  if (finite(vitals?.netRxBps)) samples['net.rx'] = vitals.netRxBps;
  if (finite(vitals?.netTxBps)) samples['net.tx'] = vitals.netTxBps;
  if (finite(vitals?.netTotalBps)) samples['net.total'] = vitals.netTotalBps;
  if (finite(vitals?.load?.[0])) samples['load.1'] = vitals.load[0];
  return samples;
}

function flush(series: Series) {
  const bucket = series.bucket;
  if (!bucket || !bucket.count) return;
  series.coarse.push(bucket.start, round(bucket.sum / bucket.count), round(bucket.max));
  series.bucket = undefined;
}

const round = (value: number) => Math.round(value * 100) / 100;

function trim(series: Series, now: number) {
  let cut = 0;
  while (cut < series.fine.length && series.fine[cut] < now - HOUR) cut += 2;
  if (cut) series.fine.splice(0, cut);
  cut = 0;
  while (cut < series.coarse.length && series.coarse[cut] < now - DAY) cut += 3;
  if (cut) series.coarse.splice(0, cut);
}

/** Adds one poll of a device. */
export function recordSamples(deviceId: string, samples: Record<string, number>, now = Date.now()) {
  load();
  const history = (histories[deviceId] ??= {});
  for (const [id, value] of Object.entries(samples)) {
    const series = (history[id] ??= { fine: [], coarse: [] });
    series.fine.push(now, round(value));
    const start = now - (now % MINUTE);
    if (series.bucket && series.bucket.start !== start) flush(series);
    if (!series.bucket) series.bucket = { start, sum: 0, count: 0, max: -Infinity };
    series.bucket.sum += value;
    series.bucket.count += 1;
    series.bucket.max = Math.max(series.bucket.max, value);
    trim(series, now);
  }
}

/**
 * The series of a device over a range, oldest first. `since` returns only the
 * points after that time (a widget adds them to what it already has).
 */
export function readHistory(deviceId: string, range: HistoryRange, since = 0): Record<string, HistoryPoint[]> {
  load();
  const history = histories[deviceId] ?? {};
  const result: Record<string, HistoryPoint[]> = {};
  for (const [id, series] of Object.entries(history)) {
    const points: HistoryPoint[] = [];
    if (range === '1h') {
      for (let i = 0; i < series.fine.length; i += 2) if (series.fine[i] > since) points.push([series.fine[i], series.fine[i + 1]]);
    } else {
      for (let i = 0; i < series.coarse.length; i += 3) if (series.coarse[i] > since) points.push([series.coarse[i], series.coarse[i + 1], series.coarse[i + 2]]);
      const bucket = series.bucket;
      if (bucket?.count && bucket.start > since) points.push([bucket.start, round(bucket.sum / bucket.count), round(bucket.max)]);
    }
    if (points.length) result[id] = points;
  }
  return result;
}

/** Forgets devices that no longer exist. */
export function pruneHistory(knownIds: Iterable<string>) {
  const known = new Set(knownIds);
  for (const id of Object.keys(histories)) if (!known.has(id)) delete histories[id];
}

// ------------------------------------------------------------- persistence

let file: string | null = null;

/** Where the 24 h series are saved (null: not saved, e.g. in tests or the demo). */
export function setHistoryFile(target: string | null) {
  file = target;
  store.__deviceHistoryLoaded = false;
}

function load() {
  if (store.__deviceHistoryLoaded || !file) return;
  store.__deviceHistoryLoaded = true;
  try {
    // The file lives in the data directory, chosen at run time (see getDataPath):
    // Turbopack must not trace the whole project for it.
    if (!fs.existsSync(/* turbopackIgnore: true */ file)) return;
    const saved = JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ file, 'utf8')) as Record<string, Record<string, number[]>>;
    const now = Date.now();
    for (const [deviceId, seriesById] of Object.entries(saved)) {
      const history = (histories[deviceId] ??= {});
      for (const [id, coarse] of Object.entries(seriesById)) {
        if (!Array.isArray(coarse) || coarse.length % 3) continue;
        const series = (history[id] ??= { fine: [], coarse: [] });
        if (!series.coarse.length) series.coarse = coarse.filter(value => typeof value === 'number');
        trim(series, now);
      }
    }
  } catch (error) {
    console.warn('Device history could not be read, starting empty:', error instanceof Error ? error.message : error);
  }
}

/** Saves the 24 h series when the last save is old enough (or when forced). */
export function saveHistory(force = false) {
  if (!file) return;
  const now = Date.now();
  if (!force && now - (store.__deviceHistorySavedAt ?? 0) < SAVE_EVERY_MS) return;
  store.__deviceHistorySavedAt = now;
  const snapshot: Record<string, Record<string, number[]>> = {};
  for (const [deviceId, history] of Object.entries(histories)) {
    for (const [id, series] of Object.entries(history)) {
      if (series.coarse.length) (snapshot[deviceId] ??= {})[id] = series.coarse;
    }
  }
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(snapshot));
    fs.renameSync(temporary, file);
  } catch (error) {
    console.warn('Device history could not be saved:', error instanceof Error ? error.message : error);
  }
}

/** Test helper: empties the store. */
export function resetHistory() {
  for (const id of Object.keys(histories)) delete histories[id];
  store.__deviceHistorySavedAt = 0;
}
