import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

describe('first-start authentication', () => {
  let directory: string;
  const clear = () => {
    vi.resetModules();
    for (const key of ['__cachedUsers', '__warnedAboutDefaultPasswords', '__jwtSecret', '__jwtSecretFallback']) {
      delete (globalThis as Record<string, unknown>)[key];
    }
  };
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-auth-bootstrap-'));
    vi.stubEnv('NASDASH_DATA_DIR', directory);
    vi.stubEnv('NASDASH_DEMO_MODE', 'false');
    vi.stubEnv('NASDASH_ADMIN_PASSWORD', '');
    vi.stubEnv('NASDASH_VIEWER_PASSWORD', '');
    vi.stubEnv('NASDASH_JWT_SECRET', 'synthetic-bootstrap-test-secret');
    clear();
  });
  afterEach(() => {
    clear(); vi.restoreAllMocks(); vi.unstubAllEnvs();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  it('persists the administrator only, then announces its setup code, without any login request', async () => {
    const auth = await import('./auth');
    const announced: Array<{ username: string; password: string }> = [];
    vi.spyOn(console, 'warn').mockImplementation((message: string) => {
      const match = message.match(/Setup code: (.+)/);
      if (!match) return;
      const users = JSON.parse(fs.readFileSync(path.join(directory, 'users.json'), 'utf8'));
      expect(auth.verifyPassword(match[1], users.find((u: { username: string }) => u.username === 'admin').passwordHash)).toBe(true);
      announced.push({ username: 'admin', password: match[1] });
    });
    auth.initializeAuthentication();
    // No viewer account until public mode is chosen; the code is three groups of four unambiguous characters.
    expect(announced.map(a => a.username)).toEqual(['admin']);
    expect(announced[0].password).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'users.json'), 'utf8')).map((user: { username: string }) => user.username)).toEqual(['admin']);
    expect(fs.statSync(path.join(directory, 'users.json')).mode & 0o777).toBe(0o600);
    const saved = fs.readFileSync(path.join(directory, 'users.json'), 'utf8');
    clear();
    (await import('./auth')).initializeAuthentication();
    expect(announced).toHaveLength(1);
    expect(fs.readFileSync(path.join(directory, 'users.json'), 'utf8')).toBe(saved);
  });
  it('does not announce an unusable password if persistence fails', async () => {
    const auth = await import('./auth');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw Object.assign(new Error('test-only denied'), { code: 'EACCES' }); });
    expect(() => auth.initializeAuthentication()).toThrow('test-only denied');
    expect(warn.mock.calls.some(call => /Setup code|Initial password generated/.test(String(call[0])))).toBe(false);
    expect(fs.existsSync(path.join(directory, 'users.json'))).toBe(false);
  });
  it('fails startup on malformed accounts without replacing the file', async () => {
    fs.writeFileSync(path.join(directory, 'users.json'), '{ malformed');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(import('./auth').then(auth => auth.initializeAuthentication())).rejects.toThrow();
    expect(fs.readFileSync(path.join(directory, 'users.json'), 'utf8')).toBe('{ malformed');
  });
  it('creates the viewer account when public mode needs it, once', async () => {
    const auth = await import('./auth');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    auth.initializeAuthentication();
    expect(auth.ensureViewerAccount()).toBe(true);
    expect(auth.ensureViewerAccount()).toBe(true);
    const users = JSON.parse(fs.readFileSync(path.join(directory, 'users.json'), 'utf8')) as { username: string; role: string }[];
    expect(users.filter(user => user.username === 'viewer')).toEqual([expect.objectContaining({ role: 'viewer' })]);
  });
  it('skips account initialization in the public demo', async () => {
    vi.stubEnv('NASDASH_DEMO_MODE', 'true');
    (await import('./auth')).initializeAuthentication();
    expect(fs.readdirSync(directory)).toEqual([]);
  });
});
