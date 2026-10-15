import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mapMarketSearch, marketSearchCache, searchMarkets } from './markets';

beforeEach(() => marketSearchCache.clear());
afterEach(() => vi.unstubAllGlobals());

it('maps Yahoo results to names, kinds and exchanges, dropping unusable symbols', () => {
  expect(mapMarketSearch({ quotes: [
    { symbol: 'BTC-USD', shortname: 'Bitcoin USD', quoteType: 'CRYPTOCURRENCY', exchDisp: 'CCC' },
    { symbol: '^FCHI', shortname: 'CAC 40', quoteType: 'INDEX', exchDisp: 'Paris' },
    { symbol: 'bad symbol!', shortname: 'Nope', quoteType: 'EQUITY' },
    { symbol: 'XYZ', quoteType: 'SOMETHING' },
  ] })).toEqual([
    { symbol: 'BTC-USD', name: 'Bitcoin USD', kind: 'crypto', exchange: 'CCC' },
    { symbol: '^FCHI', name: 'CAC 40', kind: 'index', exchange: 'Paris' },
    { symbol: 'XYZ', name: 'XYZ', kind: 'other' },
  ]);
  expect(mapMarketSearch(null)).toEqual([]);
});

it('only queries the fixed Yahoo endpoint, with the text encoded, and caches by text', async () => {
  const fetch = vi.fn(async (_url: URL) => new Response(JSON.stringify({ quotes: [{ symbol: 'AAPL', shortname: 'Apple Inc.', quoteType: 'EQUITY' }] })));
  vi.stubGlobal('fetch', fetch);
  expect(await searchMarkets(' Apple&x=1 ')).toEqual([{ symbol: 'AAPL', name: 'Apple Inc.', kind: 'stock' }]);
  const url = new URL(String(fetch.mock.calls[0][0]));
  expect(url.origin + url.pathname).toBe('https://query1.finance.yahoo.com/v1/finance/search');
  expect(url.searchParams.get('q')).toBe('Apple&x=1');
  await searchMarkets('apple&x=1');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(await searchMarkets('   ')).toEqual([]);
});
