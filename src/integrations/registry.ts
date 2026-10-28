import { navidromeManifest } from './navidrome/manifest';
import { tmdbManifest } from './tmdb/manifest';
import { sonarrManifest } from './sonarr/manifest';
import { radarrManifest } from './radarr/manifest';
import { lidarrManifest } from './lidarr/manifest';
import { prowlarrManifest } from './prowlarr/manifest';
import { qbittorrentManifest } from './qbittorrent/manifest';
import { transmissionManifest } from './transmission/manifest';
import { delugeManifest } from './deluge/manifest';
import { sabnzbdManifest } from './sabnzbd/manifest';
import { nzbgetManifest } from './nzbget/manifest';
import { jellyfinManifest } from './jellyfin/manifest';
import { embyManifest } from './emby/manifest';
import { plexManifest } from './plex/manifest';
import { customapiManifest } from './customapi/manifest';
import { piholeManifest } from './pihole/manifest';
import { adguardManifest } from './adguard/manifest';
import { technitiumManifest } from './technitium/manifest';
import { gluetunManifest } from './gluetun/manifest';
import { nutManifest } from './nut/manifest';
import { apcupsdManifest } from './apcupsd/manifest';
import { immichManifest } from './immich/manifest';
import { piwigoManifest } from './piwigo/manifest';
import { librephotosManifest } from './librephotos/manifest';
import { photoprismManifest } from './photoprism/manifest';
import { beszelManifest } from './beszel/manifest';
import { glancesManifest } from './glances/manifest';
import { lhmManifest } from './lhm/manifest';
import { netdataManifest } from './netdata/manifest';
import { prometheusManifest } from './prometheus/manifest';
import { proxmoxManifest } from './proxmox/manifest';
import { headscaleManifest } from './headscale/manifest';
import { tailscaleManifest } from './tailscale/manifest';
import type { DeviceIntegrationManifest, ServiceIntegrationManifest } from './types';

/**
 * Every device integration, in the order of the device form (browser-safe).
 * Adding one: create `src/integrations/<id>/manifest.ts` (fields, endpoint)
 * and `collect.ts` (reading), then list the manifest here and the collector
 * in `collectors.ts`. Validation, the form, the API routes and the poller all
 * read these two lists.
 */

/**
 * Stored by older versions; kept so existing devices stay valid. Not offered
 * in the form and not polled (their static stats are shown, as before).
 */
const homeassistant: DeviceIntegrationManifest = {
  id: 'homeassistant',
  name: 'Home Assistant',
  selectable: false,
  fields: [],
  connect(input, previousToken) {
    return { url: `http://${input.ip}:${input.port || 8123}/api/states`, token: input.password || previousToken || undefined };
  },
};
const custom: DeviceIntegrationManifest = { id: 'custom', name: 'Custom', selectable: false, fields: [], connect: () => ({ url: '' }) };

export const DEVICE_INTEGRATIONS: readonly DeviceIntegrationManifest[] = [glancesManifest, netdataManifest, beszelManifest, prometheusManifest, proxmoxManifest, lhmManifest, homeassistant, custom];

const BY_ID = new Map(DEVICE_INTEGRATIONS.map(integration => [integration.id, integration]));

export function getDeviceIntegration(id: string | undefined): DeviceIntegrationManifest | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Integrations offered when adding or editing a device. */
export function selectableDeviceIntegrations(): DeviceIntegrationManifest[] {
  return DEVICE_INTEGRATIONS.filter(integration => integration.selectable);
}

export const DEVICE_INTEGRATION_IDS = DEVICE_INTEGRATIONS.map(integration => integration.id);

/**
 * Service integrations: one saved connection (`config.integrations`) used by
 * widgets, instead of a device to monitor. Adding one: `<id>/manifest.ts`
 * (fields), server code reading it, then list the manifest here.
 */
export const SERVICE_INTEGRATIONS: readonly ServiceIntegrationManifest[] = [tmdbManifest, tailscaleManifest, headscaleManifest, gluetunManifest, nutManifest, apcupsdManifest, piholeManifest, adguardManifest, technitiumManifest, immichManifest, photoprismManifest, piwigoManifest, librephotosManifest, customapiManifest, jellyfinManifest, embyManifest, plexManifest, navidromeManifest, sonarrManifest, radarrManifest, lidarrManifest, prowlarrManifest, qbittorrentManifest, transmissionManifest, delugeManifest, sabnzbdManifest, nzbgetManifest];

export function getServiceIntegration(id: string | undefined): ServiceIntegrationManifest | undefined {
  return SERVICE_INTEGRATIONS.find(integration => integration.id === id);
}
