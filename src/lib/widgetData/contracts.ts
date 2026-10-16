/**
 * What the content widgets (RSS, markets, quotes, DNS, photos, bookmarks)
 * receive from their API routes. Browser-safe types only: the routes fill
 * them on the server, the widgets draw them. Texts are raw (titles, names);
 * dates are epoch milliseconds; every list is already bounded by the server.
 *
 * Every data route takes the widget instance id (`widgetId`). The server reads
 * that widget's saved settings itself (a visitor never chooses what the server
 * fetches). An admin may also send the widget's unsaved settings (`draft`) so a
 * widget being edited previews its new sources before the page is saved.
 */

/** Body of every POST data route. */
export interface WidgetDataRequest {
  widgetId: string;
  /** Admin only: the widget's current unsaved settings. Ignored for other users. */
  draft?: Record<string, unknown>;
}

/** Failure of one source inside an otherwise working answer (one feed, one symbol…). */
export interface SourceError {
  /** The configured source (feed URL, symbol…) the error belongs to. */
  source: string;
  /** Translation key (`widgets.error.timeout`, `widgets.error.http`…). */
  error: string;
  parameters?: Record<string, string | number>;
}

/* ------------------------------------------------------------------ RSS */

export interface FeedItem {
  /** Stable id (guid, else link, else title+date hash). */
  id: string;
  title: string;
  /** Absolute http(s) link, or absent. */
  link?: string;
  /** Publication date (ms), when the feed gives one. */
  date?: number;
  /** Plain text, HTML stripped, at most ~280 characters. */
  summary?: string;
  /** Absolute http(s) image (enclosure, media:thumbnail, first <img>). */
  image?: string;
  author?: string;
}

export interface Feed {
  /** The configured feed URL (identity). */
  source: string;
  title: string;
  /** Site home page, for its favicon and title link. */
  site?: string;
  items: FeedItem[];
}

/** POST /api/widgets/rss → feeds in the configured order (failed feeds are listed in `errors`). */
export interface RssResponse {
  feeds: Feed[];
  errors: SourceError[];
  /** When the server last refreshed these feeds (ms). */
  fetchedAt: number;
}

/* -------------------------------------------------------------- Markets */

export type MarketRange = '1d' | '5d' | '1mo' | '6mo' | '1y';

/** Currencies a markets widget can convert prices into (otherwise each symbol keeps its own). */
export const MARKET_CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'HKD', 'SEK', 'NOK', 'DKK', 'PLN', 'INR', 'BRL', 'KRW'] as const;
export type MarketCurrency = typeof MARKET_CURRENCIES[number];

export interface MarketQuote {
  /** As configured (`AAPL`, `BTC-USD`, `^GSPC`, `MC.PA`). */
  symbol: string;
  /** Display name from the source (`Apple Inc.`), else the symbol. */
  name: string;
  currency?: string;
  /** Exchange name (`NasdaqGS`). */
  exchange?: string;
  price: number;
  /** Reference for the change: previous close for `1d`, first point of the range otherwise. */
  previousClose?: number;
  change: number;
  changePercent: number;
  /** `[time ms, price]`, oldest first, at most ~120 points (downsampled). */
  points: [number, number][];
  /** `open`, `closed`, `pre`, `post` when the source tells. */
  marketState?: 'open' | 'closed' | 'pre' | 'post';
  /** Time of the price (ms). */
  time: number;
}

/** POST /api/widgets/markets (+ `range` in the body) → quotes in the configured order. */
export interface MarketsResponse {
  range: MarketRange;
  quotes: MarketQuote[];
  errors: SourceError[];
  fetchedAt: number;
}

/* --------------------------------------------------------------- Quotes */

export interface Quote {
  id: string;
  text: string;
  author?: string;
  /** Book, speech, film… */
  work?: string;
  /** ISO 639-1 language of the text. */
  language?: string;
  /** Online provider id, for its credit. */
  source?: string;
}

/**
 * POST /api/widgets/quotes → quotes of the online sources chosen in
 * Settings → Widgets → Quotes, with the credit their terms ask for. The
 * user's own quotes (`config.settings.quotes`) are drawn in the browser.
 */
export interface QuotesResponse {
  quotes: Quote[];
  errors: SourceError[];
  attributions?: { source: string; label: string; url: string }[];
}

/* ------------------------------------------------------------------ DNS */

/** Every DNS blocker the DNS widget reads; the one list the app uses (connections, widget, server). */
export const DNS_TYPES = ['pihole', 'adguard', 'technitium'] as const;
export type DnsProvider = typeof DNS_TYPES[number];

export interface DnsTopEntry { name: string; count: number }

/** GET /api/widgets/dns?widgetId=… → the summary of the widget's Pi-hole / AdGuard Home / Technitium connection. */
export interface DnsSummary {
  provider: DnsProvider;
  /** Connection name (`config.integrations[].name`). */
  name: string;
  /** Blocking on (`false` while paused/disabled); absent when the key may not read it (Technitium without settings access). */
  blocking?: boolean;
  /** `false` when the saved credential may not pause blocking: no switch is shown. */
  canToggle?: boolean;
  /** When a timed pause ends (ms), if any. */
  blockingResumesAt?: number;
  queries: number;
  blocked: number;
  /** 0–100. */
  blockedPercent: number;
  /** Domains on the block lists (gravity / filter rules). */
  listedDomains?: number;
  clients?: number;
  /** Average processing time (ms), AdGuard only. */
  averageMs?: number;
  /** Answered from the cache / resolved recursively (Technitium). */
  cached?: number;
  recursive?: number;
  /** Last 24 h, oldest first: `[time ms, queries, blocked]`, ~24–144 points. */
  history: [number, number, number][];
  topBlocked: DnsTopEntry[];
  topClients: DnsTopEntry[];
  topQueried: DnsTopEntry[];
  fetchedAt: number;
}

/** POST /api/widgets/dns { widgetId, blocking: boolean, durationSeconds?: number } (admin) → the new summary. */
export interface DnsToggleRequest { widgetId: string; blocking: boolean; durationSeconds?: number }

/* --------------------------------------------------------------- Photos */

export const PHOTO_TYPES = ['immich', 'photoprism'] as const;
export type PhotoProvider = typeof PHOTO_TYPES[number];

export interface Photo {
  /** Provider asset id (opaque). */
  id: string;
  /** Proxied thumbnail: `/api/widgets/photos/image?widgetId=…&id=…&size=thumb|preview`. */
  thumb: string;
  preview: string;
  width?: number;
  height?: number;
  /** When the photo was taken (ms). */
  takenAt?: number;
  /** `City, Country` when known. */
  place?: string;
  /** Is a video (shown with its poster frame). */
  video?: boolean;
  /** Link to open the photo in the provider's web UI (admin-configured base URL). */
  link?: string;
}

/** GET /api/widgets/photos?widgetId=…&seed=… → a bounded selection per the widget's mode (random, recent, album, favorites, on this day). */
export interface PhotosResponse {
  provider: PhotoProvider;
  name: string;
  photos: Photo[];
  /** Library totals when the provider reports them. */
  stats?: { photos?: number; videos?: number; usageBytes?: number };
  fetchedAt: number;
}

/* ------------------------------------------------------------ Bookmarks */

/**
 * Bookmarks are shared by every bookmarks widget as a flat list in
 * `config.settings.bookmarks: BookmarkItem[]`, folders reference their
 * parent by id, `parentId` absent means the root. Order = array order.
 */
export interface BookmarkItem {
  id: string;
  kind: 'link' | 'folder';
  title: string;
  /** Links only: absolute http(s) URL. */
  url?: string;
  parentId?: string;
  /** Emoji, `lucide:Name`, uploaded logo path, or absent for the site's own icon. */
  icon?: string;
  /** Folders: accent colour (hex). */
  color?: string;
  /** Links: short note under the title. */
  description?: string;
}

/**
 * GET /api/widgets/favicon?url=<absolute http(s) url>&widgetId=… → the site's
 * icon (image bytes, long cache) or 404. The server finds it once (page
 * `<link rel=icon|apple-touch-icon>`, web manifest, `/favicon.ico`), keeps it
 * in `<data>/favicons/`, and only fetches origins saved in the shared bookmarks
 * library or the RSS widget's saved feeds, including for admins.
 */
export const FAVICON_ROUTE = '/api/widgets/favicon';
