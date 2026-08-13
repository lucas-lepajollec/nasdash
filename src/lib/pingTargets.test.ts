import { describe, expect, it } from 'vitest';
import {
  collectConfiguredPingTargets,
  isConfiguredPingTarget,
  normalizePingTarget,
} from './pingTargets';
import type { DashboardConfig } from './types';

const config = {
  version: 1,
  settings: { title: 'Test', showMonitor: false },
  devices: [],
  categories: [{
    id: 'services',
    title: 'Services',
    emoji: 'S',
    order: 0,
    services: [{
      id: 'service-1',
      name: 'Service',
      logo: '',
      localUrl: 'http://nas.local:8080/status',
    }],
  }],
} satisfies DashboardConfig;

describe('configured ping targets', () => {
  it('normalizes an omitted scheme and ignores fragments', () => {
    expect(normalizePingTarget('nas.local:8080/status#section'))
      .toBe('http://nas.local:8080/status');
  });

  it('allows the exact configured endpoint', () => {
    const targets = collectConfiguredPingTargets(config);
    expect(isConfiguredPingTarget('http://nas.local:8080/status', targets)).toBe(true);
  });

  it('rejects another path on an otherwise allowed host', () => {
    const targets = collectConfiguredPingTargets(config);
    expect(isConfiguredPingTarget('http://nas.local:8080/admin/restart', targets)).toBe(false);
  });
});
