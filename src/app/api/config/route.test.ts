import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  checkAdmin: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  readConfig: vi.fn(),
  writeConfig: vi.fn(),
  writeServices: vi.fn(),
  writeCalendar: vi.fn(),
}));

import { checkAdmin } from '@/lib/auth';
import { readConfig, writeConfig, writeServices } from '@/lib/config';
import { PUT } from './route';
import type { DockerHost } from '@/lib/types';
import { buildConfigForPrincipal } from '@/lib/configAccess';

const mockedCheckAdmin = vi.mocked(checkAdmin);
const mockedReadConfig = vi.mocked(readConfig);
const mockedWriteConfig = vi.mocked(writeConfig);
const mockedWriteServices = vi.mocked(writeServices);

describe('configuration write contracts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedCheckAdmin.mockReturnValue(null);
    mockedWriteConfig.mockReturnValue(true);
    mockedWriteServices.mockReturnValue(true);
    mockedReadConfig.mockReturnValue({
      version: 1,
      categories: [],
      settings: { title: 'NasDash', showMonitor: true },
    });
  });

  it('accepts a realistically large automatically generated network topology', async () => {
    const nodes = Array.from({ length: 300 }, (_, index) => ({
      id: `auto-node-${index}`,
      name: `Service ${index}`,
      type: 'stdsvc',
      icon: 'Server',
      ip: `10.0.${Math.floor(index / 254)}.${(index % 254) + 1}`,
    }));
    const connections = Array.from({ length: 1000 }, (_, index) => ({
      id: `auto-connection-${index}`,
      fromId: nodes[index % nodes.length].id,
      toId: nodes[(index + 1) % nodes.length].id,
      type: 'directional',
    }));
    const payload = JSON.stringify({
      type: 'settings',
      networkTopology: { nodes, groups: [], connections },
    });
    expect(new TextEncoder().encode(payload).byteLength).toBeLessThan(2 * 1024 * 1024);

    const response = await PUT(new Request('http://localhost/api/config', {
      method: 'PUT',
      body: payload,
    }) as never);

    expect(response.status).toBe(200);
    expect(mockedWriteConfig).toHaveBeenCalledOnce();
    expect(mockedWriteConfig.mock.calls[0][0].settings.networkTopology?.nodes).toHaveLength(300);
    expect(mockedWriteConfig.mock.calls[0][0].settings.networkTopology?.connections).toHaveLength(1000);
  });

  it('persists the light or dark mode sent by the appearance UI', async () => {
    const response = await PUT(new Request('http://localhost/api/config', {
      method: 'PUT',
      body: JSON.stringify({ type: 'settings', mode: 'light' }),
    }) as never);

    expect(response.status).toBe(200);
    expect(mockedWriteConfig).toHaveBeenCalledOnce();
    expect(mockedWriteConfig.mock.calls[0][0].settings.mode).toBe('light');
  });

  it('rejects malformed deep settings without writing partial configuration', async () => {
    const response = await PUT(new Request('http://localhost/api/config', {
      method: 'PUT',
      body: JSON.stringify({
        type: 'settings',
        panels: { 'home-left': { widgets: 'not-an-array' } },
      }),
    }) as never);

    expect(response.status).toBe(400);
    expect(mockedWriteConfig).not.toHaveBeenCalled();
  });

  it('returns a validation error instead of crashing on a malformed device reorder', async () => {
    const response = await PUT(new Request('http://localhost/api/config', {
      method: 'PUT',
      body: JSON.stringify({
        type: 'reorderDevices',
        devices: { id: 'not-an-array' },
      }),
    }) as never);

    expect(response.status).toBe(400);
    expect(mockedWriteConfig).not.toHaveBeenCalled();
  });

  it('rejects malformed nested services before persistence', async () => {
    mockedReadConfig.mockReturnValue({
      version: 1,
      categories: [{
        id: 'category-1',
        title: 'Apps',
        emoji: 'Folder',
        order: 0,
        services: [],
      }],
      settings: { title: 'NasDash', showMonitor: true },
    });

    const response = await PUT(new Request('http://localhost/api/config', {
      method: 'PUT',
      body: JSON.stringify({
        type: 'category',
        id: 'category-1',
        services: [{ id: '../invalid', name: 'Service', logo: '', localUrl: '' }],
      }),
    }) as never);

    expect(response.status).toBe(400);
    expect(mockedWriteServices).not.toHaveBeenCalled();
  });
});

describe('Docker host configuration writes', () => {
  const originalHosts: DockerHost[] = [
    { id: 'tcp-host', name: 'Engine', icon: 'Server', type: 'tcp', url: 'https://docker.example.test:2376', allowSelfSigned: true },
    { id: 'relay-host', name: 'Relay', icon: 'Docker', type: 'portainer', url: 'https://relay.example.test', target: '1', token: 'test-stored-token' },
    { id: 'socket-host', name: 'Socket', icon: 'Docker', type: 'socket', url: '', socketPath: '/var/run/docker.sock' },
  ];

  function put(body: Record<string, unknown>) {
    return PUT(new Request('http://localhost/api/config', { method: 'PUT', body: JSON.stringify(body) }) as never);
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockedCheckAdmin.mockReturnValue(null);
    mockedWriteConfig.mockReturnValue(true);
    mockedReadConfig.mockReturnValue({
      version: 1, categories: [], settings: { title: 'NasDash', showMonitor: true },
      dockerHosts: structuredClone(originalHosts),
    });
  });

  it('edits name, icon and URL without changing the id or array position', async () => {
    const response = await put({ type: 'dockerHost', id: 'tcp-host', name: 'Edited engine', icon: '🐋', connection: 'tcp', url: 'http://new-engine.example.test:2375' });
    expect(response.status).toBe(200);
    const host = await response.json();
    expect(host).toEqual({ id: 'tcp-host', name: 'Edited engine', icon: '🐋', type: 'tcp', url: 'http://new-engine.example.test:2375' });
    expect(mockedWriteConfig).toHaveBeenCalledOnce();
    expect(mockedWriteConfig.mock.calls[0][0].dockerHosts).toEqual([host, ...originalHosts.slice(1)]);
  });

  it.each(['portainer', 'dockhand'] as const)('keeps masked, omitted and empty %s tokens when editing the same relay kind', async connection => {
    const config = mockedReadConfig();
    config.dockerHosts![1].type = connection;
    for (const token of ['********', undefined, '']) {
      const response = await put({ type: 'dockerHost', id: 'relay-host', name: 'Edited relay', connection, url: 'https://new-relay.example.test', target: '2', token });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ id: 'relay-host', type: connection, token: '********', target: '2' });
      expect(mockedWriteConfig.mock.lastCall![0].dockerHosts![1].token).toBe('test-stored-token');
    }
  });

  it('stores a replacement relay token and masks it in the response', async () => {
    const response = await put({ type: 'dockerHost', id: 'relay-host', connection: 'portainer', url: 'https://relay.example.test', target: '1', token: 'test-replacement-token' });
    expect(response.status).toBe(200);
    expect((await response.json()).token).toBe('********');
    expect(mockedWriteConfig.mock.lastCall![0].dockerHosts![1].token).toBe('test-replacement-token');
  });

  it.each(['********', undefined, ''])('requires a real token when switching relay kinds or adding a relay token (%s)', async token => {
    for (const id of ['tcp-host', 'relay-host']) {
      const response = await put({ type: 'dockerHost', id, connection: 'dockhand', url: 'https://dockhand.example.test', target: '1', token });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'La clé API est requise.' });
    }
    expect(mockedWriteConfig).not.toHaveBeenCalled();
  });

  it('requires a token when the existing relay has none', async () => {
    delete mockedReadConfig().dockerHosts![1].token;
    const response = await put({ type: 'dockerHost', id: 'relay-host', connection: 'portainer', url: 'https://relay.example.test', target: '1', token: '********' });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'La clé API est requise.' });
    expect(mockedWriteConfig).not.toHaveBeenCalled();
  });

  it('drops URL and TLS fields when switching TCP to a socket', async () => {
    const response = await put({ type: 'dockerHost', id: 'tcp-host', connection: 'socket', socketPath: '/run/docker.sock', url: originalHosts[0].url, allowSelfSigned: true, target: '1', token: 'ignored-token' });
    expect(response.status).toBe(200);
    const host = await response.json();
    expect(host).toEqual({ id: 'tcp-host', name: 'Docker Host', icon: '🐳', type: 'socket', url: '', socketPath: '/run/docker.sock' });
    expect(mockedWriteConfig.mock.lastCall![0].dockerHosts![0]).toEqual(host);
  });

  it('drops relay credentials and socket fields for a TCP host', async () => {
    const response = await put({ type: 'dockerHost', id: 'relay-host', connection: 'tcp', url: 'https://engine.example.test:2376', socketPath: '/run/docker.sock', target: '1', token: '********', allowSelfSigned: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'relay-host', name: 'Docker Host', icon: '🐳', type: 'tcp', url: 'https://engine.example.test:2376', allowSelfSigned: true });
  });

  it('drops the stored socket path when switching to a relay', async () => {
    const response = await put({ type: 'dockerHost', id: 'socket-host', connection: 'dockhand', url: 'https://relay.example.test', target: '1', token: 'test-new-token', socketPath: '/run/docker.sock' });
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty('socketPath');
    expect(mockedWriteConfig.mock.lastCall![0].dockerHosts![2]).not.toHaveProperty('socketPath');
  });

  it('returns 404 for an unknown host without writing', async () => {
    const response = await put({ type: 'dockerHost', id: 'missing', connection: 'tcp', url: 'http://engine.example.test:2375' });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
    expect(mockedWriteConfig).not.toHaveBeenCalled();
  });

  it.each([
    { ids: ['socket-host', 'relay-host', 'tcp-host'], expected: ['socket-host', 'relay-host', 'tcp-host'] },
    { ids: ['socket-host'], expected: ['socket-host', 'tcp-host', 'relay-host'] },
    { ids: [], expected: ['tcp-host', 'relay-host', 'socket-host'] },
  ])('reorders hosts using $ids and appends omitted hosts', async ({ ids, expected }) => {
    const response = await put({ type: 'reorderDockerHosts', ids });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mockedWriteConfig.mock.lastCall![0].dockerHosts).toEqual(expected.map(id => originalHosts.find(host => host.id === id)));
  });

  it.each(['tcp-host', {}, null, undefined, [123], ['tcp-host', 'tcp-host']])('rejects an invalid or duplicate reorder list (%j)', async ids => {
    const response = await put({ type: 'reorderDockerHosts', ids });
    expect(response.status).toBe(400);
    expect(mockedWriteConfig).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown reorder id without writing', async () => {
    const response = await put({ type: 'reorderDockerHosts', ids: ['socket-host', 'missing'] });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
    expect(mockedWriteConfig).not.toHaveBeenCalled();
  });

  it('continues masking and filtering edited hosts for configuration readers', async () => {
    await put({ type: 'dockerHost', id: 'relay-host', connection: 'portainer', url: 'https://edited-relay.example.test', target: '2', token: '********' });
    const config = mockedWriteConfig.mock.lastCall![0];
    const principal = { username: 'reader', role: 'admin' as const, allowedTabs: [], allowedWidgets: [], isAnonymous: false };
    expect(buildConfigForPrincipal(config, principal).dockerHosts![1].token).toBe('********');
    expect(buildConfigForPrincipal(config, { ...principal, role: 'viewer' }).dockerHosts![1]).toEqual({ id: 'relay-host', name: 'Docker Host', icon: '🐳', type: 'portainer', url: '' });
    expect(config.dockerHosts![1].token).toBe('test-stored-token');
  });

  it.each(['dockerHost', 'reorderDockerHosts'])('keeps %s writes admin-only', async type => {
    mockedCheckAdmin.mockReturnValue(new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as never);
    const response = await put({ type });
    expect(response.status).toBe(403);
    expect(mockedReadConfig).not.toHaveBeenCalled();
    expect(mockedWriteConfig).not.toHaveBeenCalled();
  });

  it.each(['dockerHost', 'reorderDockerHosts'])('returns 500 if a %s write fails', async type => {
    mockedWriteConfig.mockReturnValue(false);
    const response = await put({ type, id: 'tcp-host', connection: 'tcp', url: 'http://engine.example.test:2375', ids: ['tcp-host'] });
    expect(response.status).toBe(500);
    expect(await response.json()).toHaveProperty('error');
  });
});
