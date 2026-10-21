import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
import type { WatchEntry } from '@/lib/widgetData/contracts';
import fixture from './samples/providers.json';
const state = vi.hoisted(() => ({ instances: [] as IntegrationInstance[] }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: state.instances }) }));
import { allTvMaze, clearTvMazeCatalog, getTvMaze, mapTvMaze, searchTvMaze } from './tvmaze';
import { allKitsu, clearKitsuCatalog, getKitsu, mapKitsu, searchKitsu } from './kitsu';
import { clearAniListCatalog, getAniList, mapAniList } from './anilist';
import { allTmdb, clearTmdbCatalog, getTmdb, mapTmdb, tmdbRequest } from './tmdb';
import { collectExternal, searchCatalog } from './collect';
import { publicImage, sortExternal } from './shared';
const fetcher = vi.fn<typeof fetch>();
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const tvEntry: WatchEntry = { provider: 'tvmaze', id: '42', kind: 'series', title: 'Private fallback title' };
const kitsuEntry: WatchEntry = { provider: 'kitsu', id: '77', kind: 'anime', title: 'Private fallback title' };
const aniEntry: WatchEntry = { provider: 'anilist', id: '88', kind: 'anime', title: 'Private fallback title' };
const movieEntry: WatchEntry = { provider: 'tmdb', id: '99', kind: 'movie', title: 'Private fallback title' };
const connection: IntegrationInstance = { id: 'tmdb-fictional', type: 'tmdb', name: 'Movie catalogue', settings: { url: 'https://private.example.com', username: 'private-user' }, secrets: { apiKey: 'fictional-v3', password: 'private-password' } };
const finish = async <T>(promise: Promise<T>) => { await vi.runAllTimersAsync(); return promise; };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(Date.parse('2026-10-21T00:00:00Z'));
  clearTvMazeCatalog(); clearKitsuCatalog(); clearAniListCatalog(); clearTmdbCatalog();
  state.instances = []; vi.stubGlobal('fetch', fetcher); fetcher.mockReset();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function serve() {
  fetcher.mockImplementation(async input => {
    const url = String(input);
    if (url.includes('graphql.anilist.co')) return answer({ data: { Media: fixture.anilist } });
    if (url.includes('kitsu.app')) return answer({ data: url.includes('/anime/77') ? fixture.kitsu : [fixture.kitsu] });
    if (url.includes('themoviedb.org')) return answer(url.includes('/search/') ? { results: [{ ...fixture.movie, media_type: 'movie' }, { ...fixture.tv, media_type: 'tv' }, { id: 1, media_type: 'person' }] } : url.includes('/upcoming') ? { results: [fixture.movie] } : url.includes('/on_the_air') ? { results: [fixture.tv] } : url.includes('/tv/') ? fixture.tv : fixture.movie);
    if (url.includes('/search/shows')) return answer([{ show: fixture.tvmaze }]);
    if (url.includes('/schedule/web')) return answer([{ ...fixture.next, number: 1, _embedded: { show: fixture.tvmaze } }, { ...fixture.next, number: 2, _embedded: { show: { ...fixture.tvmaze, id: 43 } } }]);
    if (url.endsWith('/episodes/123')) return answer(fixture.next);
    if (url.endsWith('/episodes/122')) return answer(fixture.previous);
    return answer(fixture.tvmaze);
  });
}
describe('TVMaze catalogue', () => {
  it('maps season continuity, images, ended and undated states', () => {
    expect(mapTvMaze(tvEntry, fixture.tvmaze, fixture.next, fixture.previous)).toMatchObject({ status: 'airing', phase: 'current', season: 3, episode: 2, poster: fixture.tvmaze.image.original });
    expect(mapTvMaze(tvEntry, fixture.tvmaze, fixture.next, { season: 2 })).toMatchObject({ status: 'upcoming', phase: 'announced' });
    for (const status of ['Running', 'To Be Determined', 'In Development']) expect(mapTvMaze(tvEntry, { ...fixture.tvmaze, status })).toMatchObject({ status: 'announced', phase: 'announced' });
    expect(mapTvMaze(tvEntry, { ...fixture.tvmaze, status: 'Ended' }, fixture.next)).toMatchObject({ status: 'ended', phase: 'announced' });
    expect(mapTvMaze(tvEntry, { ...fixture.tvmaze, image: { original: 'https://other.example.com/a.jpg' } }).poster).toBeUndefined();
  });
  it('reads only allowlisted episode links and caches entries for six hours, searches for ten minutes', async () => {
    serve();
    const item = await finish(getTvMaze(tvEntry)); expect(item.status).toBe('airing'); expect(fetcher).toHaveBeenCalledTimes(3);
    await getTvMaze(tvEntry); expect(fetcher).toHaveBeenCalledTimes(3);
    await finish(searchTvMaze('query & title')); await searchTvMaze('query & title'); expect(fetcher).toHaveBeenCalledTimes(4);
    vi.setSystemTime(Date.now() + 600000); await finish(searchTvMaze('query & title')); expect(fetcher).toHaveBeenCalledTimes(5);
    vi.setSystemTime(Date.now() + 21600000); await finish(getTvMaze(tvEntry)); expect(fetcher).toHaveBeenCalledTimes(8);
    clearTvMazeCatalog(); fetcher.mockResolvedValue(answer({ ...fixture.tvmaze, name: '', _links: { nextepisode: { href: 'https://attacker.example.com/episodes/1' }, previousepisode: { href: 'http://api.tvmaze.com/episodes/1' } } }));
    expect(await finish(getTvMaze(tvEntry))).toMatchObject({ title: tvEntry.title, status: 'announced' }); expect(fetcher).toHaveBeenCalledTimes(9);
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(/Private fallback|private-user|private-password/);
  });
  it('bounds discovery to 30 grouped premieres and search to 24 hits', async () => {
    fetcher.mockImplementation(async input => answer(Array.from({ length: 40 }, (_, n) => {
      const show = { ...fixture.tvmaze, id: n + 1, name: `Fictional series ${n}` };
      return String(input).includes('/search/') ? { show } : { ...fixture.next, number: 1, _embedded: { show } };
    })));
    expect(await finish(allTvMaze())).toHaveLength(30);
    expect(await finish(searchCatalog('fictional', ['series']))).toHaveLength(24);
  });
  it('paces seven daily schedule reads, groups season premieres and caches lists for one hour', async () => {
    serve(); const times: number[] = []; const impl = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (...args) => { times.push(Date.now()); return impl(...args); });
    const items = await finish(allTvMaze()); expect(items).toHaveLength(1); expect(items[0]).toMatchObject({ episode: 1, phase: 'announced' });
    expect(times).toHaveLength(7); expect(times.slice(1).every((t, i) => t - times[i] >= 550)).toBe(true);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.tvmaze.com/schedule/web?date=2026-10-21'); expect(fetcher.mock.calls[6][0]).toBe('https://api.tvmaze.com/schedule/web?date=2026-10-27');
    await allTvMaze(); expect(fetcher).toHaveBeenCalledTimes(7);
    vi.setSystemTime(Date.now() + 3600000); await finish(allTvMaze()); expect(fetcher).toHaveBeenCalledTimes(14);
  });
});
describe('anime catalogues', () => {
  it('maps Kitsu statuses, dates, fallback titles and both allowed CDNs', async () => {
    expect(mapKitsu(kitsuEntry, fixture.kitsu)).toMatchObject({ status: 'airing', phase: 'current', at: Date.parse(fixture.kitsu.attributes.nextRelease), poster: fixture.kitsu.attributes.posterImage.medium, backdrop: fixture.kitsu.attributes.coverImage.original });
    for (const status of ['upcoming', 'tba', 'unreleased']) {
      expect(mapKitsu(kitsuEntry, { ...fixture.kitsu, attributes: { ...fixture.kitsu.attributes, status } })).toMatchObject({ status: 'upcoming', phase: 'announced', at: Date.parse('2026-10-01') });
      expect(mapKitsu(kitsuEntry, { ...fixture.kitsu, attributes: { status } })).toMatchObject({ status: 'announced', title: kitsuEntry.title });
    }
    expect(mapKitsu(kitsuEntry, { ...fixture.kitsu, attributes: { status: 'finished' } }).status).toBe('ended');
    serve(); await finish(Promise.all([getKitsu(kitsuEntry), searchKitsu('two words'), allKitsu()]));
    expect(fetcher.mock.calls.every(([, init]) => objectHeaders(init).Accept === 'application/vnd.api+json')).toBe(true);
    const urls = fetcher.mock.calls.map(([url]) => String(url)); expect(urls).toContain('https://kitsu.app/api/edge/anime?filter[text]=two%20words&page[limit]=10');
    expect(urls).toContain('https://kitsu.app/api/edge/anime?filter[status]=upcoming&sort=popularityRank&page[limit]=20');
  });
  it('maps AniList status/date and posts only catalogue id variables', async () => {
    serve(); expect(await finish(getAniList(aniEntry))).toMatchObject({ status: 'airing', phase: 'current', episode: 3 });
    const [, init] = fetcher.mock.calls[0]; expect(init?.method).toBe('POST'); expect(JSON.parse(String(init?.body)).variables).toEqual({ id: 88 });
    expect(mapAniList(aniEntry, { ...fixture.anilist, status: 'FINISHED' })).toMatchObject({ status: 'ended', phase: 'announced' });
    expect(mapAniList(aniEntry, { ...fixture.anilist, status: 'NOT_YET_RELEASED', nextAiringEpisode: null })).toMatchObject({ status: 'upcoming', at: Date.UTC(2026, 9, 1) });
    expect(mapAniList(aniEntry, { id: 88, status: 'NOT_YET_RELEASED' })).toMatchObject({ status: 'announced', title: aniEntry.title });
  });
  it('deduplicates anime search titles and tolerates AniList 403s while Kitsu answers', async () => {
    serve(); expect(await finish(searchCatalog('lantern', ['anime']))).toHaveLength(1);
    clearAniListCatalog(); fetcher.mockImplementation(async input => String(input).includes('anilist') ? answer({ error: 'temporarily disabled' }, 403) : answer({ data: String(input).includes('/anime/77') ? fixture.kitsu : [fixture.kitsu] }));
    expect(await finish(searchCatalog('other query', ['anime']))).toMatchObject([{ provider: 'kitsu' }]);
    const result = await finish(collectExternal({ mode: 'watchlist', kinds: ['anime'], watchlist: [aniEntry, kitsuEntry] }, false));
    expect(result.external).toHaveLength(1); expect(result.failures).toEqual([{ id: 'external', name: 'AniList', error: 'widgets.error.http' }]);
  });
});
function objectHeaders(init?: RequestInit) { return init?.headers as Record<string, string>; }
describe('TMDB and privacy', () => {
  it('never contacts TMDB without a saved connection', async () => {
    serve(); expect(await searchCatalog('movie', ['movie'])).toEqual([]); expect(fetcher).not.toHaveBeenCalled();
    const result = await collectExternal({ mode: 'watchlist', watchlist: [movieEntry], kinds: ['movie'] }, false);
    expect(result.external).toEqual([]); expect(result.failures).toMatchObject([{ name: 'TMDB' }]); expect(fetcher).not.toHaveBeenCalled();
  });
  it('places v3 authentication in the query and JWT read tokens only in Authorization', async () => {
    serve(); await finish(tmdbRequest(connection, '/movie/99'));
    expect(fetcher.mock.calls[0][0]).toBe('https://api.themoviedb.org/3/movie/99?api_key=fictional-v3'); expect(objectHeaders(fetcher.mock.calls[0][1]).Authorization).toBeUndefined();
    const jwt = { ...connection, secrets: { apiKey: 'eyJhbGci.eyJhdWQi.signature' } };
    await finish(tmdbRequest(jwt, '/tv/100')); expect(fetcher.mock.calls[1][0]).toBe('https://api.themoviedb.org/3/tv/100'); expect(objectHeaders(fetcher.mock.calls[1][1]).Authorization).toBe(`Bearer ${jwt.secrets.apiKey}`);
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(/private.example|private-user|private-password/);
    for (const [, init] of fetcher.mock.calls) { expect(init?.redirect).toBe('error'); expect(init?.signal).toBeDefined(); expect(objectHeaders(init)['User-Agent']).toBe('NasDash'); }
  });
  it('maps movies and TV details, and reads first-page discovery lists', async () => {
    serve(); state.instances = [connection];
    expect(await finish(getTmdb(movieEntry, connection))).toMatchObject({ status: 'upcoming', phase: 'announced', poster: 'https://image.tmdb.org/t/p/w342/fictional.jpg', backdrop: 'https://image.tmdb.org/t/p/w780/fictional-backdrop.jpg' });
    expect(mapTmdb(movieEntry, { ...fixture.movie, status: 'Released' })).toMatchObject({ status: 'airing', phase: 'current' });
    for (const status of ['Planned', 'Post Production', 'In Production']) expect(mapTmdb(movieEntry, { ...fixture.movie, status, release_date: '' }).status).toBe('announced');
    const tvEntry = { ...movieEntry, kind: 'series' as const, id: '100' };
    expect(mapTmdb(tvEntry, fixture.tv)).toMatchObject({ status: 'airing', season: 2, episode: 4, phase: 'current' });
    expect(mapTmdb(tvEntry, { ...fixture.tv, last_episode_to_air: { season_number: 1 } }).status).toBe('upcoming');
    expect(mapTmdb(tvEntry, { ...fixture.tv, status: 'Ended' })).toMatchObject({ status: 'ended', phase: 'announced' });
    const hits = await finish(searchCatalog('aurora', ['movie', 'series'])); expect(hits.filter(hit => hit.provider === 'tmdb')).toHaveLength(2);
    expect(await finish(allTmdb(connection, ['movie', 'series']))).toHaveLength(2);
    const urls = fetcher.mock.calls.map(([url]) => String(url)); expect(urls.some(url => url.includes('/movie/upcoming?page=1&'))).toBe(true); expect(urls.some(url => url.includes('/tv/on_the_air?page=1&'))).toBe(true);
  });
  it('sends only catalogue ids, never fallback titles or unrelated saved data, with bounded request options', async () => {
    serve(); state.instances = [connection];
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    await finish(collectExternal({ mode: 'watchlist', kinds: ['series', 'anime', 'movie'], watchlist: [tvEntry, kitsuEntry, aniEntry, movieEntry] }, false));
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(/Private fallback title|private-user|private-password|private.example/);
    expect(timeout.mock.calls.every(([ms]) => ms === 10000)).toBe(true); timeout.mockRestore();
    for (const [url, init] of fetcher.mock.calls) {
      expect(init?.redirect).toBe('error'); expect(init?.signal).toBeDefined(); expect(objectHeaders(init)['User-Agent']).toBe('NasDash');
      if (!String(url).includes('api.themoviedb.org')) expect(JSON.stringify([url, init])).not.toContain(connection.secrets!.apiKey);
    }
  });
  it('allowlists images using exact https hosts and rejects credentials and URL tricks', () => {
    for (const host of ['static.tvmaze.com', 'media.kitsu.app', 'media.kitsu.io', 's4.anilist.co']) {
      expect(publicImage(`https://${host}/image.jpg`, [host])).toBe(`https://${host}/image.jpg`);
      for (const value of [`http://${host}/image.jpg`, `https://${host}.attacker.example/image.jpg`, `https://user:password@${host}/image.jpg`, `https://${host}:8080/image.jpg`, `https://${host}\\@attacker.example/image.jpg`]) expect(publicImage(value, [host])).toBeUndefined();
    }
    expect(mapTmdb(movieEntry, { ...fixture.movie, poster_path: '//attacker.example/a.jpg' }).poster).toBeUndefined();
    expect(mapKitsu(kitsuEntry, { ...fixture.kitsu, attributes: { posterImage: { medium: 'https://attacker.example/a.jpg' } } }).poster).toBeUndefined();
    expect(mapAniList(aniEntry, { ...fixture.anilist, coverImage: { extraLarge: 'http://s4.anilist.co/a.jpg' } }).poster).toBeUndefined();
  });
  it('sorts dates first and keeps ended last only when requested', async () => {
    serve(); const current = mapKitsu(kitsuEntry, fixture.kitsu), ended = { ...current, id: 'ended', status: 'ended' as const, at: 1 }, announced = { ...current, id: 'undated', status: 'announced' as const, at: undefined };
    expect(sortExternal([ended, announced, current]).map(item => item.id)).toEqual([current.id, 'undated', 'ended']);
    fetcher.mockResolvedValue(answer({ data: { ...fixture.kitsu, attributes: { ...fixture.kitsu.attributes, status: 'finished' } } }));
    expect((await finish(collectExternal({ mode: 'watchlist', kinds: ['anime'], watchlist: [kitsuEntry] }, false))).external).toEqual([]);
    expect((await collectExternal({ mode: 'watchlist', kinds: ['anime'], watchlist: [kitsuEntry] }, true)).external[0].status).toBe('ended');
  });
});
describe('provider pacing and retry', () => {
  it.each(['kitsu', 'anilist', 'tmdb'] as const)('paces %s and retries 429 once after two seconds', async provider => {
    const times: number[] = [], interval = { kitsu: 250, anilist: 700, tmdb: 100 }[provider];
    fetcher.mockImplementation(async () => { times.push(Date.now()); return times.length === 1 ? answer({}, 429) : answer(provider === 'kitsu' ? { data: fixture.kitsu } : provider === 'anilist' ? { data: { Media: fixture.anilist } } : fixture.movie); });
    const load: () => Promise<unknown> = provider === 'kitsu' ? () => getKitsu(kitsuEntry) : provider === 'anilist' ? () => getAniList(aniEntry) : () => tmdbRequest(connection, '/movie/99');
    await finish(load()); expect(times[1] - times[0]).toBeGreaterThanOrEqual(2000);
    if (provider === 'kitsu') await finish(getKitsu({ ...kitsuEntry, id: '78' }));
    else if (provider === 'anilist') await finish(getAniList({ ...aniEntry, id: '89' }));
    else await finish(tmdbRequest(connection, '/movie/100'));
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(interval);
    clearKitsuCatalog(); clearAniListCatalog(); clearTmdbCatalog(); fetcher.mockResolvedValue(answer({}, 429));
    const rejected = expect(load()).rejects.toThrow(); await vi.runAllTimersAsync(); await rejected;
  });
});
