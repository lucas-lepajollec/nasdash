import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ checkAdmin: vi.fn(() => null) }));

const cacheKeys = [
  '__cachedConfig', '__cachedConfigMtime',
  '__cachedServices', '__cachedServicesMtime',
  '__cachedTopology', '__cachedTopologyMtime',
  '__cachedCalendar', '__cachedCalendarMtime',
];

function clearConfigCache() {
  const runtime = globalThis as unknown as Record<string, unknown>;
  cacheKeys.forEach(key => { delete runtime[key]; });
}

let directory: string | undefined;

afterEach(() => {
  clearConfigCache();
  vi.unstubAllEnvs();
  vi.resetModules();
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

describe('Docker host API token persistence', () => {
  it.each(['portainer', 'dockhand'] as const)('keeps a %s token encrypted and decryptable after editing and reordering', async connection => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-host-api-'));
    vi.stubEnv('NASDASH_DATA_DIR', directory);
    vi.stubEnv('NASDASH_DEMO_MODE', 'false');
    vi.stubEnv('NASDASH_JWT_SECRET', 'isolated-docker-host-api-test-key');
    clearConfigCache();
    vi.resetModules();

    const { readConfig } = await import('@/lib/config');
    const { POST, PUT } = await import('./route');
    const created = await POST(new NextRequest('http://localhost/api/config', {
      method: 'POST',
      body: JSON.stringify({ type: 'dockerHost', name: 'Relay', connection, url: 'https://relay.example.test', target: '1', token: 'test-persistent-token' }),
    }));
    expect(created.status).toBe(201);
    const host = await created.json();
    expect(host.token).toBe('********');

    // Force a disk read so the edit starts with a decrypted stored token.
    clearConfigCache();
    expect(readConfig().dockerHosts?.[0].token).toBe('test-persistent-token');
    const edited = await PUT(new NextRequest('http://localhost/api/config', {
      method: 'PUT',
      body: JSON.stringify({ type: 'dockerHost', id: host.id, name: 'Edited relay', connection, url: 'https://edited-relay.example.test', target: '2', token: '********' }),
    }));
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({ id: host.id, name: 'Edited relay', token: '********' });

    const reordered = await PUT(new NextRequest('http://localhost/api/config', {
      method: 'PUT',
      body: JSON.stringify({ type: 'reorderDockerHosts', ids: [host.id] }),
    }));
    expect(reordered.status).toBe(200);

    const disk = JSON.parse(fs.readFileSync(path.join(directory, 'config.json'), 'utf8'));
    expect(disk.dockerHosts[0].token).toMatch(/^enc:aes256:/);
    expect(disk.dockerHosts[0].token).not.toContain('test-persistent-token');
    clearConfigCache();
    expect(readConfig().dockerHosts?.[0]).toMatchObject({ id: host.id, name: 'Edited relay', target: '2', token: 'test-persistent-token' });
  });
});
