import type { DashboardConfig, Device, IntegrationInstance } from '@/lib/types';
import { getDeviceIntegration, selectableDeviceIntegrations } from './registry';
import type { ConnectionField, ConnectionInput, DeviceIntegrationManifest, ResolvedConnection } from './types';

/**
 * Monitoring sources: a saved connection to Glances, Netdata, Beszel,
 * Prometheus, Proxmox VE or Libre Hardware Monitor (`config.integrations`,
 * like Tailscale), used by one or several devices. The connection holds the
 * address, port, credentials and certificate choice; each device holds only
 * its own fields (`Device.source.values`: Beszel system, Prometheus
 * instance, Proxmox node or VM). Pure functions, shared by server and forms.
 */

/** Integrations whose connection serves several machines (the machine is picked per device). */
export const SERVER_SOURCES = ['beszel', 'prometheus', 'proxmox'];

export const isMonitoringType = (type: string | undefined) => !!type && selectableDeviceIntegrations().some(manifest => manifest.id === type);

export const connectionFields = (manifest: DeviceIntegrationManifest): ConnectionField[] => manifest.fields.filter(field => field.scope !== 'machine');
export const machineFields = (manifest: DeviceIntegrationManifest): ConnectionField[] => manifest.fields.filter(field => field.scope === 'machine');

/** Saved monitoring connections, in the order of the catalogue. */
export function monitoringInstances(config: Pick<DashboardConfig, 'integrations'> | null | undefined): IntegrationInstance[] {
  const order = selectableDeviceIntegrations().map(manifest => manifest.id);
  return (config?.integrations ?? []).filter(instance => order.includes(instance.type)).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
}

/** The form input of a device's connection: the saved connection's values and the device's own. */
export function sourceInput(instance: IntegrationInstance, values: Record<string, string> | undefined): ConnectionInput {
  const settings = instance.settings ?? {};
  return {
    ip: settings.ip, port: settings.port, username: settings.username,
    password: instance.secrets?.password,
    allowSelfSigned: settings.allowSelfSigned === 'true',
    target: values?.target, nodeName: values?.nodeName, vmid: values?.vmid,
    vmType: values?.vmType === 'lxc' ? 'lxc' : values?.vmType === 'qemu' ? 'qemu' : undefined,
  };
}

/**
 * The endpoint a device is read from (server side, secrets decrypted):
 * through its saved connection, or from the legacy `api` stored on it.
 */
export function resolveDeviceConnection(device: Device, config: Pick<DashboardConfig, 'integrations'>): { type: string; connection: Omit<ResolvedConnection, 'url' | 'token'> & { url: string; token?: string } } | null {
  if (device.source) {
    const instance = config.integrations?.find(candidate => candidate.id === device.source!.integrationId);
    const manifest = getDeviceIntegration(instance?.type);
    if (!instance || !manifest) return null;
    const input = sourceInput(instance, device.source.values);
    const { url, token } = manifest.connect(input);
    return { type: manifest.id, connection: { url, token, vmid: input.vmid, vmType: input.vmType, allowSelfSigned: input.allowSelfSigned === true, target: input.target } };
  }
  if (!device.api) return null;
  return {
    type: device.api.type,
    connection: { url: device.api.url, token: device.api.token, vmid: device.api.vmid, vmType: device.api.vmType, allowSelfSigned: device.api.allowSelfSigned === true, target: device.api.target },
  };
}

/** Address, port and user read back from a legacy endpoint URL when the device did not keep them. */
function addressOf(url: string | undefined): { ip?: string; port?: string } {
  if (!url) return {};
  try {
    const parsed = new URL(url);
    return { ip: `${parsed.protocol}//${parsed.hostname}`, port: parsed.port || undefined };
  } catch {
    return {};
  }
}

/**
 * Moves the connections stored on devices into saved monitoring connections
 * (`<type>-<n>`), one per address for single-machine sources and one per
 * server for Beszel, Prometheus and Proxmox (devices on the same server share
 * it). `readSecret` decrypts the stored token, `writeSecret` encrypts the
 * password it moves. A device whose address cannot be read keeps its legacy
 * connection. Returns true when something moved.
 */
export function migrateDeviceConnections(
  config: Pick<DashboardConfig, 'integrations' | 'devices'>,
  readSecret: (value: string) => string,
  writeSecret: (value: string) => string,
): boolean {
  let moved = false;
  for (const device of config.devices ?? []) {
    const api = device.api;
    if (!api || device.source) continue;
    const manifest = getDeviceIntegration(api.type);
    if (!manifest || !manifest.selectable) continue;
    const fallback = addressOf(api.url);
    const ip = api.ip || fallback.ip;
    if (!ip) continue;
    const port = api.port || fallback.port || '';
    // The stored token is `user:password` (Proxmox: `tokenId=secret`).
    const token = api.token ? readSecret(api.token) : '';
    const separator = api.type === 'proxmox' ? '=' : ':';
    const at = token.indexOf(separator);
    const username = api.username || (at > 0 ? token.slice(0, at) : '');
    const password = at >= 0 ? token.slice(at + 1) : token;
    const settings: Record<string, string> = { ip, port, username, allowSelfSigned: api.allowSelfSigned ? 'true' : '' };

    config.integrations ??= [];
    const same = (instance: IntegrationInstance) => instance.type === api.type && instance.settings.ip === ip && instance.settings.port === port && (instance.settings.username ?? '') === username;
    let instance = config.integrations.find(same);
    if (!instance) {
      const count = config.integrations.filter(candidate => candidate.type === api.type).length;
      instance = {
        id: `${api.type}-${count + 1}`,
        type: api.type,
        name: SERVER_SOURCES.includes(api.type) ? manifest.name : [manifest.name, device.name].join(' · '),
        settings,
        ...(password ? { secrets: { password: writeSecret(password) } } : {}),
        updatedAt: new Date().toISOString(),
      };
      while (config.integrations.some(candidate => candidate.id === instance!.id)) instance.id = `${instance.id}-x`;
      config.integrations.push(instance);
    }
    const values: Record<string, string> = {};
    for (const field of machineFields(manifest)) {
      const value = api[field.id as 'target' | 'nodeName' | 'vmid' | 'vmType'];
      if (value) values[field.id] = value;
    }
    device.source = { integrationId: instance.id, ...(Object.keys(values).length ? { values } : {}) };
    delete device.api;
    moved = true;
  }
  return moved;
}

/** Devices using a saved connection. */
export const devicesUsing = (config: Pick<DashboardConfig, 'devices'> | null | undefined, integrationId: string) =>
  (config?.devices ?? []).filter(device => device.source?.integrationId === integrationId);
