import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('supplied installation defaults', () => {
  let directory: string;
  const names = ['config', 'services', 'topology', 'calendar', 'custom_tabs'];
  const clearCache = () => {
    vi.resetModules();
    for (const key of ['__cachedConfig', '__cachedConfigMtime', '__cachedServices', '__cachedServicesMtime',
      '__cachedTopology', '__cachedTopologyMtime', '__cachedCalendar', '__cachedCalendarMtime',
      '__cachedCustomTabs', '__cachedCustomTabsMtime', '__nasdashPages', '__nasdashPagesMtime']) {
      delete (globalThis as Record<string, unknown>)[key];
    }
  };
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(directory, `${name}.json`), 'utf8'));
  const write = (name: string, data: unknown) => fs.writeFileSync(path.join(directory, `${name}.json`), JSON.stringify(data, null, 2));

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-installation-'));
    for (const name of names) {
      fs.copyFileSync(path.join(process.cwd(), 'data', `${name}.example.json`), path.join(directory, `${name}.example.json`));
    }
    vi.stubEnv('NASDASH_DATA_DIR', directory);
    vi.stubEnv('NASDASH_DEMO_MODE', 'false');
    clearCache();
  });
  afterEach(() => {
    clearCache();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('starts a new installation private, without sample data, on one empty Home page waiting for the guide', async () => {
    const { readConfig } = await import('./config');
    const { readPagesDocument } = await import('./pages/store');
    const config = readConfig();
    const pages = readPagesDocument();
    expect(config.settings).toMatchObject({ uiLanguage: 'en', securityMode: 'private', setupPending: true, backgroundImage: '/wallpapers/nasdash-aurora.jpg', emojiTheme: 'lucide' });
    expect(config.settings.surfaceBlur).toBeGreaterThan(0);
    expect(config.devices).toEqual([]);
    expect(config.dockerHosts).toEqual([]);
    expect(config.categories).toEqual([]);
    expect(pages.pages).toEqual([expect.objectContaining({ id: 'dashboard', name: 'Home' })]);
    expect(pages.pages[0].widgets.map(widget => widget.type)).toEqual(['clock', 'weather']);
    expect(read('topology').nodes).toEqual([]);
    expect(read('services')).toEqual([]);
  });

  it('never adds the new-installation defaults to an upgraded configuration that lacks them', async () => {
    // An installation from before 0.4: no guide flag, no blur, no privacy mode or icon set ever saved.
    const { settings } = JSON.parse(fs.readFileSync(path.join(directory, 'config.example.json'), 'utf8'));
    for (const key of ['setupPending', 'securityMode', 'surfaceBlur', 'emojiTheme', 'wallpaperDim', 'backgroundImage', 'title', 'tabOrder', 'tabIcons', 'cardOpacity']) delete settings[key];
    write('config', { version: 1, settings, categories: [], devices: [] });
    const config = (await import('./config')).readConfig();
    for (const key of ['setupPending', 'securityMode', 'surfaceBlur', 'emojiTheme', 'wallpaperDim', 'backgroundImage']) expect(config.settings, key).not.toHaveProperty(key);
    expect(read('config').settings).not.toHaveProperty('setupPending');
  });

  it('never restarts the guide on a configuration rebuilt for an existing installation', async () => {
    write('services', [{ id: 'kept', title: 'Kept', emoji: '', order: 0, layout: 'standard', isSecret: false, services: [] }]);
    const config = (await import('./config')).readConfig();
    expect(config.settings.securityMode).toBe('private');
    expect(config.settings.setupPending).toBeUndefined();
  });

  it('keeps customized names and layout files byte-for-byte when defaults are refreshed and the server restarts', async () => {
    (await import('./config')).readConfig();
    (await import('./pages/store')).readPagesDocument();
    const config = read('config');
    config.settings.title = 'Le labo de Camille';
    config.devices = [{ id: 'device-1', name: 'Serveur personnalisé', host: 'nas.example.com', icon: '🖥️' }];
    write('config', config);
    write('services', [{ id: 'category-1', title: 'Applications', emoji: '', order: 0, layout: 'standard', isSecret: false, services: [{ id: 'service-1', name: 'Mon application', localUrl: 'http://nas.example.com:8080' }] }]);
    const pages = read('pages');
    pages.pages[0].name = 'Mon tableau';
    write('pages', pages);
    const files = ['config', 'services', 'topology', 'calendar', 'pages'];
    const before = Object.fromEntries(files.map(name => [name, fs.readFileSync(path.join(directory, `${name}.json`), 'utf8')]));
    clearCache();
    const reloaded = (await import('./config')).readConfig();
    const document = (await import('./pages/store')).readPagesDocument();
    expect(reloaded.settings.title).toBe('Le labo de Camille');
    expect(reloaded.devices?.[0].name).toBe('Serveur personnalisé');
    expect(reloaded.categories[0].services[0].name).toBe('Mon application');
    expect(document.pages[0].name).toBe('Mon tableau');
    expect(Object.fromEntries(files.map(name => [name, fs.readFileSync(path.join(directory, `${name}.json`), 'utf8')]))).toEqual(before);
  });

  it('reports corrupted page recovery in English and preserves the damaged file', async () => {
    fs.writeFileSync(path.join(directory, 'pages.json'), '{ malformed');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await import('./pages/store')).readPagesDocument().pages.length).toBeGreaterThan(0);
    expect(error.mock.calls.some(call => String(call[0]).includes('Invalid pages.json preserved'))).toBe(true);
    expect(fs.readdirSync(directory).some(name => name.startsWith('pages.json.corrupt-'))).toBe(true);
  });
});
