import { describe, expect, it } from 'vitest';
import type { DashboardConfig } from '@/lib/types';
import { devicesUsing, migrateDeviceConnections, monitoringInstances, resolveDeviceConnection } from './sources';

const plain = (value: string) => value;
const sealed = (value: string) => `enc(${value})`;
const opened = (value: string) => value.replace(/^enc\((.*)\)$/, '$1');

function config(): Pick<DashboardConfig, 'integrations' | 'devices'> {
  return {
    integrations: [{ id: 'tailscale-main', type: 'tailscale', name: 'Tailscale', settings: {} }],
    devices: [
      { id: 'nas', name: 'NAS', host: '', icon: '', api: { type: 'glances', url: 'http://192.0.2.10:61208', ip: '192.0.2.10', port: '61208', token: 'enc(me:pw)' } },
      { id: 'pc', name: 'PC', host: '', icon: '', api: { type: 'beszel', url: 'http://192.0.2.5:8090', ip: '192.0.2.5', port: '8090', username: 'a@b.c', token: 'enc(a@b.c:secret)', target: 'pc' } },
      { id: 'srv', name: 'Server', host: '', icon: '', api: { type: 'beszel', url: 'http://192.0.2.5:8090', ip: '192.0.2.5', port: '8090', username: 'a@b.c', token: 'enc(a@b.c:secret)', target: 'srv' } },
      { id: 'vm', name: 'VM', host: '', icon: '', api: { type: 'proxmox', url: 'https://192.0.2.7:8006/api2/json/nodes/pve/qemu/101/status/current', ip: '192.0.2.7', port: '8006', username: 'root@pam!nd', nodeName: 'pve', vmid: '101', vmType: 'qemu', token: 'enc(root@pam!nd=uuid)' } },
      { id: 'old', name: 'Old', host: '', icon: '', api: { type: 'homeassistant', url: '' } },
    ],
  };
}

describe('monitoring sources', () => {
  it('moves device connections into saved connections, one per server', () => {
    const data = config();
    expect(migrateDeviceConnections(data, opened, sealed)).toBe(true);
    const monitoring = monitoringInstances(data);
    expect(monitoring.map(instance => instance.type)).toEqual(['glances', 'beszel', 'proxmox']);
    // Two Beszel systems on the same hub share one connection.
    const beszel = monitoring.find(instance => instance.type === 'beszel')!;
    expect(devicesUsing(data, beszel.id).map(device => device.id)).toEqual(['pc', 'srv']);
    expect(beszel.secrets).toEqual({ password: 'enc(secret)' });
    expect(beszel.settings).toMatchObject({ ip: '192.0.2.5', port: '8090', username: 'a@b.c' });
    const vm = data.devices!.find(device => device.id === 'vm')!;
    expect(vm.api).toBeUndefined();
    expect(vm.source?.values).toEqual({ nodeName: 'pve', vmid: '101', vmType: 'qemu' });
    expect(monitoring.find(instance => instance.type === 'proxmox')!.secrets).toEqual({ password: 'enc(uuid)' });
    // Legacy types stay as they were.
    expect(data.devices!.find(device => device.id === 'old')!.api).toBeDefined();
    expect(migrateDeviceConnections(data, opened, sealed)).toBe(false);
  });

  it('reads a device through its saved connection, with the fields of the machine', () => {
    const data = config();
    migrateDeviceConnections(data, opened, plain);
    for (const instance of data.integrations ?? []) if (instance.secrets?.password) instance.secrets.password = opened(instance.secrets.password);
    const pc = resolveDeviceConnection(data.devices!.find(device => device.id === 'pc')!, data)!;
    expect(pc).toMatchObject({ type: 'beszel', connection: { url: 'http://192.0.2.5:8090', token: 'a@b.c:secret', target: 'pc' } });
    const vm = resolveDeviceConnection(data.devices!.find(device => device.id === 'vm')!, data)!;
    expect(vm.connection).toMatchObject({ url: 'https://192.0.2.7:8006/api2/json/nodes/pve/qemu/101/status/current', token: 'root@pam!nd=uuid', vmid: '101' });
    // A removed connection leaves the device without a source.
    expect(resolveDeviceConnection({ id: 'x', name: 'X', host: '', icon: '', source: { integrationId: 'gone' } }, data)).toBeNull();
  });
});
