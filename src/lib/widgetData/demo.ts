import type { MarketRange, MarketsResponse, QuotesResponse, RssResponse } from './contracts';

/**
 * Fictional fixtures: no saved feed, symbol, quote or credential is used.
 * Dates follow the current hour so the demo reads "2 h ago", not months.
 */
const HOUR = 3_600_000;
const demoNow = () => Math.floor(Date.now() / HOUR) * HOUR;

export function demoRss(): RssResponse {
  const now = demoNow();
  const item = (feed: string, n: number, title: string, hoursAgo: number, summary: string) => ({ id: `demo:${feed}:${n}`, title, link: `https://${feed}.example/${n}`, date: now - hoursAgo * HOUR, summary });
  return { fetchedAt: now, errors: [], feeds: [
    { source: 'https://news.example/feed.xml', title: 'Homelab Gazette', site: 'https://news.example/', items: [
      item('news', 1, 'A quieter home server', 1, 'A fictional community shares ideas for a calm and efficient homelab.'),
      item('news', 2, 'The weekend backup club', 5, 'Imaginary neighbors practice restoring their sample files.'),
      item('news', 3, 'Labeling every cable, one shelf at a time', 26, 'A made-up guide to tidy racks and readable patch panels.'),
    ] },
    { source: 'https://selfhost.example/rss', title: 'Self-host Weekly', site: 'https://selfhost.example/', items: [
      item('selfhost', 1, 'Five dashboards compared on a rainy Sunday', 3, 'Sample notes about layouts, widgets and calm defaults.'),
      item('selfhost', 2, 'Why the test VM keeps its own snapshot', 9, 'A fictional story about restoring before upgrading.'),
      item('selfhost', 3, 'Low-power storage for a small apartment', 50, 'Imaginary measurements of idle watts and noise.'),
    ] },
  ] };
}

const DEMO_TICKERS = [
  { symbol: 'DEMO', name: 'Fictional Cloud Cooperative', currency: 'USD', price: 104, previousClose: 100 },
  { symbol: 'ACME', name: 'Acme Example Robotics', currency: 'USD', price: 57.4, previousClose: 58.9 },
  { symbol: 'ORBT', name: 'Orbit Sample Networks', currency: 'EUR', price: 212.1, previousClose: 209.5 },
  { symbol: 'NOVA-USD', name: 'Nova Example Token', currency: 'USD', price: 1.82, previousClose: 1.75 },
] as const;

/** A believable price path from the previous close to today's price (deterministic per symbol). */
function walk(from: number, to: number, seed: number, length = 78): number[] {
  let state = 2_166_136_261 ^ (seed + 1) * 16_777_619;
  const noise = () => { state = (state * 1_103_515_245 + 12_345) >>> 0; return state / 2 ** 32 - 0.5; };
  // A random walk pinned to both ends (Brownian bridge), with small steps.
  const scale = Math.abs(to - from || from * 0.01) * 0.12;
  const steps: number[] = [0];
  for (let i = 1; i < length; i++) steps.push(steps[i - 1] + noise() * scale);
  const end = steps[length - 1];
  return steps.map((step, i) => from + (to - from) * (i / (length - 1)) + step - end * (i / (length - 1)));
}

/** Fictional rates from one US dollar, so the demo can show the currency choice without any request. */
const DEMO_FX: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79, CHF: 0.88, JPY: 150, CAD: 1.36, AUD: 1.52, CNY: 7.2, HKD: 7.8, SEK: 10.5, NOK: 10.7, DKK: 6.9, PLN: 3.9, INR: 83, BRL: 5.1, KRW: 1350 };

export function demoMarkets(range: MarketRange = '1d', currency?: string): MarketsResponse {
  const now = demoNow();
  const step = range === '1d' ? 300_000 : range === '5d' ? 1_800_000 : range === '1mo' ? 9 * HOUR : 2 * 24 * HOUR;
  const quotes = DEMO_TICKERS.map((ticker, index) => {
    const change = ticker.price - ticker.previousClose;
    return {
      ...ticker, exchange: 'Example Exchange', change, changePercent: (change / ticker.previousClose) * 100, marketState: 'open' as const, time: now,
      // A gentle wave from the previous close to today's price.
      points: walk(ticker.previousClose, ticker.price, index).map((value, i, all): [number, number] => [now - (all.length - 1 - i) * step, value]),
    };
  });
  const to = currency && DEMO_FX[currency] ? currency : undefined;
  return { range, fetchedAt: now, errors: [], quotes: !to ? quotes : quotes.map(quote => {
    const factor = DEMO_FX[to] / (DEMO_FX[quote.currency ?? 'USD'] ?? 1);
    return { ...quote, currency: to, price: quote.price * factor, change: quote.change * factor, previousClose: quote.previousClose * factor, points: quote.points.map(([time, value]) => [time, value * factor] as [number, number]) };
  }) };
}
export function demoQuotes(): QuotesResponse {
  return { quotes: [
    { id: 'demo:quote:1', text: 'A little curiosity makes room for a new idea.', author: 'Ada Example', work: 'Fictional notebook', language: 'en' },
    { id: 'demo:quote:2', text: 'Every small garden begins with one patient seed.', author: 'Leo Example', work: 'Fictional notebook', language: 'en' },
  ].map(quote => ({ ...quote, source: 'zenquotes' })), errors: [], attributions: [{ source: 'zenquotes', label: 'Example quotes', url: 'https://quotes.example/' }] };
}
