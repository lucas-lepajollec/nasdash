import { describe, expect, it } from 'vitest';
import {
  AccessPrincipal,
  READ_ACCESS,
  canAccessTab,
  canAccessWidget,
  canReadResource,
} from './access';
import { buildConfigForPrincipal } from './configAccess';
import { DashboardConfig } from './types';

const admin: AccessPrincipal = {
  username: 'admin',
  role: 'admin',
  allowedTabs: [],
  allowedWidgets: [],
  isAnonymous: false,
};

const restrictedViewer: AccessPrincipal = {
  username: 'alice',
  role: 'viewer',
  allowedTabs: ['dashboard'],
  allowedWidgets: ['calendar'],
  isAnonymous: false,
};

const publicViewer: AccessPrincipal = {
  username: 'viewer',
  role: 'viewer',
  allowedTabs: [],
  allowedWidgets: [],
  isAnonymous: true,
};

describe('server access matrix', () => {
  it('allows an admin to read every tab and widget', () => {
    expect(canAccessTab(admin, 'docker')).toBe(true);
    expect(canAccessWidget(admin, 'dockercontainers')).toBe(true);
  });

  it('keeps empty viewer permission lists unrestricted for backward compatibility', () => {
    expect(canAccessTab(publicViewer, 'docker')).toBe(true);
    expect(canAccessWidget(publicViewer, 'networkgraph')).toBe(true);
  });

  it('enforces non-empty tab and widget allowlists', () => {
    expect(canAccessTab(restrictedViewer, 'dashboard')).toBe(true);
    expect(canAccessTab(restrictedViewer, 'docker')).toBe(false);
    expect(canAccessWidget(restrictedViewer, 'calendar')).toBe(true);
    expect(canAccessWidget(restrictedViewer, 'dockercontainers')).toBe(false);
  });

  it('allows a resource when either its tab or one of its widgets is allowed', () => {
    expect(canReadResource(restrictedViewer, { tabs: ['docker'], widgets: ['calendar'] })).toBe(true);
    expect(canReadResource(restrictedViewer, { tabs: ['docker'], widgets: ['dockercontainers'] })).toBe(false);
  });

  it('maps backend resources to the same tabs and widgets as the interface', () => {
    expect(canReadResource(restrictedViewer, READ_ACCESS.calendar)).toBe(true);
    expect(canReadResource(restrictedViewer, READ_ACCESS.dockerContainers)).toBe(false);
    expect(canReadResource(restrictedViewer, READ_ACCESS.topology)).toBe(false);
  });
});

describe('configuration filtering', () => {
  const config = {
    version: 1,
    settings: {
      title: 'NasDash',
      showMonitor: true,
      tailscaleTailnet: 'example.ts.net',
      tailscaleClientId: 'client-id',
      tailscaleClientSecret: 'secret',
      networkTopology: { nodes: [], groups: [], connections: [] },
    },
    categories: [
      { id: 'public', title: 'Public', emoji: 'P', order: 0, services: [] },
      { id: 'secret', title: 'Secret', emoji: 'S', order: 1, isSecret: true, services: [] },
    ],
    devices: [{
      id: 'device-1',
      name: 'NAS',
      host: '192.168.1.10',
      icon: 'N',
      api: { type: 'glances', url: 'http://192.168.1.10', token: 'device-secret' },
    }],
    dockerHosts: [{ id: 'docker-1', name: 'Docker', icon: 'D', type: 'tcp', url: 'http://192.168.1.20' }],
    dockerActions: [{ id: 'action-1', name: 'Restart', icon: 'R', actionType: 'start', targets: [] }],
    localEvents: [{ id: 'event-1', title: 'Private event', start: '2026-08-09' }],
    slots: [
      { id: 'slot-public', type: 'category', category: { id: 'public', isSecret: false } },
      { id: 'slot-secret', type: 'category', category: { id: 'secret', isSecret: true } },
    ],
  } as DashboardConfig & { slots: Array<Record<string, unknown>> };

  it('masks credentials but keeps the complete configuration for admins', () => {
    const result = buildConfigForPrincipal(config, admin) as typeof config;

    expect(result.categories).toHaveLength(2);
    expect(result.devices?.[0].api?.token).toBe('********');
    expect(result.settings.tailscaleClientSecret).toBe('********');
  });

  it('removes secret categories and resources outside a restricted viewer allowlist', () => {
    const result = buildConfigForPrincipal(config, restrictedViewer) as typeof config;

    expect(result.categories.map(category => category.id)).toEqual(['public']);
    expect(result.slots.map(slot => slot.id)).toEqual(['slot-public']);
    expect(result.dockerHosts).toEqual([]);
    expect(result.dockerActions).toEqual([]);
    expect(result.localEvents).toHaveLength(1);
    expect(result.settings.networkTopology).toBeUndefined();
    expect(result.settings.tailscaleClientId).toBeUndefined();
  });

  it('never sends backend-only Docker URLs or credential markers to a viewer', () => {
    const result = buildConfigForPrincipal(config, publicViewer);

    expect(result.dockerHosts?.[0].url).toBe('');
    expect(result.devices?.[0].api?.token).toBeUndefined();
    expect(result.settings.tailscaleClientSecret).toBeUndefined();
  });
});
