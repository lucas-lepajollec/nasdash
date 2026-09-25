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

## Service integrations (Tailscale…)

Some integrations are a connection used by widgets rather than a device to
monitor. They are saved once in `config.integrations` (`id`, `type`, `name`,
`settings`, `secrets`). Their manifest (`ServiceIntegrationManifest`) lists the
fields; `IntegrationConnectionForm` draws the settings form from it; the
request validator only accepts those fields, and secrets only in secret fields.
Secrets are encrypted on disk, shown masked to admins and never sent to other
users. Older configurations are migrated on read (`settings.tailscale*` →
`tailscale-main`, previous file kept as `config.pre-integrations.json`).

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
| `http://127.0.0.1:2621` | Portainer, environment `1`, API key `fake-portainer-key` (Docker host) |
| `http://127.0.0.1:2622` | Dockhand, environment `1`, token `dh_fake-dockhand-token` (Docker host) |
| `127.0.0.1:2619` | A server answering HTML (error case) |
| `127.0.0.1:2618` | Nothing (unreachable case) |

Add a device (or Docker host) with that address in NasDash (not in the demo,
which never polls). To support a new integration, save one real answer of its API as a
sample (remove private data), write the collector against it, add a fake
server line here, then check it once against the real service.
