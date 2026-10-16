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

/* ----------------------------------------------------------- Custom API */

/**
 * A custom API connection (`type: 'customapi'`, Settings → Integrations →
 * Custom APIs): any HTTP(S) endpoint answering JSON, read by the server.
 * Settings: `url`, `authType` (none | bearer | header | basic | query),
 * `authName` (header name, query parameter or basic user), `allowSelfSigned`;
 * secret: `authValue`. The browser never receives the address nor the secret.
 */
export const CUSTOM_API_TYPES = ['customapi'] as const;
export type CustomApiAuth = 'none' | 'bearer' | 'header' | 'basic' | 'query';

/**
 * A value picked in the JSON answer: a path such as `data.items[0].speed` or
 * `servers.length` (letters, digits, `_`, `-`, `$`, `[n]`; at most 16 steps).
 * Only strings (≤ 300 characters), finite numbers, booleans and null come back.
 */
export type CustomApiPath = string;
export type CustomApiValue = string | number | boolean | null;
export type CustomApiFormat = 'auto' | 'number' | 'percent' | 'bytes' | 'bitrate' | 'duration' | 'date' | 'relative' | 'text' | 'boolean';

/** One field shown by a custom API widget (in its settings, `settings.fields`). */
export interface CustomApiField {
  id: string;
  /** From the answer's root, or from each row in the table display. */
  path: CustomApiPath;
  label: string;
  format?: CustomApiFormat;
  /** Shown after the value (`ms`, `°C`…). */
  unit?: string;
  decimals?: number;
  /** Gauges: the scale (default 0–100). */
  min?: number;
  max?: number;
  /** Colours: warning and critical thresholds; `lowIsBad` when going down is the problem. */
  warn?: number;
  crit?: number;
  lowIsBad?: boolean;
}

/**
 * Widget settings: `integrationId`, `title`, `display` (figures | gauges |
 * list | table | status), `fields` (≤ 12), `listPath` and `limit` (table,
 * ≤ 50 rows), `okPath` / `okValue` (status: the value that means "fine";
 * without one, any truthy value), `refresh` (seconds: 15, 30, 60, 300, 900).
 */
export type CustomApiDisplay = 'figures' | 'gauges' | 'list' | 'table' | 'status';

/** GET /api/widgets/customapi?widgetId=… → only the picked values, never the whole answer. */
export interface CustomApiResponse {
  name: string;
  /** `settings.fields` order. */
  values: CustomApiValue[];
  /** Table display: one array of values per row, `settings.fields` order. */
  rows?: CustomApiValue[][];
  /** Status display: the `okPath` value and whether it means fine. */
  status?: { value: CustomApiValue; ok: boolean };
  fetchedAt: number;
}

/**
 * GET /api/widgets/customapi/sample?integrationId=… (administrators) → the
 * answer, cut down for picking fields: 6 levels, 20 items per array, strings
 * of 200 characters, 2,000 values at most.
 */
export interface CustomApiSample { sample: unknown; truncated: boolean; fetchedAt: number }

/* ---------------------------------------------------------------- Media */

/**
 * Media servers (Settings → Integrations → Media), one saved connection per
 * server: `url`, `allowSelfSigned`; secret `apiKey` (Jellyfin, Emby: an API
 * key) or `token` (Plex: X-Plex-Token). The browser never gets either.
 */
export const MEDIA_SERVER_TYPES = ['jellyfin', 'emby', 'plex'] as const;
export type MediaServer = typeof MEDIA_SERVER_TYPES[number];
export type MediaKind = 'movie' | 'episode' | 'series' | 'album' | 'track' | 'video' | 'other';

/** A title of a media server, as every media widget shows it. */
export interface MediaItem {
  /** Opaque id from the server (Jellyfin/Emby item id, Plex rating key). */
  id: string;
  kind: MediaKind;
  /** Movie, episode, album or track name. */
  title: string;
  /** Episode: its series; track: artist · album; album: artist. */
  subtitle?: string;
  season?: number;
  episode?: number;
  year?: number;
  /** Proxied 2:3 poster (episodes: their series' poster). `/api/widgets/media/image?widgetId=…&id=…&kind=poster` */
  poster?: string;
  /** Proxied 16:9 background art (episodes: their series' when they have none). */
  backdrop?: string;
  /** When it was added to the library (ms). */
  addedAt?: number;
  durationMs?: number;
  /** A series standing for several new episodes (recently added, grouped): how many. */
  count?: number;
  /** Opens the title in the server's web app; administrators only (it carries the server address). */
  link?: string;
}

export type MediaPlayState = 'playing' | 'paused' | 'buffering';
export type MediaPlayMethod = 'direct' | 'stream' | 'transcode';

/** Someone watching or listening right now. */
export interface MediaSession {
  /** Opaque session id. */
  id: string;
  item: MediaItem;
  /** Account name: administrators, or viewers when the widget shows users. */
  user?: string;
  /** Player app and device ("Jellyfin Web · Firefox", "Plex for LG · Living room"). */
  player?: string;
  state: MediaPlayState;
  positionMs?: number;
  /** Direct play, direct stream (remux) or transcode. */
  method?: MediaPlayMethod;
  /** Source quality, short ("4K HDR", "1080p", "FLAC"). */
  quality?: string;
  /** Stream bit rate (kbit/s) when the server reports it. */
  bitrateKbps?: number;
}

/** A title watched lately (account name under the same rule as sessions). */
export interface MediaWatched { item: MediaItem; user?: string; watchedAt?: number }

/**
 * GET /api/widgets/media/now-playing?widgetId=… — when nothing plays,
 * `history` (what was watched lately) or, when the server cannot tell,
 * `recent` (the newest titles), for a calm idle view.
 */
export interface MediaNowPlayingResponse { server: MediaServer; name: string; sessions: MediaSession[]; history?: MediaWatched[]; recent?: MediaItem[]; fetchedAt: number }

/**
 * GET /api/widgets/media/recent?widgetId=… → the newest titles (settings: `kinds`: movie | episode | album,
 * `count` 4–40, `group` (default true): new episodes of one series come as that series, with their `count`).
 */
export interface MediaRecentResponse { server: MediaServer; name: string; items: MediaItem[]; fetchedAt: number }

/** Library totals; absent when the server does not report them. */
export interface MediaCounts { movies?: number; series?: number; episodes?: number; artists?: number; albums?: number; tracks?: number; books?: number }
/** GET /api/widgets/media/library?widgetId=… */
export interface MediaLibraryResponse {
  server: MediaServer; name: string; counts: MediaCounts;
  libraries: { name: string; kind: 'movies' | 'series' | 'music' | 'books' | 'other'; count?: number }[];
  /** Shelf backgrounds, several per shelf for the widget to rotate (settings `cover`: newest — default —, random, none), proxied like posters. */
  covers?: { movies?: string[]; series?: string[]; music?: string[] };
  fetchedAt: number;
}

/**
 * GET /api/widgets/media/image?widgetId=…&id=…&kind=poster|backdrop → the
 * image bytes (raster only), only for an image a media response of that
 * widget listed.
 */
export const MEDIA_IMAGE_ROUTE = '/api/widgets/media/image';
