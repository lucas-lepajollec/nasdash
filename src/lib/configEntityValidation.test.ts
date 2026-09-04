import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

  it('accepts a complete Docker host URL and rejects incomplete fields', () => {
    expect(() => validateConfigMutationBody({
      type: 'dockerHost',
      name: 'NAS',
      icon: 'Docker',
      url: 'http://192.168.1.20:2375',
    }, 'dockerHost', 'POST')).not.toThrow();

    expect(() => validateConfigMutationBody({
      type: 'dockerHost',
      name: 'NAS',
      icon: 'Docker',
      url: '192.168.1.20:2375',
    }, 'dockerHost', 'POST')).toThrow('URL complète');
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

  it('accepts the complete settings shapes emitted by the current UI', () => {
    expect(() => validateConfigMutationBody({
      type: 'settings',
      uiLanguage: 'de',
      mode: 'light',
      title: 'Mon homelab',
      titleLogo: '/api/logos/title.png',
      headerLayoutDesktop: { left: 'title', center: 'search', right: 'menu', splitMenuAround: 'none' },
      headerLayoutMobile: { left: 'title', center: 'search' },
      hiddenTabs: ['networks'],
      tabOrder: ['home', 'widgets', 'docker', 'networks'],
      tabIcons: { home: '🏠', 'custom-tab-1': '🧪' },
      tabs: {
        home: { hideLeftSidebar: false, leftSidebarPosition: 'left', bottomPanelTitle: 'Activité réseau' },
        docker: { hideWidgetsSidebar: false, widgetsSidebarPosition: 'right', dockerPanelPosition: 'left' },
        networks: { networksPanelPosition: 'left', cardSize: 'compact' },
      },
      panels: {
        'home-left': { widgets: [{ id: 'weather-1', type: 'weather', props: { locationId: 'paris' } }] },
      },
      homeWidgets: [{ id: 'clock-1', type: 'clock', order: 0, props: { timezone: 'Europe/Paris' } }],
      weatherLocation: { lat: 48.8566, lon: 2.3522, name: 'Paris' },
      weatherLocations: [{ id: 'paris', lat: 48.8566, lon: 2.3522, name: 'Paris' }],
      appearanceProfiles: [{
        id: 'desktop-profile',
        name: 'Bureau',
        settings: { theme: 'nasdash', backgroundImage: '', globalFont: 'Outfit', borderRadius: 12, cardOpacity: 0.8 },
      }],
      mobileAppearanceProfiles: [{
        id: 'mobile-profile',
        name: 'Téléphone',
        settings: { mobileTheme: 'nasdash', mobileBorderRadius: 10, mobileCardOpacity: 0.9 },
      }],
      hideDockerContainers: false,
      dockerContainersSidebar: 'right',
      dockerContainersOrder: 4,
      'docker-dockercontainersProps': { hostId: 'docker-host-1', compact: true },
    }, 'settings', 'PUT')).not.toThrow();
  });

  it('accepts only maintained interface languages', () => {
    expect(() => validateConfigMutationBody({
      type: 'settings',
      uiLanguage: 'fr',
    }, 'settings', 'PUT')).not.toThrow();

    expect(() => validateConfigMutationBody({
      type: 'settings',
      uiLanguage: 'it',
    }, 'settings', 'PUT')).toThrow();
  });

  it('keeps the nullable mobile overrides sent by the sliders compatible', () => {
    expect(() => validateConfigMutationBody({
      type: 'settings',
      mobileBorderRadius: null,
      mobileCardOpacity: null,
    }, 'settings', 'PUT')).not.toThrow();
  });

  it.each(['data/config.example.json', 'src/lib/fixtures/legacy-demo-config.json'])(
    'accepts the versioned legacy-compatible settings in %s',
    file => {
      const config = JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8'));
      expect(() => validateConfigMutationBody({
        type: 'settings',
        ...config.settings,
        appearanceProfiles: config.appearanceProfiles,
      }, 'settings', 'PUT')).not.toThrow();
    },
  );

  it('rejects malformed nested settings before they reach persistence', () => {
    expect(() => validateConfigMutationBody({
      type: 'settings',
      tabs: { docker: { hideWidgetsSidebar: 'false' } },
    }, 'settings', 'PUT')).toThrow('booléen');

    expect(() => validateConfigMutationBody({
      type: 'settings',
      panels: { 'home-left': { widgets: { id: 'not-an-array' } } },
    }, 'settings', 'PUT')).toThrow('liste');

    expect(() => validateConfigMutationBody({
      type: 'settings',
      weatherLocations: [{ id: 'invalid-city', lat: 190, lon: 2, name: 'Impossible' }],
    }, 'settings', 'PUT')).toThrow('limites');

    expect(() => validateConfigMutationBody({
      type: 'settings',
      appearanceProfiles: [{ id: 'profile', name: 'Cassé', settings: { cardOpacity: 4 } }],
    }, 'settings', 'PUT')).toThrow('limites');
  });
});
