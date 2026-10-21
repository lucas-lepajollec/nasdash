# Integrations

Catalogue: **device metrics** — Glances, Netdata, Beszel, Prometheus
(node_exporter), Proxmox VE, Libre Hardware Monitor; **mesh VPN** (Tailscale
widget) — Tailscale, Headscale; **containers** — Docker Engine or Podman over
TCP/socket proxy, HTTPS, a mounted Unix socket, a Portainer environment
(relayed Docker API) or a Dockhand environment (translated by `src/lib/dockhand.ts`).
Any HTTPS source can accept a self-signed certificate, per device or host.

Everything that connects NasDash to an external monitoring system lives here.
The rest of the app only uses the registry, the collectors and the types.

| File | Role |
| --- | --- |
| `types.ts` | Contracts: `Metric` (numbers, no display text), `DeviceIntegrationManifest`, `DeviceCollector`, `CollectError`. |
| `registry.ts` | Browser-safe list of manifests: form fields and how they become a stored endpoint. Also drives validation of `api.type`. |
| `collectors.ts` | Server-only readers, by integration id. |
| `runtime.ts` | Background polling (every 10 s while a browser follows `/api/system`, every minute otherwise, started with the server), status cache read by `/api/devices/[id]`, which answers with the `Metric[]` (or the hand-written stats of devices without an integration). |
| `history.ts` | Server-side history of every device: each poll for the last hour, one averaged point with its peak per minute for 24 hours, saved to `<data>/metrics-history.json`. Read through `/api/devices/[id]/history` (`range=1h` or `24h`, optional `since=<ms>`) with the current metrics and vitals. |
| `instances.ts` | Saved service connections (`config.integrations`): legacy migration, masking, updates. |
| `<id>/manifest.ts` | Fields, defaults and `connect()` of one integration. |
| `<id>/collect.ts` | How that integration reads its endpoint and maps it to metrics. |
| `<id>/samples/*.json` | Real-looking answers of that API, used by the tests and by `npm run fake:integrations`. |

## Monitoring sources

The Glances collector recognizes CPU package/core labels and the unnamed
`k10temp` chip labels used by Synology DSM. Sensor values must be finite;
when type/unit metadata is present, fan speeds, battery percentages and
non-Celsius values are excluded from temperature selection. No temperature
is invented when a source supplies none.

A monitoring connection is saved once, on **Settings → Integrations**, in
`config.integrations` (like Tailscale): address, port, credentials (the
password in `secrets`, encrypted on disk) and the certificate choice. A device
only points to it with `source: { integrationId, values }`, where `values`
holds the fields marked `scope: 'machine'` in the manifest (Beszel system,
Prometheus instance, Proxmox node or VM). `sources.ts` resolves a device's
endpoint, lists the connections and migrates devices that still hold their
own `api` (one connection per address, shared per server for Beszel,
Prometheus and Proxmox; the previous file is kept as
`config.pre-sources.json`). `POST /api/integrations/test` tries a connection;
for servers it answers with their machines (`TARGET_LISTERS` in
`collectors.ts`), used by the device form's picker.

## Adding a monitoring integration

1. Create `src/integrations/<id>/manifest.ts` exporting a `DeviceIntegrationManifest`
   (`fields` describe the device form; `connect` turns them into `{ url, token }`,
   keeping the stored secret when the password is left empty).
2. Create `src/integrations/<id>/collect.ts` exporting a `DeviceCollector` that
   returns `Metric[]` (gauges in %) or `{ metrics, vitals }` (vitals: uptime, load,
   cores and network throughput in bytes/s, each optional) and throws `CollectError(message, reason)` on failure.
3. List the manifest in `registry.ts` and the collector in `collectors.ts`.
4. Add the id to `DeviceApiConfig['type']` in `src/lib/types.ts`, translate new
   form labels (`src/i18n`), and add tests next to `integrations.test.ts`.

The form, validation, API routes, poller and devices widget need no change: the
widget formats metrics itself (`src/components/widgets/deviceReadings.ts`:
units per language, colours per `kind`). Field labels are
French source strings passed to the translator, like other interface text.

Legacy types (`homeassistant`, `custom`) stay registered so existing devices
remain valid; they are not selectable and show their static stats.

## Monitoring state and temperature identity

Collector discoveries and sessions belong to the resolved endpoint, credentials,
machine target and certificate choice. Reconfiguring a connection clears them;
Glances rediscovers supported API versions when its remembered endpoint disappears.
Filesystems are identified by their reported device, or by their mount path when
that identity is unavailable; equal capacities never identify a shared volume.

The existing `temperature` widget setting now denotes CPU temperature only.
`gpuTemperature` denotes separate reported GPU sensors, each with its own history
and manual-order identity. Device widgets offer it when a GPU is detected; the
existing temperature metrics widget can select CPU or GPU without changing its
widget type. Missing GPU sensors stay unreported. Sensor selection never falls
back to a hotter component of a different kind. Prometheus uses node_exporter's
`node_hwmon_chip_names` metadata to select recognized CPU chips; unidentified
chips stay unreported instead of substituting a GPU or disk temperature. Beszel
reads named temperatures and per-GPU data from its latest `system_stats` record;
its configurable dashboard temperature (`info.dt`) is never assumed to be CPU.
Older hubs or tokens without access to sensor records keep their usage metrics,
with temperatures unreported.

Collectors return stable diagnostic keys and optional translation parameters in
`CollectError`. The original `reason` remains available for canonical English
operational diagnostics. UI consumers translate the key and parameters together.
A failed refresh marks a device offline and suppresses stale readings while
retaining its history internally for recovery. Server polling and shared browser
readers serialize their requests so an older response cannot replace a newer one.

## Service integrations (VPN, DNS and photos)

Some integrations are a connection used by widgets rather than a device to
monitor. They are saved once in `config.integrations` (`id`, `type`, `name`,
`settings`, `secrets`). Their manifest (`ServiceIntegrationManifest`) lists the
fields; `ServiceConnectionDialog` (Integrations page) draws the form from it; the
request validator only accepts those fields, and secrets only in secret fields.
Secrets are encrypted on disk, shown masked to admins and never sent to other
users. Older configurations are migrated on read (`settings.tailscale*` →
`tailscale-main`, previous file kept as `config.pre-integrations.json`).

DNS widgets use Pi-hole v6 (`pihole`) or AdGuard Home (`adguard`); photo
widgets use Immich (`immich`) or PhotoPrism (`photoprism`). Multiple connections
of the same type have distinct instance IDs. Each widget selects one through
`settings.integrationId`; the server never selects the first connection by type.
New connections must be saved with a fresh explicit ID (the legacy upsert fallback
without an ID still edits that type's existing connection).
`ServiceField.kind: 'toggle'` stores `'true'` / `'false'` strings, including Pi-hole's
`allowSelfSigned`. Photo settings read `mode` (random/recent/favorites/album/memories),
`albumId` and `count` (default 12, maximum 60). GET previews accept an admin-only
JSON `draft`; the corresponding proxy image URLs carry the sanitized draft.

Collectors and proxy routes use bounded responses and requests with deadlines
of at most 6 seconds. Custom SID/API-key headers and binary image requests use
`widgetData/services.ts` with redirects disabled; other JSON requests use
`httpRequest`, with its per-host certificate option. DNS summaries cache for 15 s
with up to 5 minutes stale fallback; photo selections cache for 5 minutes, with
random `seed` included in the cache key. Only assets returned by an instance
are admitted to its in-memory image allowlist (24 h, bounded); refreshing the
photo widget repopulates it after a restart. Demo handlers never call providers.

API contracts checked against upstream documentation/source (2026-10-14):

- [Pi-hole API](https://docs.pi-hole.net/api/), and FTL's
  [route table](https://github.com/pi-hole/FTL/blob/master/src/api/api.c),
  [DNS](https://github.com/pi-hole/FTL/blob/master/src/api/dns.c),
  [history](https://github.com/pi-hole/FTL/blob/master/src/api/history.c) and
  [statistics](https://github.com/pi-hole/FTL/blob/master/src/api/stats.c): v6
  `/api/auth`, `/api/stats/summary`, `/api/history`, top domains/clients and
  `/api/dns/blocking`; blocking responses use an enum, toggle bodies a boolean,
  and timers/validity seconds. Prefer an application password. The hosted FTL
  OpenAPI document was unavailable during this check; the implementation was
  verified directly against FTL source instead.
- [AdGuard Home OpenAPI](https://github.com/AdguardTeam/AdGuardHome/blob/master/openapi/openapi.yaml):
  Basic auth, `/control/status`, `/control/stats?recent=86400000` for hourly
  24 h history, filtering rules, and protection duration in milliseconds.
- [Immich OpenAPI](https://github.com/immich-app/immich/blob/main/open-api/immich-openapi-specs.json):
  `x-api-key`, random/metadata search, albums, `/api/memories?for=YYYY-MM-DD`
  returning memory groups with assets, thumbnail/preview sizes, and optional
  admin-only statistics. Legacy search fields remain supported in the current
  schema (deprecated in v3.2); memories fall back to bounded date searches over
  ten previous years. Connection tests use authenticated `/api/users/me`.
- [PhotoPrism API](https://docs.photoprism.app/developer-guide/api/),
  [search](https://docs.photoprism.app/developer-guide/api/search/) and
  [thumbnails](https://docs.photoprism.app/developer-guide/api/thumbnails/):
  app passwords work directly as Bearer tokens, merged image searches support
  newest/random, favorites and album scope; thumbnails require a file SHA1 hash
  and the server-only config preview token, using `fit_720` / `fit_1920`.
  Memories filter the current month/day in previous years.

Manifest label keys for the UI are `integrations.<type>.url`,
`integrations.pihole.password`, `integrations.adguard.username`,
`integrations.adguard.password`, `integrations.immich.apiKey`,
`integrations.photoprism.token` and the existing `integrations.allowSelfSigned`.
Provider errors reuse `widgets.error.network`, `parse`, `http`, `timeout`,
`tooLarge`, widget lookup/validation keys, and `integrations.error.authentication`;
TLS/URL errors add `integrations.error.certificate` and `integrations.error.invalidUrl`.
The UI owner maintains these keys in all five interface languages.

## Trying an integration without installing it

`npm run fake:integrations` starts local fake servers answering from the
`samples/` files (values move a little on each request):

| Address | Answers like |
| --- | --- |
| `127.0.0.1:2611` | Glances (a NAS) |
| `127.0.0.1:2612` | Libre Hardware Monitor (a gaming PC) |
| `https://127.0.0.1:2613` | Glances over HTTPS with a self-signed certificate (needs "Accept a self-signed certificate") |
| `127.0.0.1:2614` | Docker Engine with 2 containers (Docker host: address `127.0.0.1`, port 2614) |
| printed socket path | The same Docker Engine on a Unix socket (Docker host: "Unix socket") |
| `127.0.0.1:2615` | Netdata |
| `127.0.0.1:2616` | Beszel, system `nas`, login `nasdash@example.com` / `fake-password` |
| `127.0.0.1:2617` | Prometheus, instance `192.0.2.10:9100` |
| `http://127.0.0.1:2620` | Headscale, API key `fake-headscale-key` (Tailscale widget settings) |
| `http://127.0.0.1:2625` | Portainer, environment `1`, API key `fake-portainer-key` (Docker host) |
| `http://127.0.0.1:2626` | Dockhand, environment `1`, token `dh_fake-dockhand-token` (Docker host) |
| `http://127.0.0.1:2621` | Pi-hole v6, password `fake-password` |
| `http://127.0.0.1:2622` | AdGuard Home, username `admin`, password `fake-password` |
| `http://127.0.0.1:2623` | Immich, API key `fake-immich-key` |
| `http://127.0.0.1:2624` | PhotoPrism, token `fake-photoprism-token` |
| `127.0.0.1:2619` | A server answering HTML (error case) |
| `127.0.0.1:2618` | Nothing (unreachable case) |

Add a device (or Docker host) with that address in NasDash (not in the demo,
which never polls). To support a new integration, save one real answer of its API as a
sample (remove private data), write the collector against it, add a fake
server line here, then check it once against the real service.


## *arr and download widget data

`arr/collect.ts` shares Sonarr/Radarr v3 and Lidarr/Prowlarr v1 mapping;
per-app folders contain manifests, collector entry points and fictional samples.
`widgetData/arrRoutes.ts` resolves visible saved widgets and admin drafts, selects
saved instance IDs of the allowed types, and fetches sources in parallel. A failed
calendar, queue or client is listed by name and a translated error key; a failed
status source remains in the list with `online: false`. Indexers select one Prowlarr.

The server caches upcoming items for 300 seconds, queues for 10, app status for 60,
indexers for 120 and downloads for 3. Cache and session identities hash the full
connection configuration and credentials. Responses use `private, no-store`.
Artwork membership includes widget/preview scope, instance identity and upstream
path; only a selected instance can serve its listed raster images. Links are
removed for viewers after reading the shared cache. Demo handlers use invented
fixtures and generated local artwork without network calls.

All download transports reject redirects, including login bodies, cookies,
Transmission session headers and basic authentication. *arr keys are headers;
SABnzbd's API requires a server-only query key that is never part of a response.
qBittorrent caches cookie sessions and retries one 403 after login; Transmission
negotiates its session ID with one 409 retry. Optional free-space calls do not
prevent reporting transfer activity.


## Public release catalogues

`catalog/` maps TVMaze, Kitsu, AniList and TMDB into the contracts in
`widgetData/contracts.ts`. Upcoming settings accept ordered `sources` (`arr`,
`library`, `external`); the legacy library source still works. Each source fails
independently. External watchlists contain only provider/id/kind/title; titles
are fallback display text and are never sent to a catalogue. Administrator-only
`GET /api/widgets/arr/catalog` sends the explicit search query, validates optional
widget membership, deduplicates anime titles and returns at most 24 hits.

TVMaze uses the existing collector's global pacing and manual lookup redirect
handling; next/previous episode links must name its exact episode endpoint.
Other providers use fixed HTTPS API bases and reject redirects. Minimum request
spacing is TVMaze 550 ms, Kitsu 250 ms, AniList 700 ms and TMDB 100 ms. Requests
have 10-second timeouts and retry a 429 once after two seconds. Entries cache for
six hours, searches ten minutes and discovery lists one hour. AniList errors,
including GraphQL failures and HTTP 403, do not discard other catalogue results.

TMDB is a registered service connection in the media category, with one required
secret (`apiKey`) and no configurable address. JWT-shaped read tokens use bearer
authentication; v3 keys use TMDB's server-side `api_key` query parameter. Its
credentials never reach another catalogue or a response. Only public HTTPS
artwork on the provider's exact CDN hosts reaches clients directly; library and
arr art retains the scoped image proxy. Demo catalogue art is generated locally.

Fictional provider samples and fetch-mocked tests live in `catalog/samples` and
`catalog/*.test.ts`. Live Kitsu `nextRelease` availability and AniList service
availability are not guaranteed; missing release dates remain announced.
TMDB movie release dates use the provider's default date, without a regional
release-date override. A released movie maps to the current (`airing`) state.
