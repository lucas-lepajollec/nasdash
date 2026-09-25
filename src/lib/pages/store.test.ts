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
    expect(page.revision).toBe(4);
    expect(page.widgets.map(({ x, y, w, h }) => ({ x, y, w, h }))).toEqual([
      { x: 0, y: 0, w: 4, h: 42 },
      { x: 20, y: 0, w: 4, h: 60 },
      { x: 0, y: 42, w: 8, h: 80 },
    ]);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'pages.v2.json'), 'utf8'))).toEqual(legacy);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'pages.json'), 'utf8')).schemaVersion).toBe(5);
  });
});
