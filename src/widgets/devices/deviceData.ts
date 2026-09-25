'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { HistoryPoint, HistoryRange } from '@/integrations/history';
import type { DeviceVitals, Metric } from '@/integrations/types';
import type { DeviceStat } from '@/lib/types';

/**
 * One shared reader of `/api/devices/<id>/history` per device and range:
 * every widget showing the same machine (Device, Fleet, Chart, Storage) reads
 * the same data and the page polls it once, every 10 s, only while one of
 * them is on screen and the tab is visible. The first answer brings the
 * whole range; the next ones only the newer points.
 */

export interface DeviceSnapshot {
  online: boolean;
  error?: string;
  updatedAt: number;
  metrics: Metric[];
  stats?: DeviceStat[];
  vitals: DeviceVitals;
  series: Record<string, HistoryPoint[]>;
}

const POLL_MS = 10_000;
const SPAN: Record<HistoryRange, number> = { '1h': 3_600_000, '24h': 86_400_000 };

interface Entry {
  data?: DeviceSnapshot;
  failed?: boolean;
  users: number;
  timer?: ReturnType<typeof setTimeout>;
  loading?: Promise<void>;
}

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
const notify = () => { version += 1; listeners.forEach(listener => listener()); };

const keyOf = (id: string, range: HistoryRange) => `${id}|${range}`;

/** Adds newer points; points of the minute still being averaged are replaced. */
export function mergeSeries(current: Record<string, HistoryPoint[]>, update: Record<string, HistoryPoint[]>, windowStart: number) {
  const merged: Record<string, HistoryPoint[]> = {};
  for (const id of new Set([...Object.keys(current), ...Object.keys(update)])) {
    const fresh = update[id] ?? [];
    const firstNew = fresh.length ? fresh[0][0] : Infinity;
    merged[id] = [...(current[id] ?? []).filter(point => point[0] < firstNew), ...fresh].filter(point => point[0] >= windowStart);
  }
  return merged;
}

async function load(id: string, range: HistoryRange) {
  const key = keyOf(id, range);
  const entry = entries.get(key);
  if (!entry) return;
  const previous = entry.data;
  let since = 0;
  if (previous) {
    for (const points of Object.values(previous.series)) if (points.length) since = Math.max(since, points[points.length - 1][0]);
    // The 24 h series end on the minute being averaged: ask for it again.
    if (range === '24h' && since) since -= 60_000;
  }
  try {
    const response = await fetch(`/api/devices/${encodeURIComponent(id)}/history?range=${range}${since ? `&since=${since}` : ''}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    const answer = await response.json() as DeviceSnapshot;
    const windowStart = Date.now() - SPAN[range];
    entry.data = { ...answer, series: previous ? mergeSeries(previous.series, answer.series ?? {}, windowStart) : answer.series ?? {} };
    entry.failed = false;
  } catch {
    entry.failed = true;
  }
  notify();
}

function schedule(id: string, range: HistoryRange) {
  const entry = entries.get(keyOf(id, range));
  if (!entry || entry.users <= 0) return;
  clearTimeout(entry.timer);
  entry.timer = setTimeout(async () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') await load(id, range);
    schedule(id, range);
  }, POLL_MS);
}

function start(id: string, range: HistoryRange) {
  const key = keyOf(id, range);
  const entry = entries.get(key) ?? { users: 0 };
  entries.set(key, entry);
  entry.users += 1;
  if (entry.users === 1) {
    entry.loading = load(id, range);
    schedule(id, range);
  }
  return () => {
    entry.users -= 1;
    if (entry.users <= 0) clearTimeout(entry.timer);
  };
}

// Back from another tab: refresh right away instead of waiting for the timer.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    for (const [key, entry] of entries) {
      if (entry.users <= 0) continue;
      const [id, range] = key.split('|') as [string, HistoryRange];
      void load(id, range);
    }
  });
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
const readVersion = () => version;

/** Current reading and history of several devices (missing ids are skipped). */
export function useDevicesData(ids: readonly string[], range: HistoryRange, enabled = true): Record<string, { data?: DeviceSnapshot; failed?: boolean }> {
  useSyncExternalStore(subscribe, readVersion, readVersion);
  const signature = ids.join(',');
  useEffect(() => {
    if (!enabled || !signature) return;
    const stops = signature.split(',').map(id => start(id, range));
    return () => stops.forEach(stop => stop());
  }, [signature, range, enabled]);
  const result: Record<string, { data?: DeviceSnapshot; failed?: boolean }> = {};
  for (const id of ids) {
    const entry = entries.get(keyOf(id, range));
    result[id] = { data: entry?.data, failed: entry?.failed };
  }
  return result;
}

export function useDeviceData(id: string | undefined, range: HistoryRange, enabled = true) {
  const all = useDevicesData(id ? [id] : [], range, enabled);
  return id ? all[id] : {};
}

/** Points of one series as `[time, value]` (the 24 h average). */
export function seriesPoints(snapshot: DeviceSnapshot | undefined, id: string): [number, number][] {
  return (snapshot?.series[id] ?? []).map(point => [point[0], point[1]] as [number, number]);
}

/** End of the chart window: the latest reading (render stays pure, no clock read). */
export function latestTime(snapshot: DeviceSnapshot | undefined): number {
  let latest = snapshot?.updatedAt ?? 0;
  for (const points of Object.values(snapshot?.series ?? {})) if (points.length) latest = Math.max(latest, points[points.length - 1][0]);
  return latest;
}
