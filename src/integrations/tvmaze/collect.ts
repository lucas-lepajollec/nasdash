import { publicJson } from '@/lib/widgetData/publicJson';
/** Public TVMaze requests contain provider ids only; library metadata stays local. */
import { TtlCache } from '@/lib/widgetData/cache';
import { date, number, object, string, ServiceError } from '@/lib/widgetData/services';
export const TVMAZE_BASE_URL = 'https://api.tvmaze.com';
export interface TvMazeProvider { tvdb?: string; imdb?: string }
export interface TvMazeShow { status: string; network?: string; next?: { at?: number; season: number; episode: number; title: string } }
const lookups = new TtlCache<number | null>(86400000, 2000);
// Shows refresh in the background for a day past their 6 h: the pacing makes a cold library pass slow.
const episodes = new TtlCache<TvMazeShow>(21600000, 2000, 0, 86400000);
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
let nextStart = 0, active = 0;
const waiting: (() => void)[] = [];
/** Shared across widgets: at most six calls, spaced below TVMaze's 20 / 10 s limit. */
async function request(path: string, base: string): Promise<Record<string, unknown> | null> {
  const value = await tvMazeJson(path, base);
  return value === null ? null : object(value);
}
/**
 * One paced call. `lookup`: TVMaze answers a lookup with a redirect to the
 * show (`301 Location: …/shows/{id}`); only that id is read, nothing is followed.
 */
async function send(path: string, base: string, lookup: boolean): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (active >= 6) await new Promise<void>(resolve => waiting.push(resolve));
    else active++;
    try {
      const start = Math.max(Date.now(), nextStart); nextStart = start + 550;
      if (start > Date.now()) await sleep(start - Date.now());
      const response = await fetch(`${base}${path}`, { headers: { 'User-Agent': 'NasDash' }, signal: AbortSignal.timeout(10000), redirect: lookup ? 'manual' : 'error' });
      if (response.status === 404) return null;
      if (lookup && response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        const match = /^(?:https?:\/\/api\.tvmaze\.com|)\/shows\/(\d{1,10})$/.exec(response.headers.get('location') ?? '') ?? (base !== TVMAZE_BASE_URL ? /\/shows\/(\d{1,10})$/.exec(response.headers.get('location') ?? '') : null);
        return match ? Number(match[1]) : null;
      }
      if (response.status !== 429 || attempt !== 0) {
        if (!response.ok) { await response.body?.cancel(); throw new ServiceError('widgets.error.http'); }
        return await publicJson(response);
      }
      await response.body?.cancel();
    } finally { const resume = waiting.shift(); if (resume) resume(); else active--; }
    await sleep(2000);
  }
  throw new ServiceError('widgets.error.http');
}
export function tvMazeJson(path: string, base = TVMAZE_BASE_URL): Promise<unknown> { return send(path, base, false); }
/** Optional base allows fixture tests to replace the public endpoint; callers use the constant. */
export async function tvMazeShow(provider: TvMazeProvider, base = TVMAZE_BASE_URL): Promise<TvMazeShow | null> {
  const tvdb = /^\d{1,12}$/.test(provider.tvdb ?? '') ? provider.tvdb : undefined;
  const imdb = /^(?:tt)?\d{1,12}$/.test(provider.imdb ?? '') ? `tt${provider.imdb!.replace(/^tt/, '')}` : undefined;
  if (!tvdb && !imdb) return null;
  const key = `${base}:${tvdb ? `tvdb:${tvdb}` : `imdb:${imdb}`}`;
  const id = await lookups.get(key, async () => {
    const show = await send(`/lookup/shows?${tvdb ? `thetvdb=${tvdb}` : `imdb=${imdb}`}`, base, true);
    if (typeof show === 'number') return show > 0 ? show : null;
    return show && typeof object(show).id === 'number' && Number.isInteger(object(show).id) && Number(object(show).id) > 0 ? Number(object(show).id) : null;
  });
  if (id === null) return null;
  return episodes.get(key, async () => {
    const show = await request(`/shows/${id}`, base);
    if (!show) throw new ServiceError('widgets.error.notFound');
    const href = string(object(object(show._links).nextepisode).href);
    // Never follow arbitrary metadata URLs or forward library strings to a third party.
    const match = /^https?:\/\/api\.tvmaze\.com(\/episodes\/\d+)$/.exec(href);
    const next = match ? await request(match[1], base) : null;
    return { status: string(show.status), network: string(object(show.network).name) || string(object(show.webChannel).name) || undefined,
      ...(next ? { next: { at: date(next.airstamp) ?? date(next.airdate), season: number(next.season), episode: number(next.number), title: string(next.name) } } : {}) };
  });
}
/** Test isolation also resets the shared request pacing. */
export function clearTvMazeCache() { lookups.clear(); episodes.clear(); nextStart = 0; }
