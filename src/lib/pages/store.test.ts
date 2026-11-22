import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Exercises the real persistence on a temporary data directory: first-run
 * migration, untouched historical files, backups and corrupt-file recovery.
 */
describe('pages store', () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-pages-'));
    const fixtures = path.join(process.cwd(), 'demo', 'fixtures');
    for (const name of ['config.json', 'services.json', 'custom_tabs.json']) {
      fs.copyFileSync(path.join(fixtures, name), path.join(directory, name));
    }
    vi.resetModules();
    vi.stubEnv('NASDASH_DEMO_MODE', 'false');
    vi.stubEnv('NASDASH_DATA_DIR', directory);
    delete (globalThis as Record<string, unknown>).__nasdashPages;
    delete (globalThis as Record<string, unknown>).__nasdashPagesMtime;
    delete (globalThis as Record<string, unknown>).__cachedConfig;
    delete (globalThis as Record<string, unknown>).__cachedServices;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const snapshot = () => Object.fromEntries(['config.json', 'services.json', 'custom_tabs.json']
    .map(name => [name, fs.readFileSync(path.join(directory, name), 'utf8')]));

  it('creates pages.json from the historical files without modifying them', async () => {
    const before = snapshot();
    const { readPagesDocument } = await import('./store');
    const document = readPagesDocument();
    expect(document.pages.map(page => page.id)).toContain('dashboard');
    expect(fs.existsSync(path.join(directory, 'pages.json'))).toBe(true);
    expect(snapshot()).toEqual(before);
  });

  it('keeps a backup before destructive writes', async () => {
    const { readPagesDocument, writePagesDocument } = await import('./store');
    const document = readPagesDocument();
    writePagesDocument({ ...document, pages: document.pages.slice(1) }, { backup: true });
    const backup = JSON.parse(fs.readFileSync(path.join(directory, 'pages.previous.json'), 'utf8'));
    expect(backup.pages).toHaveLength(document.pages.length);
    expect(readPagesDocument().pages).toHaveLength(document.pages.length - 1);
  });

  it('preserves an unreadable pages.json before rebuilding it', async () => {
    fs.writeFileSync(path.join(directory, 'pages.json'), '{ not json');
    const { readPagesDocument } = await import('./store');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(readPagesDocument().pages.length).toBeGreaterThan(0);
    const preserved = fs.readdirSync(directory).filter(name => name.startsWith('pages.json.corrupt-'));
    expect(preserved).toHaveLength(1);
  });

  it('converts 12-column, 8 px-row documents and keeps the original', async () => {
    const legacy = {
      schemaVersion: 2,
      pages: [{ id: 'dashboard', name: 'Home', icon: '🏠', revision: 4, widgets: [
        { id: 'a', type: 'clock', settings: {}, x: 0, y: 0, w: 2, h: 21 },
        { id: 'b', type: 'weather', settings: {}, x: 10, y: 0, w: 2, h: 30 },
        { id: 'c', type: 'calendar', settings: {}, x: 0, y: 21, w: 4, h: 40 },
      ] }],
    };
    fs.writeFileSync(path.join(directory, 'pages.json'), JSON.stringify(legacy));
    const { readPagesDocument } = await import('./store');
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const [page] = readPagesDocument().pages;
    // A new revision: the header widgets were added at the top, the rest moved down by the header's height.
    expect(page.revision).toBe(5);
    expect(page.widgets.filter(widget => !widget.type.startsWith('page-')).map(({ x, y, w, h }) => ({ x, y, w, h }))).toEqual([
      { x: 0, y: 14, w: 4, h: 42 },
      { x: 20, y: 14, w: 4, h: 60 },
      { x: 0, y: 56, w: 8, h: 80 },
    ]);
    expect(page.widgets.filter(widget => widget.type.startsWith('page-')).map(widget => widget.type)).toEqual(['page-search', 'page-menu', 'page-actions']);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'pages.v2.json'), 'utf8'))).toEqual(legacy);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'pages.json'), 'utf8')).schemaVersion).toBe(6);
  });
  it('turns the header settings into header widgets once, the rest of each page moved down, and keeps v5', async () => {
    const config = JSON.parse(fs.readFileSync(path.join(directory, 'config.json'), 'utf8'));
    config.settings = { ...config.settings, headerLayoutDesktop: { left: 'menu', center: 'search', right: 'none', splitMenuAround: 'none' }, showHeaderMenuIcons: true };
    fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify(config));
    const v5 = {
      schemaVersion: 5,
      pages: [{ id: 'dashboard', name: 'Home', icon: '🏠', revision: 9, widgets: [
        { id: 'a', type: 'clock', settings: {}, x: 0, y: 0, w: 6, h: 40 },
        { id: 'b', type: 'weather', settings: {}, x: 6, y: 10, w: 6, h: 50 },
      ] }],
    };
    fs.writeFileSync(path.join(directory, 'pages.json'), JSON.stringify(v5));
    const { readPagesDocument } = await import('./store');
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const [page] = readPagesDocument().pages;
    expect(page.revision).toBe(10);
    expect(page.widgets.map(({ id, type, x, y, w, h, settings }) => ({ id, type, x, y, w, h, settings }))).toEqual([
      { id: 'page-menu-dashboard', type: 'page-menu', x: 0, y: 0, w: 9, h: 13, settings: { align: 'start', icons: true } },
      { id: 'page-search-dashboard', type: 'page-search', x: 9, y: 0, w: 6, h: 13, settings: {} },
      { id: 'page-actions-dashboard', type: 'page-actions', x: 18, y: 0, w: 6, h: 13, settings: { align: 'end' } },
      { id: 'a', type: 'clock', x: 0, y: 14, w: 6, h: 40, settings: {} },
      { id: 'b', type: 'weather', x: 6, y: 24, w: 6, h: 50, settings: {} },
    ]);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'pages.v5.json'), 'utf8'))).toEqual(v5);
    // Read again: nothing changes a second time.
    delete (globalThis as Record<string, unknown>).__nasdashPages;
    expect(readPagesDocument().pages[0].widgets).toHaveLength(5);
  });

  it('gives back the menu and the buttons to a page that lost them', async () => {
    const v6 = {
      schemaVersion: 6,
      pages: [{ id: 'dashboard', name: 'Home', icon: '🏠', revision: 3, widgets: [
        { id: 'menu', type: 'page-menu', settings: {}, x: 6, y: 0, w: 12, h: 13 },
        { id: 'a', type: 'clock', settings: {}, x: 0, y: 14, w: 6, h: 40 },
      ] }],
    };
    fs.writeFileSync(path.join(directory, 'pages.json'), JSON.stringify(v6));
    const { readPagesDocument } = await import('./store');
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const [page] = readPagesDocument().pages;
    expect(page.widgets.filter(widget => widget.type === 'page-actions')).toHaveLength(1);
    expect(page.widgets.find(widget => widget.id === 'a')?.y).toBe(28);
  });
});
