import { describe, expect, it } from 'vitest';
import { validateConfigMutationBody } from '@/lib/configEntityValidation';
import type { DashboardConfig } from '@/lib/types';
import { findInstance, mapInstanceSecrets, maskInstanceSecrets, MASKED_SECRET, migrateLegacyIntegrations, SecretReuseError, stripInstanceSecrets, upsertInstance } from './instances';
import { sortTailscaleDevices, toTailscaleDevice } from './tailscale/collect';
import { toHeadscaleDevices } from './headscale/collect';
import headscaleNodes from './headscale/samples/nodes.json';
import { latestInstance } from './instances';

type Config = Pick<DashboardConfig, 'integrations'> & { settings?: Record<string, unknown> };

describe('integration instances', () => {
  it('moves the historical Tailscale settings into a saved connection', () => {
    const config: Config = { settings: { title: 'NasDash', tailscaleTailnet: 'me.ts.net', tailscaleClientId: 'k123', tailscaleClientSecret: 'enc:aes256:x' } };
    expect(migrateLegacyIntegrations(config)).toBe(true);
    expect(config.settings).toEqual({ title: 'NasDash' });
    expect(findInstance(config, 'tailscale')).toEqual({
      id: 'tailscale-main', type: 'tailscale', name: 'Tailscale',
      settings: { tailnet: 'me.ts.net', clientId: 'k123' }, secrets: { clientSecret: 'enc:aes256:x' },
    });
    // Nothing left to move the second time.
    expect(migrateLegacyIntegrations(config)).toBe(false);
  });

  it('drops empty legacy keys without creating a connection', () => {
    const config: Config = { settings: { tailscaleTailnet: '', tailscaleClientId: '' } };
    expect(migrateLegacyIntegrations(config)).toBe(true);
    expect(config.integrations ?? []).toEqual([]);
  });

  it('keeps a stored secret when it comes back masked or empty', () => {
    const config: Config = {};
    upsertInstance(config, { type: 'tailscale', name: 'Tailscale', settings: { tailnet: 'a' }, secrets: { clientSecret: 's1' } });
    upsertInstance(config, { type: 'tailscale', settings: { tailnet: 'b' }, secrets: { clientSecret: MASKED_SECRET } });
    upsertInstance(config, { type: 'tailscale', secrets: { clientSecret: '' } });
    expect(config.integrations).toHaveLength(1);
    expect(config.integrations?.[0]).toMatchObject({ id: 'tailscale-main', settings: { tailnet: 'b' }, secrets: { clientSecret: 's1' } });
    upsertInstance(config, { type: 'tailscale', secrets: { clientSecret: null } });
    expect(config.integrations?.[0].secrets).toEqual({});
  });

  it('encrypts, masks and strips only secrets', () => {
    const config: Config = { integrations: [{ id: 't', type: 'tailscale', name: 'T', settings: { tailnet: 'a' }, secrets: { clientSecret: 's' } }] };
    mapInstanceSecrets(config, value => `enc(${value})`);
    expect(config.integrations?.[0].secrets?.clientSecret).toBe('enc(s)');
    maskInstanceSecrets(config);
    expect(config.integrations?.[0]).toMatchObject({ settings: { tailnet: 'a' }, secrets: { clientSecret: MASKED_SECRET } });
    stripInstanceSecrets(config);
    expect(config.integrations?.[0].secrets).toBeUndefined();
  });

  it('accepts only the fields declared by the manifest', () => {
    const ok = { integration: { type: 'tailscale', settings: { tailnet: 'a', clientId: 'b' }, secrets: { clientSecret: 'c' } } };
    expect(() => validateConfigMutationBody(ok, 'integration', 'PUT')).not.toThrow();
    expect(() => validateConfigMutationBody({ integration: { type: 'nope' } }, 'integration', 'PUT')).toThrow();
    // A secret cannot be smuggled in plain settings, nor an unknown field.
    expect(() => validateConfigMutationBody({ integration: { type: 'tailscale', settings: { clientSecret: 'x' } } }, 'integration', 'PUT')).toThrow();
    expect(() => validateConfigMutationBody({ integration: { type: 'tailscale', secrets: { tailnet: 'x' } } }, 'integration', 'PUT')).toThrow();
  });
});

describe('secrets and addresses', () => {
  const saved = () => ({ integrations: [{ id: 'glances-1', type: 'glances', name: 'NAS', settings: { ip: '10.0.0.2', port: '61208' }, secrets: { password: 'stored' } }] });

  it('keeps a stored secret while the address stays the same', () => {
    const config = saved();
    upsertInstance(config, { id: 'glances-1', type: 'glances', settings: { ip: '10.0.0.2', port: '61208', username: 'admin' }, secrets: { password: MASKED_SECRET } });
    expect(config.integrations[0].secrets?.password).toBe('stored');
  });

  it('asks for the secret again when the address changes', () => {
    const config = saved();
    expect(() => upsertInstance(config, { id: 'glances-1', type: 'glances', settings: { ip: 'attacker.example', port: '61208' }, secrets: { password: MASKED_SECRET } })).toThrow(SecretReuseError);
    expect(config.integrations[0].settings.ip).toBe('10.0.0.2');
    upsertInstance(config, { id: 'glances-1', type: 'glances', settings: { ip: 'nas.lan', port: '61208' }, secrets: { password: 'typed again' } });
    expect(config.integrations[0].secrets?.password).toBe('typed again');
  });
});

describe('tailscale devices', () => {
  it('names and sorts devices like before', () => {
    const now = Date.parse('2026-09-24T12:00:00Z');
    const devices = [
      toTailscaleDevice({ nodeId: '1', hostname: 'localhost', givenName: 'phone', addresses: ['100.64.0.2'], lastSeen: '2026-09-24T11:58:00Z' }, now),
      toTailscaleDevice({ nodeId: '2', hostname: 'nas', os: 'linux', addresses: ['100.64.0.1'], clientConnectivity: { online: false } }, now),
      toTailscaleDevice({ nodeId: '3', name: 'laptop.tail.ts.net', lastSeen: '2026-09-20T00:00:00Z' }, now),
    ];
    expect(sortTailscaleDevices(devices).map(device => [device.hostname, device.online])).toEqual([['phone', true], ['laptop', false], ['nas', false]]);
  });
});

describe('headscale', () => {
  it('lists nodes like Tailscale devices (IPv4 first, online first)', () => {
    expect(toHeadscaleDevices(headscaleNodes.nodes).map(device => [device.hostname, device.ip, device.online])).toEqual([
      ['atlas-nas', '100.64.0.1', true],
      ['laptop', '100.64.0.2', false],
    ]);
  });

  it('uses the mesh connection saved last', () => {
    const config: Config = { integrations: [
      { id: 't', type: 'tailscale', name: 'T', settings: {}, updatedAt: '2026-09-01T00:00:00Z' },
      { id: 'h', type: 'headscale', name: 'H', settings: {}, updatedAt: '2026-09-20T00:00:00Z' },
    ] };
    expect(latestInstance(config, ['tailscale', 'headscale'])?.type).toBe('headscale');
  });
});
