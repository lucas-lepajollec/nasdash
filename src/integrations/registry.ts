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
export const SERVICE_INTEGRATIONS: readonly ServiceIntegrationManifest[] = [tailscaleManifest, headscaleManifest];

export function getServiceIntegration(id: string | undefined): ServiceIntegrationManifest | undefined {
  return SERVICE_INTEGRATIONS.find(integration => integration.id === id);
}
