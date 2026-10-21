/** Catalogue orchestration never searches using library metadata or watchlist titles. */
import { readConfig } from '@/lib/config';
import type { CatalogHit, CatalogKind, CatalogProvider, ExternalItem, SourceFailure, WatchEntry } from '@/lib/widgetData/contracts';
import { serviceFailure, ServiceError } from '@/lib/widgetData/services';
import type { externalSettings } from '@/lib/widgetData/arr';
import { allTvMaze, getTvMaze, searchTvMaze } from './tvmaze';
import { allKitsu, getKitsu, searchKitsu } from './kitsu';
import { getAniList, searchAniList } from './anilist';
import { allTmdb, getTmdb, searchTmdb } from './tmdb';
import { sortExternal } from './shared';
const names: Record<CatalogProvider, string> = { tvmaze: 'TVMaze', kitsu: 'Kitsu', anilist: 'AniList', tmdb: 'TMDB' };
const tmdbConnection = () => readConfig().integrations?.find(instance => instance.type === 'tmdb');
export async function searchCatalog(q: string, kinds: CatalogKind[]): Promise<CatalogHit[]> {
  const tmdb = tmdbConnection();
  const tasks = [kinds.includes('series') ? searchTvMaze(q) : Promise.resolve([]), kinds.includes('anime') ? searchKitsu(q) : Promise.resolve([]), kinds.includes('anime') ? searchAniList(q) : Promise.resolve([]), tmdb && (kinds.includes('series') || kinds.includes('movie')) ? searchTmdb(q, tmdb) : Promise.resolve([])];
  const results = await Promise.allSettled(tasks);
  const animeTitles = new Set<string>();
  return results.flatMap(result => result.status === 'fulfilled' ? result.value : []).filter(hit => {
    // The TVMaze series search may return animation; keep only requested kinds.
    if (!kinds.includes(hit.kind) || !hit.title) return false;
    if (hit.kind === 'anime') { const key = hit.title.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase(); if (animeTitles.has(key)) return false; animeTitles.add(key); }
    return true;
  }).slice(0, 24);
}
export async function collectExternal(selection: ReturnType<typeof externalSettings>, ended: boolean): Promise<{ external: ExternalItem[]; failures: SourceFailure[] }> {
  const tmdb = tmdbConnection(), failures: SourceFailure[] = [];
  const jobs: { provider: CatalogProvider; load: () => Promise<ExternalItem[]> }[] = [];
  if (selection.mode === 'all') {
    if (selection.kinds.includes('series') || selection.kinds.includes('anime')) jobs.push({ provider: 'tvmaze', load: () => allTvMaze() });
    if (selection.kinds.includes('anime')) jobs.push({ provider: 'kitsu', load: allKitsu });
    if (tmdb && (selection.kinds.includes('movie') || selection.kinds.includes('series'))) jobs.push({ provider: 'tmdb', load: () => allTmdb(tmdb, selection.kinds) });
  } else {
    for (const entry of selection.watchlist) jobs.push({ provider: entry.provider, load: async () => [await loadEntry(entry)] });
  }
  async function loadEntry(entry: WatchEntry) {
    switch (entry.provider) {
      case 'tvmaze': return getTvMaze(entry);
      case 'kitsu': return getKitsu(entry);
      case 'anilist': return getAniList(entry);
      case 'tmdb': if (tmdb) return getTmdb(entry, tmdb); throw new ServiceError('widgets.error.notFound');
    }
  }
  const results = await Promise.allSettled(jobs.map(job => job.load()));
  const items: ExternalItem[] = [];
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') items.push(...result.value);
    else {
      const provider = jobs[i].provider, id = provider === 'tmdb' && tmdb ? tmdb.id : 'external', name = provider === 'tmdb' && tmdb ? tmdb.name : names[provider];
      if (!failures.some(failure => failure.id === id && failure.name === name)) failures.push({ id, name, error: (await serviceFailure(result.reason).json()).error });
    }
  }
  const unique = [...new Map(items.filter(item => (ended || item.status !== 'ended') && (selection.mode === 'watchlist' || selection.kinds.includes(item.kind))).map(item => [item.id, item])).values()];
  return { external: sortExternal(unique), failures };
}
