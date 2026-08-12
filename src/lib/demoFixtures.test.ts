import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRollingDemoCalendar } from './demoCalendar';
import { DEMO_DOCKER_SERVICES } from './demoDockerFixtures';

const fixturesDirectory = path.join(process.cwd(), 'demo', 'fixtures');
const fixtureNames = [
  'config.json',
  'services.json',
  'topology.json',
  'calendar.json',
  'custom_tabs.json',
  'users.json',
];

describe('public demo fixtures', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ships a complete parseable data set', () => {
    for (const name of fixtureNames) {
      const content = fs.readFileSync(path.join(fixturesDirectory, name), 'utf8');
      expect(() => JSON.parse(content), name).not.toThrow();
    }
  });

  it('contains no private-network address or credential field', () => {
    const content = fixtureNames
      .map(name => fs.readFileSync(path.join(fixturesDirectory, name), 'utf8'))
      .join('\n');

    expect(content).not.toMatch(/\b10(?:\.\d{1,3}){3}\b/);
    expect(content).not.toMatch(/\b192\.168(?:\.\d{1,3}){2}\b/);
    expect(content).not.toMatch(/\b172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}\b/);
    expect(content).not.toMatch(/"(?:token|password|clientSecret)"\s*:/i);
    expect(fs.existsSync(path.join(fixturesDirectory, 'jwt.secret'))).toBe(false);
    expect(fs.existsSync(path.join(fixturesDirectory, 'encryption.key'))).toBe(false);
  });

  it('enables only simulated privileged product features', () => {
    const config = JSON.parse(
      fs.readFileSync(path.join(fixturesDirectory, 'config.json'), 'utf8'),
    );

    expect(config.settings.securityMode).toBe('public');
    expect(config.settings.allowDockerActions).toBe(true);
    expect(config.settings.hideDockerActions).toBe(false);
  });

  it('keeps the Home device presentation complete and generic', () => {
    const config = JSON.parse(
      fs.readFileSync(path.join(fixturesDirectory, 'config.json'), 'utf8'),
    );
    const devices = config.devices as Array<{ id: string; system?: string }>;
    const widgetConfigs = config.settings.panels['home-left'].widgets
      .find((widget: { type: string }) => widget.type === 'devices')
      .props.deviceConfigs;

    expect(devices).toHaveLength(2);
    expect(devices.every(device => Boolean(device.system))).toBe(true);
    expect(widgetConfigs['demo-device-1']).toMatchObject({
      statStyle: 'vertical',
      colsDesktop: 2,
      colsMobile: 2,
      visibleStats: ['CPU', 'RAM', 'Disque (Données)', 'Disque (Système)'],
    });
    expect(widgetConfigs['demo-device-2']).toMatchObject({
      statStyle: 'graph',
      colsDesktop: 2,
      colsMobile: 2,
      visibleStats: ['CPU', 'RAM', 'Stockage', 'GPU'],
    });
  });

  it('uses a responsive spacer after the service grid', () => {
    const config = JSON.parse(
      fs.readFileSync(path.join(fixturesDirectory, 'config.json'), 'utf8'),
    );

    expect(config.settings.homeWidgets).toEqual([
      expect.objectContaining({
        type: 'spacer',
        order: 4,
        height: 180,
      }),
    ]);
  });

  it('generates one calendar event in the future for every demo session', () => {
    const now = new Date('2026-08-11T12:00:00.000Z');
    const events = createRollingDemoCalendar(now);

    expect(events).toHaveLength(1);
    expect(new Date(events[0].start).getTime()).toBeGreaterThan(now.getTime());
    expect(new Date(events[0].end!).getTime()).toBeGreaterThan(new Date(events[0].start).getTime());
  });

  it('can freeze the rolling calendar for reproducible documentation captures', () => {
    const reference = '2026-08-12T10:00:00.000Z';
    vi.stubEnv('NASDASH_DEMO_REFERENCE_TIME', reference);

    expect(createRollingDemoCalendar()).toEqual(createRollingDemoCalendar(new Date(reference)));
  });

  it('ships a representative service catalogue with safe links and logos', () => {
    const categories = JSON.parse(
      fs.readFileSync(path.join(fixturesDirectory, 'services.json'), 'utf8'),
    ) as Array<{ services?: Array<{ id: string; localUrl: string; logo: string }> }>;
    const services = categories.flatMap(category => category.services || []);

    expect(services).toHaveLength(20);
    expect(new Set(services.map(service => service.id)).size).toBe(services.length);
    for (const service of services) {
      expect(new URL(service.localUrl).hostname).toMatch(/\.demo\.invalid$/);
      expect(new URL(service.logo).hostname).toBe('cdn.jsdelivr.net');
      expect(service.logo).toMatch(/\/homarr-labs\/dashboard-icons\/svg\/[a-z0-9-]+\.svg$/);
    }
  });

  it('ships a substantial, internally consistent documentation-only topology', () => {
    const topology = JSON.parse(
      fs.readFileSync(path.join(fixturesDirectory, 'topology.json'), 'utf8'),
    ) as {
      nodes: Array<{ id: string; ip?: string; groupId?: string; linkedServiceId?: string; linkedContainerId?: string }>;
      groups: Array<{ id: string }>;
      connections: Array<{ id: string; fromId: string; toId: string }>;
    };
    const nodeIds = new Set(topology.nodes.map(node => node.id));
    const groupIds = new Set(topology.groups.map(group => group.id));
    const entityIds = new Set([...nodeIds, ...groupIds]);

    expect(topology.nodes.length).toBeGreaterThanOrEqual(16);
    expect(topology.groups.length).toBeGreaterThanOrEqual(6);
    expect(topology.connections.length).toBeGreaterThanOrEqual(12);
    expect(entityIds.size).toBe(topology.nodes.length + topology.groups.length);

    for (const node of topology.nodes) {
      if (node.ip) {
        expect(node.ip).toMatch(/^(?:192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}$/);
      }
      if (node.groupId) expect(groupIds.has(node.groupId)).toBe(true);
    }
    for (const connection of topology.connections) {
      expect(entityIds.has(connection.fromId), connection.id).toBe(true);
      expect(entityIds.has(connection.toId), connection.id).toBe(true);
    }
  });

  it('represents every Home service in Docker and on the network map', () => {
    const categories = JSON.parse(
      fs.readFileSync(path.join(fixturesDirectory, 'services.json'), 'utf8'),
    ) as Array<{ services?: Array<{ id: string }> }>;
    const topology = JSON.parse(
      fs.readFileSync(path.join(fixturesDirectory, 'topology.json'), 'utf8'),
    ) as {
      nodes: Array<{ linkedServiceId?: string; linkedContainerId?: string }>;
    };

    const homeServiceIds = categories.flatMap(category => category.services || []).map(service => service.id).sort();
    const dockerServiceIds = DEMO_DOCKER_SERVICES.map(service => service.serviceId).sort();
    const networkServiceIds = topology.nodes.flatMap(node => node.linkedServiceId ? [node.linkedServiceId] : []).sort();
    const dockerIds = new Set(DEMO_DOCKER_SERVICES.map(service => service.id));

    expect(DEMO_DOCKER_SERVICES).toHaveLength(20);
    expect(new Set(dockerServiceIds).size).toBe(20);
    expect(DEMO_DOCKER_SERVICES.every(service => service.id.length === 12)).toBe(true);
    expect(dockerServiceIds).toEqual(homeServiceIds);
    expect(networkServiceIds).toEqual(homeServiceIds);

    for (const node of topology.nodes) {
      if (node.linkedServiceId) {
        expect(node.linkedContainerId, node.linkedServiceId).toBeTruthy();
        expect(dockerIds.has(node.linkedContainerId!), node.linkedServiceId).toBe(true);
      }
    }
  });
});
