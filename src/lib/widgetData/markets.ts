import type { MarketQuote, MarketRange, MarketsResponse } from './contracts';
import { TtlCache } from './cache';
import { fetchJson, sourceError, WidgetFetchError } from './outbound';

export const MARKET_INTERVALS = { '1d': '5m', '5d': '30m', '1mo': '1d', '6mo': '1d', '1y': '1wk' } as const;
export function marketRange(value: unknown): MarketRange | undefined {
  return typeof value === 'string' && Object.hasOwn(MARKET_INTERVALS, value) ? value as MarketRange : undefined;
}
export const marketDayCache = new TtlCache<{ quote: MarketQuote; fetchedAt: number }>(60000, 200, 3600000);
export const marketHistoryCache = new TtlCache<{ quote: MarketQuote; fetchedAt: number }>(900000, 200, 3600000);
let yahooBackoffUntil = 0;
export function resetMarketBackoff(): void { yahooBackoffUntil = 0; }
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export function downsample(points: [number, number][], max = 120): [number, number][] {
  if (points.length <= max) return points;
  return Array.from({ length: max }, (_, i) => points[Math.round(i * (points.length - 1) / (max - 1))]);
}
export function mapMarket(data: unknown, symbol: string, range: MarketRange): MarketQuote {
  try { return parseMarket(data, symbol, range); }
  catch (error) {
    if (error instanceof WidgetFetchError) throw error;
    throw new WidgetFetchError('widgets.error.parse');
  }
}
function parseMarket(data: unknown, symbol: string, range: MarketRange): MarketQuote {
  const chart = (data as { chart?: { result?: Array<{ meta?: Record<string, unknown>; timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> } } | null)?.chart;
  const result = chart?.result?.[0];
  if (!result?.meta) throw new WidgetFetchError('widgets.error.parse');
  const meta = result.meta;
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const points: [number, number][] = (result.timestamp ?? []).flatMap((time, i) => finite(time) && finite(closes[i]) ? [[time * 1000, closes[i] as number] as [number, number]] : []).sort((a, b) => a[0] - b[0]);
  const price = finite(meta.regularMarketPrice) ? meta.regularMarketPrice : points.at(-1)?.[1];
  if (!finite(price)) throw new WidgetFetchError('widgets.error.parse');
  const reference = range === '1d' ? (finite(meta.chartPreviousClose) ? meta.chartPreviousClose : finite(meta.previousClose) ? meta.previousClose : undefined) : points[0]?.[1];
  const change = reference === undefined ? 0 : price - reference;
  const states: Record<string, MarketQuote['marketState']> = { REGULAR: 'open', OPEN: 'open', CLOSED: 'closed', PRE: 'pre', PREPRE: 'pre', POST: 'post', POSTPOST: 'post' };
  const string = (v: unknown) => typeof v === 'string' ? v : undefined;
  return { symbol, name: string(meta.shortName) || string(meta.longName) || symbol, currency: string(meta.currency), exchange: string(meta.exchangeName), price,
    ...(reference === undefined ? {} : { previousClose: reference }), change, changePercent: reference ? change / reference * 100 : 0,
    points: downsample(points), marketState: states[String(meta.marketState).toUpperCase()], time: finite(meta.regularMarketTime) ? meta.regularMarketTime * 1000 : points.at(-1)?.[0] ?? Date.now() };
}
export async function loadMarkets(settings: Record<string, unknown>, override?: unknown): Promise<MarketsResponse> {
  const range = marketRange(override) ?? marketRange(settings.range) ?? '1d';
  const symbols = Array.isArray(settings.symbols) ? settings.symbols.slice(0, 20) : [];
  const cache = range === '1d' ? marketDayCache : marketHistoryCache;
  const results = await Promise.all(symbols.map(async symbol => {
    try {
      if (typeof symbol !== 'string' || !/^[A-Za-z0-9.^=\-_]{1,20}$/.test(symbol)) throw new WidgetFetchError('widgets.error.parse');
      return await cache.get(`${symbol}:${range}`, async () => {
        if (Date.now() < yahooBackoffUntil) throw new WidgetFetchError('widgets.error.http', { status: 429 });
        try {
          const data = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${MARKET_INTERVALS[range]}&includePrePost=false`);
          return { quote: mapMarket(data, symbol, range), fetchedAt: Date.now() };
        } catch (error) {
          if (error instanceof WidgetFetchError && error.parameters?.status === 429) yahooBackoffUntil = Date.now() + 120000;
          throw error;
        }
      });
    } catch (error) { return sourceError(typeof symbol === 'string' ? symbol : '', error); }
  }));
  const good = results.filter((r): r is { quote: MarketQuote; fetchedAt: number } => 'quote' in r);
  return { range, quotes: good.map(r => r.quote), errors: results.filter((r): r is ReturnType<typeof sourceError> => 'error' in r), fetchedAt: good.length ? Math.min(...good.map(r => r.fetchedAt)) : Date.now() };
}

/** What a symbol is, as shown next to search results and saved symbols. */
export type MarketKind = 'stock' | 'etf' | 'fund' | 'index' | 'crypto' | 'currency' | 'future' | 'other';
export interface MarketSearchResult { symbol: string; name: string; kind: MarketKind; exchange?: string }

const KINDS: Record<string, MarketKind> = {
  EQUITY: 'stock', ETF: 'etf', MUTUALFUND: 'fund', INDEX: 'index', CRYPTOCURRENCY: 'crypto', CURRENCY: 'currency', FUTURE: 'future',
};
export const marketSearchCache = new TtlCache<MarketSearchResult[]>(3_600_000, 300);

/** Yahoo search results, reduced to what the watchlist needs (names over symbols). */
export function mapMarketSearch(data: unknown): MarketSearchResult[] {
  const quotes = data && typeof data === 'object' && Array.isArray((data as { quotes?: unknown }).quotes) ? (data as { quotes: unknown[] }).quotes : [];
  return quotes.flatMap(raw => {
    const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const symbol = typeof item.symbol === 'string' ? item.symbol : '';
    if (!/^[A-Za-z0-9.^=_-]{1,20}$/.test(symbol)) return [];
    const name = [item.shortname, item.longname].find((value): value is string => typeof value === 'string' && value.trim() !== '')?.trim() ?? symbol;
    const exchange = typeof item.exchDisp === 'string' && item.exchDisp.trim() ? item.exchDisp.trim().slice(0, 40) : undefined;
    return [{ symbol, name: name.slice(0, 80), kind: KINDS[String(item.quoteType)] ?? 'other', ...(exchange ? { exchange } : {}) }];
  }).slice(0, 8);
}

/** Search by name or symbol on the fixed Yahoo endpoint; the query is bounded and only encoded into it. */
export async function searchMarkets(query: string): Promise<MarketSearchResult[]> {
  const q = query.trim().slice(0, 40);
  if (!q) return [];
  return marketSearchCache.get(q.toLowerCase(), async () => mapMarketSearch(await fetchJson(
    `https://query1.finance.yahoo.com/v1/finance/search?${new URLSearchParams({ q, quotesCount: '8', newsCount: '0', listsCount: '0' })}`, 256 * 1024,
  )));
}
