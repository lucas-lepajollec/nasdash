import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { downsample, loadMarkets, mapMarket, marketDayCache, marketHistoryCache, resetMarketBackoff } from './markets';
const chart = { chart: { result: [{ meta: { regularMarketPrice: 120, chartPreviousClose: 100, shortName: 'Example', currency: 'USD', exchangeName: 'NasdaqGS', marketState: 'REGULAR', regularMarketTime: 1000 }, timestamp: [1, 2, 3, 4], indicators: { quote: [{ close: [80, null, 90, 120] }] } }] } };
beforeEach(() => { marketDayCache.clear(); marketHistoryCache.clear(); resetMarketBackoff(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('maps metadata, drops nulls, calculates daily and history changes', () => {
  expect(mapMarket(chart, 'EX', '1d')).toMatchObject({ symbol: 'EX', name: 'Example', price: 120, previousClose: 100, change: 20, changePercent: 20, marketState: 'open', time: 1000000, points: [[1000, 80], [3000, 90], [4000, 120]] });
  expect(mapMarket(chart, 'EX', '1mo')).toMatchObject({ previousClose: 80, change: 40, changePercent: 50 });
  const points: [number, number][] = Array.from({ length: 1000 }, (_, i) => [i, i]);
  const sampled = downsample(points);
  expect(sampled).toHaveLength(120);
  expect(sampled[0]).toEqual(points[0]); expect(sampled.at(-1)).toEqual(points.at(-1));
  expect(() => mapMarket({}, 'EX', '1d')).toThrow('widgets.error.parse');
});
it('uses validated symbols, range overrides, intervals and cache', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(chart)));
  vi.stubGlobal('fetch', fetch);
  const result = await loadMarkets({ symbols: ['EX', 'bad/symbol'], range: '1d' }, '5d');
  expect(result.range).toBe('5d'); expect(result.quotes).toHaveLength(1);
  expect(result.errors[0].error).toBe('widgets.error.parse');
  expect(String(fetch.mock.calls[0][0])).toContain('range=5d&interval=30m&includePrePost=false');
  await loadMarkets({ symbols: ['EX'] }, '5d'); expect(fetch).toHaveBeenCalledTimes(1);
});
it('serves stale on 429 and backs off Yahoo across symbols for two minutes', async () => {
  vi.useFakeTimers(); vi.setSystemTime(1000000);
  const fetch = vi.fn().mockImplementationOnce(async () => new Response(JSON.stringify(chart))).mockImplementationOnce(async () => new Response('', { status: 429 })).mockImplementation(async () => new Response(JSON.stringify(chart)));
  vi.stubGlobal('fetch', fetch);
  await loadMarkets({ symbols: ['EX'] });
  vi.advanceTimersByTime(61000);
  const stale = await loadMarkets({ symbols: ['EX'] });
  expect(stale.quotes).toHaveLength(1); expect(stale.fetchedAt).toBe(1000000);
  const blocked = await loadMarkets({ symbols: ['OTHER'] });
  expect(blocked.errors[0]).toMatchObject({ error: 'widgets.error.http', parameters: { status: 429 } });
  expect(fetch).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(120001);
  expect((await loadMarkets({ symbols: ['OTHER'] })).quotes).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(3);
});
it('maps structurally malformed Yahoo payloads to parse errors', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ chart: { result: [{ meta: { regularMarketPrice: 1 }, timestamp: 'bad' }] } }))));
  expect((await loadMarkets({ symbols: ['EX'] })).errors[0].error).toBe('widgets.error.parse');
});
