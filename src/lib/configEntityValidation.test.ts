import { describe, expect, it } from 'vitest';
import { validateConfigMutationBody } from './configEntityValidation';

describe('configuration entity payloads', () => {
  it('accepts the category editor payload including its services', () => {
    expect(() => validateConfigMutationBody({
      type: 'category',
      id: 'category-1',
      title: 'Applications',
      emoji: '🚀',
      isSecret: false,
      layout: 'bento-logo-medium',
      services: [{
        id: 'service-1',
        name: 'Jellyfin',
        logo: '/api/logos/jellyfin.png',
        localUrl: 'http://192.168.1.20:8096',
        secondaryUrl: 'https://jellyfin.example.test',
        secondaryLogo: '',
      }],
    }, 'category', 'PUT')).not.toThrow();
  });

  it.each(['glances', 'homeassistant', 'proxmox', 'lhm', 'custom']) (
    'accepts the real device form shape for %s',
    apiType => {
      expect(() => validateConfigMutationBody({
        type: 'device',
        id: 'device-1',
        name: 'Server',
        host: 'server.local',
        icon: '🖥️',
        api: {
          type: apiType,
          ip: '192.168.1.20',
          port: '61208',
          username: 'monitor',
          password: '',
          nodeName: apiType === 'proxmox' ? 'pve' : undefined,
          vmid: apiType === 'proxmox' ? '100' : undefined,
          vmType: apiType === 'proxmox' ? 'qemu' : undefined,
        },
      }, 'device', 'PUT')).not.toThrow();
    },
  );

  it('preserves the legacy circle display style during device reordering', () => {
    expect(() => validateConfigMutationBody({
      type: 'reorderDevices',
      devices: [{
        id: 'device-legacy',
        name: 'Legacy device',
        host: '192.168.1.2',
        icon: 'Server',
        statStyle: 'circle',
        stats: [],
      }],
    }, 'reorderDevices', 'PUT')).not.toThrow();
  });

  it('accepts the Docker action editor payload', () => {
    expect(() => validateConfigMutationBody({
      type: 'dockerAction',
      name: 'Restart media',
      icon: 'RefreshCw',
      actionType: 'switch',
      targets: [{ hostId: 'docker-host-1', containerName: 'jellyfin' }],
    }, 'dockerAction', 'POST')).not.toThrow();
  });

  it('rejects malformed reorder payloads before route code can crash', () => {
    expect(() => validateConfigMutationBody({
      type: 'reorderDevices',
      devices: { id: 'not-an-array' },
    }, 'reorderDevices', 'PUT')).toThrow('liste');
  });

  it('rejects invalid nested device and Docker values', () => {
    expect(() => validateConfigMutationBody({
      type: 'device',
      name: 'Server',
      api: { type: 'unsupported', ip: '127.0.0.1' },
    }, 'device', 'POST')).toThrow('valeur invalide');

    expect(() => validateConfigMutationBody({
      type: 'dockerAction',
      targets: [{ hostId: '../escape', containerName: 'service' }],
    }, 'dockerAction', 'POST')).toThrow('identifiant');
  });

  it('bounds arbitrary widget properties without restricting normal settings payloads', () => {
    expect(() => validateConfigMutationBody({
      type: 'homeWidgetProps',
      id: 'clock-1',
      props: { timezone: 'Europe/Paris', nested: { enabled: true } },
    }, 'homeWidgetProps', 'PUT')).not.toThrow();

    expect(() => validateConfigMutationBody({
      type: 'homeWidgetProps',
      id: 'clock-1',
      props: JSON.parse('{"__proto__":{"polluted":true}}'),
    }, 'homeWidgetProps', 'PUT')).toThrow('propriété invalide');

    expect(() => validateConfigMutationBody({
      type: 'settings',
      networkTopology: { nodes: [], groups: [], connections: [] },
    }, 'settings', 'PUT')).not.toThrow();
  });
});
