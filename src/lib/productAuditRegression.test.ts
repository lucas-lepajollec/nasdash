import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { version as productVersion } from '../../package.json';

const auth = vi.hoisted(() => ({
  session: null as { username: string; role: 'admin' | 'viewer' } | null,
  passwordAccepted: false,
}));

vi.mock('@/lib/auth', () => ({
  checkAdmin: vi.fn(() => null),
  getSessionFromRequest: vi.fn(() => auth.session),
  readUsers: vi.fn(() => [
    { username: 'admin', role: 'admin', passwordHash: 'synthetic', sessionVersion: 0 },
    { username: 'viewer', role: 'viewer', allowedTabs: [], allowedWidgets: [], sessionVersion: 0 },
  ]),
  verifyPassword: vi.fn(() => auth.passwordAccepted),
  generateToken: vi.fn(() => 'synthetic-session'),
  isSecureRequest: vi.fn(() => false),
}));

let directory: string;

function clearConfigCache() {
  const runtime = globalThis as unknown as Record<string, unknown>;
  for (const key of Object.keys(runtime)) {
    if (/^__cached(?:Config|Services|Topology|Calendar)/.test(key)) delete runtime[key];
  }
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-product-regression-'));
  vi.stubEnv('NASDASH_DATA_DIR', directory);
  vi.stubEnv('NASDASH_DEMO_MODE', 'false');
  vi.stubEnv('npm_package_version', '');
  vi.resetModules();
  clearConfigCache();
  auth.session = null;
  auth.passwordAccepted = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  clearConfigCache();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('product audit access and recovery regressions', () => {
  it('denies every mapped resource for explicit None while retaining legacy unrestricted lists', async () => {
    const { canReadResource, READ_ACCESS } = await import('./access');
    const viewer = {
      username: 'viewer', role: 'viewer' as const, isAnonymous: false,
      allowedTabs: ['__nasdash_none__'], allowedWidgets: ['__nasdash_none__'],
    };
    for (const requirement of Object.values(READ_ACCESS)) {
      expect(canReadResource(viewer, requirement)).toBe(false);
      expect(canReadResource({ ...viewer, allowedTabs: [], allowedWidgets: [] }, requirement)).toBe(true);
    }
  });

  it('does not export service addresses for a viewer with no page permissions, or allow a reserved ID as a page', async () => {
    const { canAccessTab } = await import('./access');
    const { buildConfigForPrincipal } = await import('./configAccess');
    const principal = { username: 'none', role: 'viewer' as const, isAnonymous: false, allowedTabs: ['__nasdash_none__'], allowedWidgets: ['__nasdash_none__'] };
    const config = { version: 1, settings: { title: 'Fictional', showMonitor: true }, categories: [{ id: 'fixture', title: 'Fixture', emoji: '', order: 0, services: [{ id: 'test-service', name: 'Test', logo: '', localUrl: 'http://service.example.test' }] }] };
    expect(canAccessTab(principal, '__nasdash_none__')).toBe(false);
    expect(buildConfigForPrincipal(config, principal).categories).toEqual([]);
    expect(JSON.stringify(buildConfigForPrincipal(config, principal))).not.toContain('service.example.test');
    expect(buildConfigForPrincipal(config, { ...principal, allowedTabs: [] }).categories).toHaveLength(1);
  });

  it('recovers damaged configuration privately and preserves the original bytes', async () => {
    const damaged = '{"settings":{"securityMode":"private"';
    fs.writeFileSync(path.join(directory, 'config.json'), damaged);
    fs.writeFileSync(path.join(directory, 'services.json'), '[]');
    // A public fresh-install example must not override the recovery boundary.
    fs.writeFileSync(path.join(directory, 'config.example.json'), JSON.stringify({
      version: 1, settings: { title: 'Example', showMonitor: true, securityMode: 'public' },
      categories: [], devices: [],
    }));
    const { readConfig } = await import('./config');
    expect(readConfig().settings.securityMode).toBe('private');
    const preserved = fs.readdirSync(directory).filter(name => name.startsWith('config.json.corrupt-'));
    expect(preserved).toHaveLength(1);
    expect(fs.readFileSync(path.join(directory, preserved[0]), 'utf8')).toBe(damaged);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'config.json'), 'utf8')).settings.securityMode).toBe('private');
  });

  it('keeps recovery private when config is missing but saved services remain', async () => {
    fs.writeFileSync(path.join(directory, 'services.json'), '[]');
    const { readConfig } = await import('./config');
    expect(readConfig().settings.securityMode).toBe('private');
  });

  it('serves authenticated private logos without cache reuse and denies the next unauthenticated request', async () => {
    const { readConfig, writeConfig, getLogosDir } = await import('./config');
    const config = readConfig();
    config.settings.securityMode = 'private';
    expect(writeConfig(config)).toBe(true);
    fs.writeFileSync(path.join(getLogosDir(), 'private.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const { GET } = await import('../app/api/logos/[filename]/route');
    auth.session = { username: 'admin', role: 'admin' };
    const params = { params: Promise.resolve({ filename: 'private.svg' }) };
    const authorized = await GET(new NextRequest('http://nasdash.invalid/api/logos/private.svg'), params);
    expect(authorized.status).toBe(200);
    expect(authorized.headers.get('Cache-Control')).toBe('private, no-store');
    expect(authorized.headers.get('Vary')?.split(/,\s*/)).toContain('Cookie');
    expect(authorized.headers.get('Content-Security-Policy')).toContain('sandbox');
    auth.session = null;
    const denied = await GET(new NextRequest('http://nasdash.invalid/api/logos/private.svg'), params);
    expect(denied.status).toBe(401);
    expect(await denied.text()).not.toContain('<svg');
    expect((await GET(new NextRequest('http://nasdash.invalid/api/logos/missing.svg'), {
      params: Promise.resolve({ filename: 'missing.svg' }),
    })).status).toBe(401);
  });
});

describe('product audit persistence regressions', () => {
  it.each([
    { start: 'not-a-date' },
    { start: '2026-02-31' },
    { start: '2026-10-13', end: 'not-a-date' },
    { start: '2026-10-13T12:00:00Z', end: '2026-10-13T11:00:00Z' },
  ])('rejects invalid calendar dates before writing any event: %j', async dates => {
    const { readConfig } = await import('./config');
    readConfig();
    fs.writeFileSync(path.join(directory, 'calendar.json'), '[]');
    const { POST } = await import('../app/api/config/route');
    const response = await POST(new NextRequest('http://nasdash.invalid/api/config', {
      method: 'POST', body: JSON.stringify({ type: 'localEvent', title: 'Synthetic', ...dates }),
    }));
    expect(response.status).toBe(400);
    expect(fs.readFileSync(path.join(directory, 'calendar.json'), 'utf8')).toBe('[]');
  });

  it('saves valid all-day events while rejecting a missing start date', async () => {
    const { POST } = await import('../app/api/config/route');
    const invalid = await POST(new NextRequest('http://nasdash.invalid/api/config', {
      method: 'POST', body: JSON.stringify({ type: 'localEvent', title: 'Missing date' }),
    }));
    expect(invalid.status).toBe(400);
    const valid = await POST(new NextRequest('http://nasdash.invalid/api/config', {
      method: 'POST', body: JSON.stringify({ type: 'localEvent', title: 'All day', start: '2026-10-13', isAllDay: true }),
    }));
    expect(valid.status).toBe(201);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'calendar.json'), 'utf8'))).toHaveLength(1);
  });

  it('uploads a long filename and round-trips its contents through a portable backup', async () => {
    const { POST } = await import('../app/api/upload/route');
    const image = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
    const form = new FormData();
    form.set('file', new File([image], `${'long-name'.repeat(28)}.svg`, { type: 'image/svg+xml' }));
    form.set('type', 'background');
    const response = await POST(new NextRequest('http://nasdash.invalid/api/upload', { method: 'POST', body: form }));
    expect(response.status).toBe(200);
    const { filename } = await response.json() as { filename: string };
    expect(Buffer.byteLength(filename)).toBeLessThanOrEqual(100);
    expect(fs.readFileSync(path.join(directory, 'logos', filename), 'utf8')).toBe(image);
    const { createBackup, backupPath } = await import('./backups');
    const archive = createBackup({ dataDirectory: directory });
    const restored = execFileSync('tar', ['-xOzf', backupPath(archive.name, directory)!, `data/logos/${filename}`], { encoding: 'utf8' });
    expect(restored).toBe(image);
  });

  it('records the product version in standalone backup metadata without npm runtime variables', async () => {
    fs.writeFileSync(path.join(directory, 'config.json'), '{"synthetic":true}');
    const { createBackup, backupPath } = await import('./backups');
    const archive = createBackup({ dataDirectory: directory });
    const manifest = JSON.parse(execFileSync('tar', ['-xOzf', backupPath(archive.name, directory)!, 'nasdash-backup.json'], { encoding: 'utf8' }));
    expect(manifest.appVersion).toBe(productVersion);
    expect(manifest.formatVersion).toBe(1);
  });

  it('stores normalized calendar dates instead of the unvalidated original whitespace', async () => {
    const { POST } = await import('../app/api/config/route');
    const response = await POST(new NextRequest('http://nasdash.invalid/api/config', {
      method: 'POST', body: JSON.stringify({ type: 'localEvent', title: 'Whitespace date', start: ' 2026-10-13T12:00:00Z ' }),
    }));
    expect(response.status).toBe(201);
    expect((await response.json()).start).toBe('2026-10-13T12:00:00Z');
  });

  it('does not overwrite distinct long-named uploads arriving during the same millisecond', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_792_000_000_000);
    const { POST } = await import('../app/api/upload/route');
    const filenames: string[] = [];
    const contents: string[] = [];
    for (const suffix of ['first', 'second']) {
      const image = `<svg xmlns="http://www.w3.org/2000/svg"><title>${suffix}</title></svg>`;
      const form = new FormData();
      form.set('file', new File([image], `${'shared-prefix-'.repeat(15)}${suffix}.svg`, { type: 'image/svg+xml' }));
      const response = await POST(new NextRequest('http://nasdash.invalid/api/upload', { method: 'POST', body: form }));
      expect(response.status).toBe(200);
      filenames.push((await response.json() as { filename: string }).filename);
      contents.push(image);
    }
    expect(filenames[0]).not.toBe(filenames[1]);
    for (let index = 0; index < filenames.length; index++) {
      expect(fs.readFileSync(path.join(directory, 'logos', filenames[index]), 'utf8')).toBe(contents[index]);
    }
  });

  it('leaves existing configuration unchanged when a related services write fails', async () => {
    const { readConfig, writeConfig } = await import('./config');
    const config = readConfig();
    const original = fs.readFileSync(path.join(directory, 'config.json'), 'utf8');
    if (fs.existsSync(path.join(directory, 'services.json'))) fs.unlinkSync(path.join(directory, 'services.json'));
    fs.mkdirSync(path.join(directory, 'services.json'));
    config.settings.title = 'Must not partially persist';
    expect(writeConfig(config)).toBe(false);
    expect(fs.readFileSync(path.join(directory, 'config.json'), 'utf8')).toBe(original);
    expect(fs.statSync(path.join(directory, 'services.json')).isDirectory()).toBe(true);
  });

  it('rejects an end-only calendar update before an existing start without changing the saved event', async () => {
    const { POST, PUT } = await import('../app/api/config/route');
    const created = await POST(new NextRequest('http://nasdash.invalid/api/config', {
      method: 'POST', body: JSON.stringify({
        type: 'localEvent', title: 'Keep this event', start: '2026-10-13T12:00:00Z', end: '2026-10-13T13:00:00Z',
      }),
    }));
    expect(created.status).toBe(201);
    const event = await created.json() as { id: string };
    const original = fs.readFileSync(path.join(directory, 'calendar.json'), 'utf8');
    const changed = await PUT(new NextRequest('http://nasdash.invalid/api/config', {
      method: 'PUT', body: JSON.stringify({ type: 'localEvent', id: event.id, end: '2026-10-13T11:00:00Z' }),
    }));
    expect(changed.status).toBe(400);
    expect(fs.readFileSync(path.join(directory, 'calendar.json'), 'utf8')).toBe(original);
  });
});

describe('product audit login regression', () => {
  it('does not let unknown identities exhaust the quota table for a registered account', async () => {
    const { POST } = await import('../app/api/auth/login/route');
    const attempt = (username: string) => POST(new NextRequest('http://nasdash.invalid/api/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password: 'synthetic-wrong-password' }),
    }));
    for (let index = 0; index < 1000; index++) expect((await attempt(`unknown-${index}`)).status).toBe(401);
    for (let index = 0; index < 10; index++) expect((await attempt('admin')).status).toBe(401);
    expect((await attempt('admin')).status).toBe(429);
  });
  it('limits an account despite rotating forwarding headers and casing, then allows retry after expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
    const { POST } = await import('../app/api/auth/login/route');
    const attempt = (index: number, username = 'admin') => POST(new NextRequest('http://nasdash.invalid/api/auth/login', {
      method: 'POST', headers: { 'x-forwarded-for': `192.0.2.${index + 1}` },
      body: JSON.stringify({ username, password: 'synthetic-wrong-password' }),
    }));
    for (let index = 0; index < 10; index++) expect((await attempt(index, index % 2 ? 'ADMIN' : 'admin')).status).toBe(401);
    const blocked = await attempt(10);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('60');
    auth.passwordAccepted = true;
    expect((await attempt(11, 'viewer')).status).toBe(200);
    expect((await attempt(12)).status).toBe(429);
    vi.setSystemTime(new Date('2026-10-13T12:01:01Z'));
    expect((await attempt(13)).status).toBe(200);
  });
});
