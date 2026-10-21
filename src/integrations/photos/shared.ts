import type { IntegrationInstance } from '@/lib/types';
import type { PhotoStatsProvider, PhotoStatsResponse } from '@/lib/widgetData/contracts';
import { array, object } from '@/lib/widgetData/services';

/** Optional upstream counts can be numeric strings (notably Piwigo's SQL aggregates). */
export function count(value: unknown): number | undefined {
  const n = typeof value === 'number' || typeof value === 'string' && /^\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
export function counters(values: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(Object.entries(values).flatMap(([key, value]) => { const n = count(value); return n === undefined ? [] : [[key, n]]; }));
}
export function identity(instance: IntegrationInstance): PhotoStatsResponse {
  return { provider: instance.type as PhotoStatsProvider, name: instance.name, fetchedAt: Date.now() };
}
export function years(value: unknown, dateKey: string, countKey: string): NonNullable<PhotoStatsResponse['byYear']> | undefined {
  if (!Array.isArray(value)) return undefined;
  const totals = new Map<number, number>();
  for (const raw of array(value).slice(0, 12000)) {
    const row = object(raw), date = String(row[dateKey] ?? ''), year = Number(/^(\d{4})(?:-|$)/.exec(date)?.[1]), n = count(row[countKey]);
    if (!Number.isInteger(year) || year < 1 || year > 9999 || n === undefined) continue;
    totals.set(year, (totals.get(year) ?? 0) + n);
  }
  return [...totals].sort(([a], [b]) => a - b).slice(-20).map(([year, count]) => ({ year, count }));
}
