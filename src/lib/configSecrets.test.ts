import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

describe('secrets at rest', () => {
  it('encrypts Docker host tokens and connection secrets on disk, readable in memory', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-secrets-'));
    vi.stubEnv('NASDASH_DATA_DIR', dir);
    vi.resetModules();
    const { readConfig, writeConfig } = await import('./config');
    const config = readConfig();
    config.dockerHosts = [{ id: 'd', name: 'Dockhand', icon: '🐳', type: 'dockhand', url: 'http://dockhand.invalid', target: '1', token: 'dh_plain-token' }];
    config.integrations = [{ id: 'h', type: 'headscale', name: 'Headscale', settings: { url: 'https://hs.invalid' }, secrets: { apiKey: 'plain-key' } }];
    expect(writeConfig(config)).toBe(true);
    const disk = fs.readFileSync(path.join(dir, 'config.json'), 'utf8');
    expect(disk).not.toContain('dh_plain-token');
    expect(disk).not.toContain('plain-key');
    expect(disk).toContain('enc:aes256:');
    const again = readConfig();
    expect(again.dockerHosts?.[0].token).toBe('dh_plain-token');
    expect(again.integrations?.[0].secrets?.apiKey).toBe('plain-key');
    vi.unstubAllEnvs();
  });
});
