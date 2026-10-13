import type { Reading } from './readings';

export const DEVICE_GROUPS = ['ring', 'value', 'bar', 'chart'] as const;
export type DeviceGroup = typeof DEVICE_GROUPS[number];

/** Keep hidden groups in the order so they return to their previous position. */
export function deviceGroupOrder(value: unknown): DeviceGroup[] {
  const saved = savedMetricOrder(value).filter((id): id is DeviceGroup => DEVICE_GROUPS.includes(id as DeviceGroup));
  return [...saved, ...DEVICE_GROUPS.filter(id => !saved.includes(id))];
}

/** Metric identity is scoped to a machine, so equal disk names never collide. */
export const metricEntryId = (deviceId: string, readingKey: string) => JSON.stringify([deviceId, readingKey]);

/** One-card metrics keep their place when the underlying sensor changes. */
export const readingOrderId = (deviceId: string, reading: Pick<Reading, 'metric' | 'key'>) => metricEntryId(deviceId,
  reading.metric === 'disk' || reading.metric === 'gpu' || reading.metric === 'gpuTemperature' ? reading.key : reading.metric);

export function savedMetricOrder(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : [];
}

/** Missing metrics retain their saved slots; new metrics follow the known ones. */
export function orderMetricEntries<T>(entries: readonly T[], value: unknown, key: (entry: T) => string): T[] {
  const ranks = new Map(savedMetricOrder(value).map((id, index) => [id, index]));
  return [...entries].sort((a, b) => (ranks.get(key(a)) ?? Infinity) - (ranks.get(key(b)) ?? Infinity));
}

/** Move the visible readings without losing temporarily absent or unselected ones. */
export function moveMetricEntry(value: unknown, visibleIds: readonly string[], active: string, over: string): string[] | null {
  const from = visibleIds.indexOf(active);
  const to = visibleIds.indexOf(over);
  if (from < 0 || to < 0 || from === to) return null;
  const moved = [...visibleIds];
  moved.splice(to, 0, ...moved.splice(from, 1));
  const visible = new Set(visibleIds);
  const saved = savedMetricOrder(value);
  const full = [...saved, ...visibleIds.filter(id => !saved.includes(id))];
  let index = 0;
  return full.map(id => visible.has(id) ? moved[index++] : id);
}
