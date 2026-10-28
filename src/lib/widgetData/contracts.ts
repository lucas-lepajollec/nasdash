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

/**
 * GET /api/widgets/photos/stats?widgetId=… (widget type `photos-stats`, settings `integrationId`, `showUsers`) —
 * what a photo library holds. Every field is optional: each provider reports what it knows.
 */
export interface PhotoStatsResponse {
  provider: PhotoStatsProvider;
  name: string;
  photos?: number;
  videos?: number;
  /** Photos and videos together, when the provider cannot split them (a key without statistics access). */
  items?: number;
  /** The key may not read the library's statistics: figures are partial. */
  limited?: boolean;
  albums?: number;
  people?: number;
  places?: number;
  favorites?: number;
  /** Space the library's files take. */
  libraryBytes?: number;
  /** The disk holding the library, when the provider reports it. */
  disk?: { usedBytes: number; totalBytes: number };
  /** Photos and videos per year taken, oldest first (≤ 20 years). */
  byYear?: { year: number; count: number }[];
  /** Items added per day over the last 30 days, oldest first (30 values). */
  added?: number[];
  /** Per account (names only when the widget allows them, as media widgets do). */
  users?: { name?: string; photos: number; videos: number; bytes?: number }[];
  fetchedAt: number;
}
/** Providers the stats widget reads: the photo widget's, plus libraries that only report figures well. */
export const PHOTO_STATS_TYPES = ['immich', 'photoprism', 'piwigo', 'librephotos'] as const;
export type PhotoStatsProvider = typeof PHOTO_STATS_TYPES[number];

/* ------------------------------------------------------------ UPS */

export const UPS_TYPES = ['nut', 'apcupsd'] as const;
export type UpsProvider = typeof UPS_TYPES[number];
/** GET /api/widgets/ups?widgetId=… (settings: `integrationId`, `ups`: the UPS name on a NUT server, default its first). */
export interface UpsSummary {
  provider: UpsProvider;
  /** Connection name (`config.integrations[].name`). */
  name: string;
  /** The UPS read on that server (NUT name, apcupsd UPSNAME). */
  ups?: string;
  /** Every UPS a NUT server offers, for the widget's choice. */
  devices?: string[];
  /** The name the server's administrator gave the UPS (NUT `desc`), often clearer than what the unit reports. */
  description?: string;
  model?: string;
  manufacturer?: string;
  /** Where the load is powered from now. */
  power: 'mains' | 'battery' | 'unknown';
  /** Status flags the UPS reports. */
  lowBattery?: boolean;
  charging?: boolean;
  replaceBattery?: boolean;
  overload?: boolean;
  /** The server lost the UPS (cable, driver): the figures are not current. */
  offline?: boolean;
  batteryPercent?: number;
  /** The UPS's own estimate at the present load. */
  runtimeSeconds?: number;
  /**
   * Where the monitoring software shuts the machines down: battery charge (%) or runtime left (s), whichever comes
   * first (NUT battery.charge.low / battery.runtime.low, apcupsd MBATTCHG / MINTIMEL).
   */
  shutdownPercent?: number;
  shutdownRuntimeSeconds?: number;
  loadPercent?: number;
  loadWatts?: number;
  /** Rated real power (W). */
  nominalWatts?: number;
  inputVoltage?: number;
  outputVoltage?: number;
  batteryVoltage?: number;
  inputFrequency?: number;
  temperatureC?: number;
  /** apcupsd: the last switch to battery (its reason), how many since start, seconds on battery now. */
  lastTransfer?: string;
  transfers?: number;
  onBatterySeconds?: number;
  fetchedAt: number;
}

/* ------------------------------------------------------------ VPN tunnel */

export const VPN_TUNNEL_TYPES = ['gluetun'] as const;
export type VpnTunnelProvider = typeof VPN_TUNNEL_TYPES[number];
/**
 * GET /api/widgets/vpn?widgetId=… (settings: `integrationId`); POST { widgetId, action: 'restart' } —
 * administrators, answers the new summary.
 */
export interface VpnTunnelSummary {
  provider: VpnTunnelProvider;
  /** Connection name (`config.integrations[].name`). */
  name: string;
  /** The tunnel's state as the gateway reports it; anything else is `unknown`. */
  status: 'running' | 'starting' | 'stopping' | 'stopped' | 'crashed' | 'unknown';
  /** Where traffic leaves the tunnel, while it runs. */
  publicIp?: string;
  country?: string;
  region?: string;
  city?: string;
  /** The network that owns the exit address (usually the VPN provider's host). */
  organization?: string;
  /** Ports the VPN provider forwards to the gateway. */
  forwardedPorts?: number[];
  /** The viewer may restart the tunnel (administrators). */
  canControl?: boolean;
  /** Containers whose traffic goes through this gateway (from the saved Docker hosts; viewers with Docker access). */
  services?: { name: string; running: boolean }[];
  /** Containers tied to a previous gateway container, without network until they are recreated. */
  detached?: string[];
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
/** A title watched lately; `progress` (0–100) when the server keeps the position, 100 once watched to the end. */
export interface MediaWatched { item: MediaItem; user?: string; watchedAt?: number; progress?: number; remainingMs?: number }

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
/**
 * One library of the server: its titles (`count`: movies, series, artists or
 * books), the details that apply to its kind, what arrived in the last 7 days
 * and, once proxied, the posters of its newest titles (`covers`).
 */
export interface MediaLibrary {
  name: string; kind: 'movies' | 'series' | 'music' | 'books' | 'other';
  count?: number; episodes?: number; albums?: number; tracks?: number; added?: number;
  covers?: string[];
  /** Server-only: the newest titles, replaced by `covers` before leaving the server. */
  art?: MediaItem[];
  /** Server-only: a random sample of the library (up to 24), for varied covers. */
  sample?: MediaItem[];
}
/** GET /api/widgets/media/library?widgetId=… */
export interface MediaLibraryResponse {
  server: MediaServer; name: string; counts: MediaCounts;
  libraries: MediaLibrary[];
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

/* --------------------------------------------------------- *arr & downloads */

/**
 * *arr applications (Settings → Integrations → Media servers, *arr part):
 * `url`, `allowSelfSigned`; secret `apiKey` (sent as `X-Api-Key`, never in a URL).
 * Sonarr/Radarr API v3, Lidarr/Prowlarr API v1.
 */
export const ARR_TYPES = ['sonarr', 'radarr', 'lidarr', 'prowlarr'] as const;
export type ArrType = typeof ARR_TYPES[number];
/** The *arr that manage a library (Prowlarr manages indexers). */
export const LIBRARY_ARR_TYPES = ['sonarr', 'radarr', 'lidarr'] as const;

/**
 * Download clients: `url`, `allowSelfSigned`, and per type
 * qbittorrent: `username` + secret `password` (Web UI login);
 * transmission: `username` + secret `password` (RPC basic auth, optional);
 * deluge: secret `password` (Web UI);
 * sabnzbd: secret `apiKey` (SABnzbd only accepts it in the query string; the server adds it);
 * nzbget: `username` + secret `password` (RPC basic auth).
 */
export const DOWNLOAD_CLIENT_TYPES = ['qbittorrent', 'transmission', 'deluge', 'sabnzbd', 'nzbget'] as const;
export type DownloadClientType = typeof DOWNLOAD_CLIENT_TYPES[number];

/** A connection that could not be read, by name (never its address or the upstream message). */
export interface SourceFailure { id: string; name: string; error: string }

/** An episode, movie or album due soon (Sonarr / Radarr / Lidarr calendars). */
export interface UpcomingItem {
  /** Opaque, unique across sources. */
  id: string;
  source: 'sonarr' | 'radarr' | 'lidarr';
  /** Connection name. */
  sourceName: string;
  kind: 'episode' | 'movie' | 'album';
  /** Episode title, movie title, album title. */
  title: string;
  /** Episode: its series; album: its artist. */
  subtitle?: string;
  season?: number;
  episode?: number;
  /** When it airs / is released (ms). Movies: the next of cinema, digital or physical release within the window. */
  at: number;
  /** Movies: which release `at` is. */
  release?: 'cinema' | 'digital' | 'physical';
  /** Already downloaded. */
  hasFile: boolean;
  /** Tab: `current` (an episode of a season under way, a movie released) or `announced` (premiere, new season, coming movie, album). */
  phase?: ReleasePhase;
  /** Proxied images, like media posters: `/api/widgets/media/image?widgetId=…&id=…&kind=poster|backdrop`. */
  poster?: string;
  backdrop?: string;
  /** Opens it in the *arr web UI (administrators only). */
  link?: string;
}
/**
 * What comes next for a series of the media library (mode `library`): read
 * from the media server, its next episode / season looked up on TVMaze.
 */
export interface FollowUpItem {
  /** Opaque, unique. */
  id: string;
  /** The series' name in the library. */
  title: string;
  /** `airing`: next episode dated; `upcoming`: a new season dated; `announced`: still running, no date yet; `ended`: no more to come. */
  status: 'airing' | 'upcoming' | 'announced' | 'ended';
  season?: number;
  episode?: number;
  episodeTitle?: string;
  /** Air date of the next episode (ms), when known. */
  at?: number;
  /** Broadcaster or streaming service (TVMaze). */
  network?: string;
  /** The last season present in the library. */
  ownedSeason?: number;
  phase?: ReleasePhase;
  /** Proxied images from the media server, like media posters. */
  poster?: string;
  backdrop?: string;
  /** Opens the series in the media server (administrators only). */
  link?: string;
}
/**
 * GET /api/widgets/arr/upcoming?widgetId=… — settings: `source` `arr` (default) | `library`.
 * `arr`: `integrationIds` (default: every Sonarr/Radarr/Lidarr), `days` 1–60 default 14, `kinds`;
 * `later`: when nothing falls in the window, the next ones after it (≤ 3, within 120 days).
 * `library`: `mediaId` (a Jellyfin/Emby/Plex connection, default the first), `ended` (show ended series, default false);
 * `followUps` sorted: dated first (soonest), then announced, then ended.
 */
/**
 * Which tab an entry belongs to: `current` — out or airing now (an episode
 * of a season under way, a released movie, an airing anime); `announced` —
 * not started yet (a premiere, a new season, a coming movie), dated or not.
 */
export type ReleasePhase = 'current' | 'announced';
/** Public catalogues the widget may read (no account; TMDB only with a saved TMDB connection). */
export type CatalogProvider = 'tvmaze' | 'kitsu' | 'anilist' | 'tmdb';
export type CatalogKind = 'series' | 'anime' | 'movie';
/** A title followed in the widget's own list (settings `watchlist`). */
export interface WatchEntry { provider: CatalogProvider; id: string; kind: CatalogKind; title: string }
/** A catalogue search hit (GET /api/widgets/arr/catalog?q=…&kinds=…, administrators only). */
export interface CatalogHit extends WatchEntry { year?: number; poster?: string; status?: string }
/** What comes next for a title of a public catalogue. */
export interface ExternalItem {
  id: string;
  provider: CatalogProvider;
  kind: CatalogKind;
  title: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  /** Air / release date (ms) when known. */
  at?: number;
  status: 'airing' | 'upcoming' | 'announced' | 'ended';
  phase: ReleasePhase;
  network?: string;
  /** Public https images from the catalogue's own CDN. */
  poster?: string;
  backdrop?: string;
  /** The title's page on the catalogue (public). */
  link?: string;
}
/**
 * GET /api/widgets/arr/upcoming?widgetId=… — settings:
 * `sources`: ordered ('arr' | 'library' | 'external')[], the order is the priority (default ['arr']; the legacy
 * `source: 'library'` reads as ['library']).
 * arr: `integrationIds`, `days` 1–60 default 14, `kinds`, `later` when the window is empty.
 * library: `mediaId`, `ended`.
 * external: `externalMode` 'watchlist' (default) | 'all'; `watchlist` WatchEntry[] (≤ 100);
 * `catalogKinds` CatalogKind[] for 'all' (default all three; movies only with TMDB).
 * Every entry carries its `phase`.
 */
export interface UpcomingResponse { items: UpcomingItem[]; later?: UpcomingItem[]; followUps?: FollowUpItem[]; external?: ExternalItem[]; failures: SourceFailure[]; fetchedAt: number }

export type QueueStatus = 'downloading' | 'queued' | 'paused' | 'importing' | 'warning' | 'failed' | 'completed';
/** An item in a *arr download queue. */
export interface QueueItem {
  id: string;
  source: 'sonarr' | 'radarr' | 'lidarr';
  sourceName: string;
  kind: 'episode' | 'movie' | 'album';
  title: string;
  subtitle?: string;
  season?: number;
  episode?: number;
  /** 0–100. */
  progress: number;
  status: QueueStatus;
  /** Administrators may control this download through a matching saved download client. */
  canControl?: boolean;
  /** Short reason for warning/failed (the *arr's own status message, cut to 160 characters, no paths). */
  message?: string;
  sizeBytes?: number;
  leftBytes?: number;
  etaMs?: number;
  quality?: string;
  protocol?: 'torrent' | 'usenet';
  /** The download client's name in the *arr. */
  client?: string;
  poster?: string;
}
/** A title the *arr imported lately (its history). */
/** `count`: imports folded into this one (episodes of the same series), when more than one. */
export interface ImportedItem { id: string; source: 'sonarr' | 'radarr' | 'lidarr'; kind: 'episode' | 'movie' | 'album'; title: string; subtitle?: string; season?: number; episode?: number; count?: number; quality?: string; at: number; poster?: string }
/** GET /api/widgets/arr/queue?widgetId=… (settings: `integrationIds`, `count` 3–50 default 10). `recent`: the last imports (≤ 6, newest first), for the empty queue. */
export interface QueueResponse { items: QueueItem[]; total: number; recent?: ImportedItem[]; failures: SourceFailure[]; fetchedAt: number }
/** POST /api/widgets/arr/queue/action — administrators only; answers the refreshed QueueResponse. */
export interface QueueActionRequest { widgetId: string; itemId: string; action: 'pause' | 'resume' }

/** One download client, now. */
export interface DownloadClientStatus {
  id: string;
  name: string;
  type: DownloadClientType;
  /** Bytes per second. */
  downloadBps: number;
  uploadBps?: number;
  active: number;
  paused?: number;
  queued?: number;
  /** Speed limits when set (bytes per second; 0 = none). */
  downloadLimitBps?: number;
  uploadLimitBps?: number;
  /** Alternative (slow) speed mode on (qBittorrent, Transmission). */
  altSpeed?: boolean;
  /** Downloads, running first, then paused or waiting, then seeding; widget responses send at most 10. */
  items: { id: string; name: string; progress: number; state: 'downloading' | 'seeding' | 'paused' | 'queued' | 'checking' | 'error' | 'completed'; downloadBps?: number; etaMs?: number; sizeBytes?: number }[];
  /** Free space where the client saves, when it reports it. */
  freeBytes?: number;
  /** Bytes received / sent since the client started (its own session totals). */
  sessionDownloaded?: number;
  sessionUploaded?: number;
  /** Torrents being shared. */
  seeding?: number;
  /** Finished lately, newest first (≤ 5). */
  completed?: { id: string; name: string; sizeBytes?: number; at?: number }[];
  /** The viewer may pause and resume here (administrators, on a client that supports it). */
  canControl?: boolean;
  /** The whole client is paused: its own pause (qBittorrent session, SABnzbd, NZBGet), or every torrent stopped. */
  clientPaused?: boolean;
}
/**
 * POST /api/widgets/downloads/action { widgetId, clientId, action: 'pause' | 'resume', itemId? } —
 * administrators only; without `itemId`, the whole client. Answers the client's new status.
 */
export interface DownloadActionRequest { widgetId: string; clientId: string; action: 'pause' | 'resume'; itemId?: string }
/** GET /api/widgets/downloads?widgetId=… (settings: `integrationIds` (default: every client), `items` 0–10 default 5). */
export interface DownloadsResponse { clients: DownloadClientStatus[]; failures: SourceFailure[]; fetchedAt: number }

/** A Prowlarr indexer. */
export interface IndexerStatus {
  id: string;
  name: string;
  protocol: 'torrent' | 'usenet';
  enabled: boolean;
  /** Not failing (Prowlarr's indexer status has no failure / disabled-until). */
  healthy: boolean;
  /** When Prowlarr will try a failing indexer again (ms). */
  retryAt?: number;
  queries?: number;
  grabs?: number;
  failures?: number;
  averageMs?: number;
}
/** GET /api/widgets/arr/indexers?widgetId=… (a Prowlarr connection). */
export interface IndexersResponse {
  name: string; indexers: IndexerStatus[]; totals: { queries: number; grabs: number; failures: number };
  /** Searches per hour over the last 24 hours, oldest first (24 values), from Prowlarr's history. */
  hourly?: number[];
  /** Last time Prowlarr searched (ms). */
  lastQueryAt?: number;
  fetchedAt: number;
}

/** One *arr application at a glance. */
export interface ArrAppStatus {
  id: string;
  name: string;
  type: ArrType;
  version?: string;
  /** The *arr's own health checks (cut to 200 characters). */
  health: { level: 'warning' | 'error'; message: string }[];
  queue?: number;
  /** Monitored items missing (Sonarr episodes, Radarr movies, Lidarr albums). */
  missing?: number;
  /** Prowlarr: indexers enabled / failing. */
  indexers?: number;
  failingIndexers?: number;
  /**
   * The media root folders (where the library lives, not the app's own disk):
   * the folder's last path segment only, its free and total space.
   */
  roots?: { name: string; freeBytes: number; totalBytes?: number }[];
  online: boolean;
}
/** GET /api/widgets/arr/status?widgetId=… (settings: `integrationIds`, default every *arr). */
export interface ArrStatusResponse { apps: ArrAppStatus[]; fetchedAt: number }

/* ---------------------------------------------------------------- Music */

/** Music servers: the video servers' music libraries, and Subsonic-compatible ones (Navidrome, Gonic, Airsonic). */
export const MUSIC_SERVER_TYPES = ['jellyfin', 'emby', 'plex', 'navidrome'] as const;
export type MusicServer = typeof MUSIC_SERVER_TYPES[number];
/** Covers go through the media image proxy: `/api/widgets/media/image?widgetId=…&id=…&kind=poster`. */
export interface MusicTrack {
  id: string; title: string; artist?: string; album?: string; albumId?: string; durationMs?: number; cover?: string;
  /** When it was last played (recently played tracks). */
  playedAt?: number;
  /** Times played (most played tracks). */
  plays?: number;
}
export interface MusicPlaylist { id: string; name: string; trackCount?: number; durationMs?: number; cover?: string; owner?: string; changedAt?: number }
export interface MusicAlbum {
  id: string; title: string; artist?: string; year?: number; trackCount?: number; cover?: string;
  addedAt?: number; playedAt?: number;
  /** Times played (all time; the servers keep no per-period count). */
  plays?: number;
  /** Opens the album in the server (administrators only). */
  link?: string;
}
/** GET /api/widgets/music/now-playing?widgetId=… (settings `integrationId`, `showUsers`). Nothing playing: `recent`, the albums played lately. */
export interface MusicNowPlayingResponse {
  server: MusicServer; name: string;
  sessions: { id: string; track: MusicTrack; user?: string; player?: string; state: 'playing' | 'paused'; positionMs?: number; quality?: string; next?: MusicTrack[]; canControl?: boolean }[];
  recent?: MusicAlbum[];
  fetchedAt: number;
}
/**
 * GET /api/widgets/music/recent?widgetId=… (settings `integrationId`, `count` 4–40 default 12,
 * `content` 'added' (default: albums newest added first) | 'albums' (albums played lately) | 'tracks' (tracks played lately, in `tracks`)).
 */
/** `content: 'pages'` (`pages`: ordered subset of added | albums | tracks): `albums` added, `played` albums played, `tracks` played, each when its page is on. */
export interface MusicRecentResponse { server: MusicServer; name: string; albums: MusicAlbum[]; played?: MusicAlbum[]; tracks?: MusicTrack[]; fetchedAt: number }
/** GET /api/widgets/music/playlists?widgetId=… (widget `music-playlists`, settings `integrationId`, `count` 3–40 default 12). */
export interface MusicPlaylistsResponse { server: MusicServer; name: string; playlists: MusicPlaylist[]; fetchedAt: number }
/** GET /api/widgets/music/tracks?widgetId=…&kind=album|playlist&id=… — the tracks to play, in order (≤ 300). Any music widget id. */
export interface MusicTracksResponse { tracks: MusicTrack[] }
/** GET /api/widgets/music/search?widgetId=…&q=… (2–80 chars) — any music widget id. */
export interface MusicSearchResponse { tracks: MusicTrack[]; albums: MusicAlbum[]; playlists: MusicPlaylist[] }
/**
 * GET /api/widgets/music/stream?widgetId=…&id=<trackId> — the track's audio, relayed with HTTP Range
 * support (a browser <audio> source). Signed-in users with the Media permission only (never anonymous visitors);
 * the id must be one a music response of that widget listed (membership like covers).
 */
export type MusicStreamRoute = '/api/widgets/music/stream';
/** POST /api/widgets/music/control { widgetId, sessionId, action } — administrators; Jellyfin/Emby sessions (`canControl` on the session). */
export interface MusicControlRequest { widgetId: string; sessionId: string; action: 'playpause' | 'next' | 'previous' }
/** GET /api/widgets/music/library?widgetId=… */
export interface MusicLibraryResponse {
  server: MusicServer; name: string;
  artists?: number; albums?: number; tracks?: number;
  /** Total duration of the tracks (ms). */
  durationMs?: number;
  /** Most present genres (≤ 8), by number of albums (or tracks when the server counts those). */
  genres?: { name: string; count: number }[];
  /** Albums added in the last 7 days (≤ 8, newest first) and how many in all. */
  week?: MusicAlbum[]; weekCount?: number;
  fetchedAt: number;
}
/**
 * GET /api/widgets/music/top?widgetId=… (settings `integrationId`, `count` 3–20 default 6, `content` 'albums' (default) | 'tracks' | 'pages'
 * with `pages` an ordered subset of albums | tracks): most played, all time; `tracks` when that page is on.
 */
export interface MusicTopResponse { server: MusicServer; name: string; albums: MusicAlbum[]; tracks?: MusicTrack[]; fetchedAt: number }
