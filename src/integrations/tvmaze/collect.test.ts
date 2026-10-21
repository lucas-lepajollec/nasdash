import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from './samples/service.json';
import { clearTvMazeCache, tvMazeShow } from './collect';
import { toFollowUp, sortFollowUps } from '@/lib/widgetData/libraryUpcoming';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
const fetcher = vi.fn<typeof fetch>();
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(Date.parse('2026-10-21T00:00:00Z')); clearTvMazeCache(); vi.stubGlobal('fetch', fetcher); fetcher.mockReset(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const finish = async <T>(promise: Promise<T>) => { await vi.runAllTimersAsync(); return promise; };
function serve(show: unknown = fixture.running) {
  fetcher.mockImplementation(async input => String(input).includes('/lookup/') ? answer(fixture.lookup) : String(input).includes('/shows/') ? answer(show) : answer(fixture.episode));
}
describe('TVMaze provider-only reads', () => {
  it('uses a lookup then show then episode without embeds or library data, and shares caches', async () => {
    serve();
    const [show] = await finish(Promise.all([tvMazeShow({ tvdb: '12345', imdb: 'tt98765' }), tvMazeShow({ tvdb: '12345' })]));
    expect(show).toMatchObject({ status: 'Running', network: 'Lantern Television', next: { season: 3, episode: 1, title: 'A New Horizon', at: Date.parse(fixture.episode.airstamp) } });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['https://api.tvmaze.com/lookup/shows?thetvdb=12345', 'https://api.tvmaze.com/shows/42', 'https://api.tvmaze.com/episodes/123']);
    expect(fetcher.mock.calls.every(([, options]) => options?.headers && JSON.stringify(options.headers) === '{"User-Agent":"NasDash"}' && options.signal && options.redirect === (String(fetcher.mock.calls.find(call => call[1] === options)?.[0]).includes('/lookup/') ? 'manual' : 'error'))).toBe(true);
    await finish(Promise.all([tvMazeShow({ tvdb: '12345' }), tvMazeShow({ tvdb: '12345' })])); expect(fetcher).toHaveBeenCalledTimes(3);
    vi.setSystemTime(Date.now() + 21600000); await finish(tvMazeShow({ tvdb: '12345' })); expect(fetcher).toHaveBeenCalledTimes(5);
    vi.setSystemTime(Date.now() + 86400000); await finish(tvMazeShow({ tvdb: '12345' })); expect(fetcher).toHaveBeenCalledTimes(8);
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(/embed|Private library title|fictional-key|password|token/);
  });
  it('normalizes imdb, skips unknown providers and caches 404s', async () => {
    fetcher.mockResolvedValue(answer({}, 404));
    expect(await finish(tvMazeShow({ imdb: '98765' }))).toBeNull();
    expect(fetcher.mock.calls[0][0]).toBe('https://api.tvmaze.com/lookup/shows?imdb=tt98765');
    expect(await tvMazeShow({ imdb: 'tt98765' })).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(1);
    for (const provider of [{}, { tvdb: 'Private library title' }, { imdb: 'tt1&token=secret' }]) expect(await tvMazeShow(provider)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('spaces calls and retries 429 once after two seconds', async () => {
    const times: number[] = [];
    fetcher.mockImplementation(async () => { times.push(Date.now()); return times.length === 1 ? answer({}, 429) : times.length === 2 ? answer(fixture.lookup) : answer(fixture.ended); });
    expect((await finish(tvMazeShow({ tvdb: '12345' })))?.status).toBe('Ended');
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(2000); expect(times[2] - times[1]).toBeGreaterThanOrEqual(550);
    clearTvMazeCache(); fetcher.mockResolvedValue(answer({}, 429));
    const rejected = expect(tvMazeShow({ tvdb: '12346' })).rejects.toThrow(); await vi.runAllTimersAsync(); await rejected;
  });
  it('does not follow arbitrary next-episode URLs, and supports a fixture base', async () => {
    serve({ ...fixture.running, _links: { nextepisode: { href: 'https://other.example.com/episodes/123?token=secret' } } });
    expect((await finish(tvMazeShow({ tvdb: '12345' }, 'https://fixture.example.com')))?.next).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2); expect(String(fetcher.mock.calls[0][0])).toMatch(/^https:\/\/fixture.example.com/);
  });
  it('bounds concurrent requests globally across provider lookups', async () => {
    let active = 0, peak = 0;
    fetcher.mockImplementation(async input => {
      active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 5000)); active--;
      return answer(String(input).includes('/lookup/') ? fixture.lookup : fixture.ended);
    });
    await finish(Promise.all(Array.from({ length: 12 }, (_, n) => tvMazeShow({ tvdb: String(n + 1) }))));
    expect(peak).toBe(6); expect(active).toBe(0); expect(fetcher).toHaveBeenCalledTimes(24);
  });
  it('uses airdate when airstamp is absent and maps streaming networks', async () => {
    fetcher.mockImplementation(async input => String(input).includes('/lookup/') ? answer(fixture.lookup) : String(input).includes('/shows/') ? answer({ ...fixture.running, network: null, webChannel: { name: 'Fictional Stream' } }) : answer({ ...fixture.episode, airstamp: undefined }));
    expect(await finish(tvMazeShow({ tvdb: '12345' }))).toMatchObject({ network: 'Fictional Stream', next: { at: Date.parse(fixture.episode.airdate) } });
  });
});
describe('follow-up status mapping', () => {
  const item = { id: 'local-id', title: 'Local title', kind: 'series' as const, poster: '/local-art', link: 'https://media.example.com/web' };
  it.each([['Running', 'announced'], ['To Be Determined', 'announced'], ['In Development', 'announced'], ['Ended', 'ended']] as const)('maps %s without a date', (status, expected) => {
    expect(toFollowUp(item, { status }, 2)).toMatchObject({ status: expected, ownedSeason: 2, poster: '/local-art' });
  });
  it('distinguishes new seasons, ongoing seasons and undated episodes and sorts all statuses', () => {
    const next = { at: 200, season: 3, episode: 1, title: 'Next' };
    const upcoming = toFollowUp(item, { status: 'Running', next }, 2)!;
    const airing = toFollowUp(item, { status: 'Running', next: { ...next, at: 100 } }, 3)!;
    const announced = toFollowUp(item, { status: 'Running', next: { ...next, at: undefined } }, 2)!;
    const ended = toFollowUp(item, { status: 'Ended', next }, 2)!;
    expect(upcoming.status).toBe('upcoming'); expect(airing.status).toBe('airing'); expect(announced.status).toBe('announced'); expect(ended.at).toBeUndefined();
    expect(sortFollowUps([ended, announced, upcoming, airing]).map(item => item.status)).toEqual(['airing', 'upcoming', 'announced', 'ended']);
    expect(toFollowUp(item, { status: 'Unknown' })).toBeUndefined();
  });
});

describe('TVMaze lookup redirect', () => {
  it('reads the show id from the 301 the real lookup answers, without following it', async () => {
    fetcher.mockImplementation(async (input, options) => {
      if (String(input).includes('/lookup/')) { expect(options?.redirect).toBe('manual'); return new Response(null, { status: 301, headers: { Location: 'https://api.tvmaze.com/shows/42' } }); }
      return String(input).includes('/shows/') ? answer(fixture.running) : answer(fixture.episode);
    });
    expect(await finish(tvMazeShow({ tvdb: '12345' }))).toMatchObject({ status: 'Running' });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['https://api.tvmaze.com/lookup/shows?thetvdb=12345', 'https://api.tvmaze.com/shows/42', 'https://api.tvmaze.com/episodes/123']);
  });
  it('ignores a redirect elsewhere', async () => {
    fetcher.mockResolvedValue(new Response(null, { status: 301, headers: { Location: 'https://attacker.example.com/shows/42' } }));
    expect(await finish(tvMazeShow({ tvdb: '777' }))).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
