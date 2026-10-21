import { publicJson } from '@/lib/widgetData/publicJson';
/** Public catalogue transport. Callers construct paths only from queries and catalogue ids. */
import { TtlCache } from '@/lib/widgetData/cache';
import { ServiceError, object } from '@/lib/widgetData/services';
import type { CatalogHit, ExternalItem, WatchEntry } from '@/lib/widgetData/contracts';
export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
export function pacedJson(interval: number) {
  let nextStart = 0;
  let active = 0;
  const waiting: (() => void)[] = [];
  const request = async (url: string, init: RequestInit = {}): Promise<unknown> => {
    if (active >= 4) {
      if (waiting.length >= 64) throw new ServiceError('widgets.error.tooLarge');
      await new Promise<void>(resolve => waiting.push(resolve));
    } else active++;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const start = Math.max(Date.now(), nextStart); nextStart = start + interval;
        if (start > Date.now()) await sleep(start - Date.now());
        const response = await fetch(url, { ...init, headers: { ...init.headers, 'User-Agent': 'NasDash' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
        if (response.status === 429 && attempt === 0) { await response.body?.cancel(); await sleep(2000); continue; }
        if (!response.ok) { await response.body?.cancel(); throw new ServiceError('widgets.error.http'); }
        const json: unknown = await publicJson(response);
        if (!json || typeof json !== 'object') throw new ServiceError('widgets.error.parse');
        return json;
      }
      throw new ServiceError('widgets.error.http');
    } finally {
      const resume = waiting.shift();
      if (resume) resume(); else active--;
    }
  };
  return { request, clear: () => { nextStart = 0; } };
}
export function catalogCaches() {
  const entries = new TtlCache<ExternalItem>(21600000, 2000), search = new TtlCache<CatalogHit[]>(600000, 300), all = new TtlCache<ExternalItem[]>(3600000, 100);
  return { entries, search, all, clear: () => { entries.clear(); search.clear(); all.clear(); } };
}
export function publicImage(value: unknown, hosts: string[]): string | undefined {
  if (typeof value !== 'string' || /[\\\x00-\x20]/.test(value)) return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts.includes(url.hostname) ? value : undefined; } catch { return undefined; }
}
export function catalogId(value: unknown): string {
  const id = typeof value === 'number' ? String(value) : value;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new ServiceError('widgets.error.parse');
  return id;
}
export function external(entry: WatchEntry, fields: Omit<ExternalItem, 'provider' | 'kind' | 'title' | 'phase'> & { title?: string }): ExternalItem {
  return { ...entry, ...fields, title: fields.title || entry.title, phase: fields.status === 'airing' ? 'current' : 'announced' };
}
export function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new ServiceError('widgets.error.parse');
  return value.map(object);
}
export function sortExternal(items: ExternalItem[]): ExternalItem[] {
  const rank = (item: ExternalItem) => item.status === 'ended' ? 2 : item.at !== undefined ? 0 : 1;
  return [...items].sort((a, b) => rank(a) - rank(b) || (a.at ?? 0) - (b.at ?? 0));
}
