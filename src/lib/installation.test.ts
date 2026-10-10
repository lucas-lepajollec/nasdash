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

  it('initializes the actual English examples and migrates their widgets without French resource names', async () => {
    const { readConfig } = await import('./config');
    const { readPagesDocument } = await import('./pages/store');
    const config = readConfig();
    const pages = readPagesDocument();
    expect(config.settings.uiLanguage).toBe('en');
    expect(config.devices?.map(device => device.name)).toEqual(['Main Server', 'Hypervisor']);
    expect(config.categories.flatMap(category => category.services.map(service => service.name)))
      .toEqual(['Example Service 1', 'Example Service 2']);
    expect(pages.pages.map(page => page.name)).toEqual(['Home', 'Docker', 'Networks', 'Widgets', 'Calendar']);
    expect(pages.pages.find(page => page.name === 'Calendar')?.widgets.map(widget => widget.type)).toEqual(['clock', 'calendar']);
    expect(read('topology').nodes.map((node: { name: string }) => node.name)).toEqual(['Router', 'Main Server', 'NAS', 'Immich']);
  });

  it('keeps customized names and layout files byte-for-byte when defaults are refreshed and the server restarts', async () => {
    (await import('./config')).readConfig();
    (await import('./pages/store')).readPagesDocument();
    const config = read('config');
    config.settings.title = 'Le labo de Camille';
    config.devices[0].name = 'Serveur personnalisé';
    write('config', config);
    const services = read('services');
    services[0].services[0].name = 'Mon application';
    write('services', services);
    const pages = read('pages');
    pages.pages[0].name = 'Mon tableau';
    write('pages', pages);
    const files = ['config', 'services', 'topology', 'calendar', 'custom_tabs', 'pages'];
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
