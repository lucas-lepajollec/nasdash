import fs from 'fs';
import path from 'path';
import { readConfig, safeWriteFileSync } from '../config';
import { preserveCorruptFile } from '../corruptFileRecovery';
import { readCustomTabs } from '../customTabs';
import { getDataDirectory } from '../dataDirectory';
import { isDemoMode } from '../demoMode';
import { getDemoSessionPages, setDemoSessionPages } from '../demoSession';
import { canViewWidget, type WidgetViewer } from '../widgets/catalog';
import { migrateLegacyPages, sectionedPageToGrid, type SectionedPage } from './legacy-migration';
import { resolveOverlaps } from './operations';
import { PAGES_SCHEMA_VERSION, type Page, type PagesDocument } from './types';
import { validatePagesDocument } from './validation';

/**
 * Persistence of the universal pages in `pages.json`.
 *
 * The file is created from the historical configuration the first time it is
 * needed. Historical files are left untouched, so downgrading NasDash simply
 * ignores `pages.json`. Before a destructive action (deleting a page,
 * restoring a preset) the previous document is kept in `pages.previous.json`.
 */

const globalCache = globalThis as typeof globalThis & {
  __nasdashPages?: PagesDocument | null;
  __nasdashPagesMtime?: number;
};

function pagesPath(): string {
  return path.join(getDataDirectory(), 'pages.json');
}

function backupPath(): string {
  return path.join(getDataDirectory(), 'pages.previous.json');
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildFromLegacy(): PagesDocument {
  const config = readConfig();
  const customTabs = readCustomTabs();
  return migrateLegacyPages({ config, categories: config.categories || [], customTabs });
}

/**
 * Older documents are placed on the current grid once; the original file is
 * kept next to it (`pages.v1.json` … `pages.v4.json`).
 * - v1 arranged widgets in sections and columns;
 * - v2 used 12 columns (now 24): horizontal values double;
 * - v2/v3 used 8 px rows and v4 16 px rows (now 4 px): vertical values scale.
 * Spacers from v2/v3 are dropped: the free grid keeps empty space by itself.
 */
const ROW_SCALE: Record<number, number> = { 2: 2, 3: 2, 4: 4 };

function upgradeDocument(raw: unknown): { document: PagesDocument; from: number | null } {
  const candidate = raw as { schemaVersion?: number; pages?: unknown[]; migration?: PagesDocument['migration'] } | null;
  const version = candidate?.schemaVersion;
  if (version === 1 && Array.isArray(candidate?.pages)) {
    const config = readConfig();
    const context = { categories: config.categories || [], deviceCount: config.devices?.length ?? 1 };
    const document = validatePagesDocument({
      schemaVersion: PAGES_SCHEMA_VERSION,
      pages: (candidate.pages as SectionedPage[]).map(page => sectionedPageToGrid(page, context)),
      migration: { from: 'sections', at: new Date().toISOString(), notes: [] },
    });
    return { document, from: 1 };
  }
  if (version !== undefined && ROW_SCALE[version] && Array.isArray(candidate?.pages)) {
    const horizontal = version === 2 ? 2 : 1;
    const rows = ROW_SCALE[version];
    const pages = (candidate.pages as Page[]).map(page => (Array.isArray(page.widgets) ? {
      ...page,
      widgets: resolveOverlaps(page.widgets.filter(widget => version === 4 || widget.type !== 'spacer').map(widget => ({
        ...widget,
        x: widget.x * horizontal,
        w: widget.w * horizontal,
        y: widget.y * rows,
        h: Math.max(1, widget.h * rows),
      }))),
    } : page));
    const document = validatePagesDocument({ ...candidate, schemaVersion: PAGES_SCHEMA_VERSION, pages });
    return { document, from: version };
  }
  return { document: validatePagesDocument(raw), from: null };
}

function readFromDisk(): PagesDocument {
  const filePath = pagesPath();
  let mtime: number | undefined;
  try {
    mtime = fs.statSync(filePath).mtimeMs;
  } catch {
    mtime = undefined;
  }
  // The version check drops a cache left by an older module after a hot reload.
  const cached = globalCache.__nasdashPages;
  if (mtime !== undefined && cached?.schemaVersion === PAGES_SCHEMA_VERSION && globalCache.__nasdashPagesMtime === mtime) {
    return clone(cached);
  }

  if (mtime !== undefined) {
    try {
      const text = fs.readFileSync(filePath, 'utf-8');
      const { document, from } = upgradeDocument(JSON.parse(text));
      if (from !== null) {
        safeWriteFileSync(path.join(getDataDirectory(), `pages.v${from}.json`), text, 'utf-8');
        writeToDisk(document);
        console.info(`[NASDASH] Pages placées sur la grille libre ; ancienne version conservée dans pages.v${from}.json.`);
        return clone(document);
      }
      globalCache.__nasdashPages = clone(document);
      globalCache.__nasdashPagesMtime = mtime;
      return document;
    } catch (error) {
      // Never replace an unreadable file without keeping a copy of it.
      const recovery = preserveCorruptFile(filePath);
      console.error(`[NASDASH] pages.json invalide conservé dans ${recovery} ; pages reconstruites depuis la configuration.`, error);
    }
  }

  const migrated = buildFromLegacy();
  if (migrated.migration?.notes.length) {
    console.info(`[NASDASH] Pages créées depuis la configuration existante :\n- ${migrated.migration.notes.join('\n- ')}`);
  }
  writeToDisk(migrated);
  return migrated;
}

function writeToDisk(document: PagesDocument): void {
  const filePath = pagesPath();
  safeWriteFileSync(filePath, JSON.stringify(document, null, 2), 'utf-8');
  globalCache.__nasdashPages = clone(document);
  try {
    globalCache.__nasdashPagesMtime = fs.statSync(filePath).mtimeMs;
  } catch {
    globalCache.__nasdashPagesMtime = undefined;
  }
}

export function readPagesDocument(): PagesDocument {
  if (isDemoMode()) {
    const session = getDemoSessionPages<PagesDocument>();
    if (session?.schemaVersion === PAGES_SCHEMA_VERSION) return session;
    // The demo never writes to its fixture directory.
    const filePath = pagesPath();
    const document = fs.existsSync(filePath)
      ? upgradeDocument(JSON.parse(fs.readFileSync(filePath, 'utf-8'))).document
      : buildFromLegacy();
    setDemoSessionPages(document);
    return clone(document);
  }
  return readFromDisk();
}

export function writePagesDocument(document: PagesDocument, options: { backup?: boolean } = {}): void {
  const validated = validatePagesDocument(document);
  if (isDemoMode()) {
    setDemoSessionPages(validated);
    return;
  }
  if (options.backup) {
    const current = pagesPath();
    if (fs.existsSync(current)) safeWriteFileSync(backupPath(), fs.readFileSync(current));
  }
  writeToDisk(validated);
}

// ---- Access filtering -------------------------------------------------------

export interface PageViewer extends WidgetViewer {
  allowedTabs: string[];
  allowedWidgets: string[];
}

function canViewPage(viewer: PageViewer, pageId: string): boolean {
  return viewer.role === 'admin' || viewer.allowedTabs.length === 0 || viewer.allowedTabs.includes(pageId);
}

/** Removes what a non-admin user may not see: whole pages, then widget views. */
export function pagesForViewer(document: PagesDocument, viewer: PageViewer): Page[] {
  if (viewer.role === 'admin') return document.pages;
  return document.pages
    .filter(page => canViewPage(viewer, page.id))
    .map(page => ({
      ...page,
      widgets: page.widgets.filter(widget => !widget.hidden && canViewWidget(viewer, widget.type)),
    }));
}
