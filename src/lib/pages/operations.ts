import { getWidgetCatalogEntry } from '../widgets/catalog';
import { GRID_COLUMNS, GRID_ROW_PX, type GridPlacement, type Page, type PagesDocument, type WidgetInstance, type WidgetSettings } from './types';

/**
 * Pure, immutable page edits shared by the editor, presets and migration.
 * Removing a widget view never deletes the category, host or device it shows.
 */

export function createLocalId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}-${random}`;
}

function overlaps(a: GridPlacement, b: GridPlacement): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** First free position, scanning rows top to bottom then columns left to right. */
export function firstFreePlacement(widgets: GridPlacement[], w: number, h: number): GridPlacement {
  const width = Math.max(1, Math.min(GRID_COLUMNS, w));
  const bottom = widgets.reduce((max, widget) => Math.max(max, widget.y + widget.h), 0);
  for (let y = 0; y <= bottom; y++) {
    for (let x = 0; x + width <= GRID_COLUMNS; x++) {
      const candidate = { x, y, w: width, h };
      if (!widgets.some(widget => overlaps(widget, candidate))) return candidate;
    }
  }
  return { x: 0, y: bottom, w: width, h };
}

/** Default height in rows, from the typical rendered height of the widget. */
export function defaultRows(type: string): number {
  const px = getWidgetCatalogEntry(type)?.grid.h ?? 200;
  return Math.max(2, Math.ceil((px + 16) / GRID_ROW_PX));
}

/** New widget with its default width, at the first free spot of the page. */
export function newWidgetInstance(type: string, settings: WidgetSettings = {}, page?: Pick<Page, 'widgets'>): WidgetInstance {
  const entry = getWidgetCatalogEntry(type);
  const merged = { ...(entry?.defaultSettings ?? {}), ...settings };
  const h = type === 'spacer' && typeof merged.height === 'number'
    ? Math.ceil((merged.height + 16) / GRID_ROW_PX)
    : defaultRows(type);
  const placement = firstFreePlacement(page?.widgets.filter(widget => !widget.hidden) ?? [], entry?.grid.w ?? 3, h);
  return { id: createLocalId('w'), type, settings: merged, ...placement };
}

export function insertWidget(page: Page, widget: WidgetInstance): Page {
  if (page.widgets.some(existing => existing.id === widget.id)) return page;
  return { ...page, widgets: [...page.widgets, widget] };
}

export function removeWidget(page: Page, widgetId: string): Page {
  if (!page.widgets.some(widget => widget.id === widgetId)) return page;
  return { ...page, widgets: page.widgets.filter(widget => widget.id !== widgetId) };
}

export function updateWidget(page: Page, widgetId: string, update: (widget: WidgetInstance) => WidgetInstance): Page {
  return { ...page, widgets: page.widgets.map(widget => widget.id === widgetId ? update(widget) : widget) };
}

export function setWidgetHidden(page: Page, widgetId: string, hidden: boolean): Page {
  return updateWidget(page, widgetId, widget => {
    const next = { ...widget };
    if (hidden) next.hidden = true;
    else delete next.hidden;
    return next;
  });
}

export function mergeWidgetSettings(page: Page, widgetId: string, settings: WidgetSettings): Page {
  return updateWidget(page, widgetId, widget => ({ ...widget, settings: { ...widget.settings, ...settings } }));
}

/**
 * Applies the positions reported by the grid after a gesture. Returns the same
 * page when nothing moved, so no empty undo step is recorded.
 */
export function applyPlacements(page: Page, placements: ({ id: string } & GridPlacement)[]): Page {
  const byId = new Map(placements.map(placement => [placement.id, placement]));
  let changed = false;
  const widgets = page.widgets.map(widget => {
    const next = byId.get(widget.id);
    if (!next) return widget;
    const x = Math.max(0, Math.min(GRID_COLUMNS - 1, Math.round(next.x)));
    const w = Math.max(1, Math.min(GRID_COLUMNS - x, Math.round(next.w)));
    const y = Math.max(0, Math.round(next.y));
    const h = Math.max(1, Math.round(next.h));
    if (x === widget.x && y === widget.y && w === widget.w && h === widget.h) return widget;
    changed = true;
    return { ...widget, x, y, w, h };
  });
  return changed ? { ...page, widgets } : page;
}

/**
 * Places widgets with their current heights while keeping the vertical gaps
 * of the stored layout: each widget keeps its distance to the lowest widget
 * above it (in the columns it spans). When a widget grows (a title shown in
 * edit mode, more data), the ones below move down; when it shrinks again, they
 * come back up. Applying the stored heights to the result gives the stored
 * layout back, so switching modes leaves no gap behind.
 */
export function reflowHeights<T extends GridPlacement & { id: string }>(widgets: T[], heights: Record<string, number>): T[] {
  const order = widgets.map((widget, index) => ({ widget, index })).sort((a, b) => a.widget.y - b.widget.y || a.widget.x - b.widget.x);
  const done: { stored: T; next: T }[] = [];
  const result = [...widgets];
  for (const { widget, index } of order) {
    const h = Math.max(1, Math.round(heights[widget.id] ?? widget.h));
    const above = done.filter(({ stored }) => stored.y < widget.y && stored.x < widget.x + widget.w && widget.x < stored.x + stored.w);
    let y = widget.y;
    if (above.length) {
      const storedBottom = Math.max(...above.map(({ stored }) => stored.y + stored.h));
      const nextBottom = Math.max(...above.map(({ next }) => next.y + next.h));
      y = nextBottom + Math.max(0, widget.y - storedBottom);
    }
    const next = y === widget.y && h === widget.h ? widget : { ...widget, y, h };
    done.push({ stored: widget, next });
    result[index] = next;
  }
  return result;
}

export type PlacementProblem = 'max-instances';

/** Single-instance widgets (the editable topology) are counted across pages. */
export function placementProblem(document: Pick<PagesDocument, 'pages'> | null, page: Page, widgetType: string): PlacementProblem | null {
  const max = getWidgetCatalogEntry(widgetType)?.maxInstances;
  if (max === undefined) return null;
  const pages = document ? document.pages.map(candidate => candidate.id === page.id ? page : candidate) : [page];
  if (!pages.some(candidate => candidate.id === page.id)) pages.push(page);
  const count = pages.reduce((total, candidate) => total + candidate.widgets.filter(widget => widget.type === widgetType).length, 0);
  return count >= max ? 'max-instances' : null;
}

/**
 * Moves widgets down until none overlaps another, keeping the reading order.
 * Used when older documents are converted to the current grid.
 */
export function resolveOverlaps<T extends GridPlacement>(widgets: T[]): T[] {
  const placed: T[] = [];
  const order = widgets.map((widget, index) => ({ widget, index })).sort((a, b) => a.widget.y - b.widget.y || a.widget.x - b.widget.x);
  const result = [...widgets];
  for (const { widget, index } of order) {
    let next = widget;
    let blocker = placed.find(other => overlaps(other, next));
    while (blocker) {
      next = { ...next, y: blocker.y + blocker.h };
      blocker = placed.find(other => overlaps(other, next));
    }
    placed.push(next);
    result[index] = next;
  }
  return result;
}

/** Widgets in reading order (top to bottom, then left to right). */
export function widgetsInReadingOrder(page: Pick<Page, 'widgets'>): WidgetInstance[] {
  return [...page.widgets].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** A band is at least half the page wide… */
const BAND_MIN_WIDTH = 12;
/** …and nothing sits beside it (no other widget shares its rows). */
function isBand<T extends GridPlacement & { id: string }>(widget: T, widgets: T[]): boolean {
  if (widget.w < BAND_MIN_WIDTH) return false;
  return !widgets.some(other => other.id !== widget.id && other.y < widget.y + widget.h && widget.y < other.y + other.h);
}

/** Column by column: the columns of a band side by side, each read top to bottom. */
function columnMajor<T extends GridPlacement & { id: string }>(items: T[]): T[] {
  const columns: { left: number; right: number; items: T[] }[] = [];
  for (const item of [...items].sort((a, b) => a.x - b.x || a.y - b.y)) {
    const right = item.x + item.w;
    const column = columns.find(candidate => Math.min(right, candidate.right) - Math.max(item.x, candidate.left) >= Math.min(item.w, candidate.right - candidate.left) / 2);
    if (column) {
      column.items.push(item);
      column.left = Math.min(column.left, item.x);
      column.right = Math.max(column.right, right);
    } else columns.push({ left: item.x, right, items: [item] });
  }
  return columns.sort((a, b) => a.left - b.left).flatMap(column => column.items.sort((a, b) => a.y - b.y));
}

/**
 * The automatic phone order: the page read column by column, as it is built
 * on desktop. A wide widget with nothing beside it (a band) ends the columns
 * above it; the columns below start again after it.
 */
export function autoMobileOrder<T extends GridPlacement & { id: string }>(widgets: T[]): T[] {
  const byY = [...widgets].sort((a, b) => a.y - b.y || a.x - b.x);
  const bands = byY.filter(widget => isBand(widget, widgets));
  const result: T[] = [];
  let pending = byY.filter(widget => !bands.includes(widget));
  for (const band of bands) {
    const above = pending.filter(widget => widget.y < band.y);
    pending = pending.filter(widget => widget.y >= band.y);
    result.push(...columnMajor(above), band);
  }
  return [...result, ...columnMajor(pending)];
}

/** The widgets of a page in their phone and tablet order: the chosen one, then the automatic one. */
export function mobileOrder<T extends WidgetInstance>(page: Pick<Page, 'mobile'> & { widgets: T[] }): T[] {
  const byId = new Map(page.widgets.map(widget => [widget.id, widget]));
  const chosen = [...new Set(page.mobile?.order ?? [])].map(id => byId.get(id)).filter((widget): widget is T => !!widget);
  const placed = new Set(chosen.map(widget => widget.id));
  return [...chosen, ...autoMobileOrder(page.widgets).filter(widget => !placed.has(widget.id))];
}

export function isHiddenOnMobile(page: Pick<Page, 'mobile'>, widgetId: string): boolean {
  return !!page.mobile?.hidden?.includes(widgetId);
}

/** Moves a widget to `index` in the phone order (the whole order is written from then on). */
export function moveOnMobile(page: Page, widgetId: string, index: number): Page {
  const order = mobileOrder(page).map(widget => widget.id).filter(id => id !== widgetId);
  if (!page.widgets.some(widget => widget.id === widgetId)) return page;
  order.splice(Math.max(0, Math.min(order.length, index)), 0, widgetId);
  return { ...page, mobile: { ...page.mobile, order } };
}

export function setHiddenOnMobile(page: Page, widgetId: string, hidden: boolean): Page {
  const current = new Set(page.mobile?.hidden ?? []);
  if (hidden) current.add(widgetId);
  else current.delete(widgetId);
  return { ...page, mobile: { ...page.mobile, hidden: [...current] } };
}

/** Back to the automatic order, everything shown. */
export function resetMobileLayout(page: Page): Page {
  const next = { ...page };
  delete next.mobile;
  return next;
}

/**
 * Widths a widget can be resized to, in columns: the formats of its type that
 * are at least its smallest usable width at the current column width (in
 * pixels, gutter included). The smallest format is kept when none fits.
 */
export function widthFormats(type: string, columnPx: number, gutterPx = 16): number[] {
  const grid = getWidgetCatalogEntry(type)?.grid;
  const sizes = grid?.sizes?.length ? [...grid.sizes] : [GRID_COLUMNS];
  if (!columnPx || !grid) return sizes;
  const usable = sizes.filter(size => size * columnPx - gutterPx >= grid.minPx);
  return usable.length ? usable : [sizes[sizes.length - 1]];
}

/** Format closest to the requested width (in columns); ties go to the smaller one. */
export function snapWidth(formats: readonly number[], requested: number): number {
  return formats.reduce((best, size) => Math.abs(size - requested) < Math.abs(best - requested) ? size : best, formats[0]);
}

/**
 * Moves widgets down until none overlaps another, placing `firstId` first so
 * the widget being resized keeps its place and pushes its neighbours.
 */
/**
 * Where a dropped widget lands when its top edge falls inside a widget above
 * it: in that widget's lower half, the drop means "under it", so the dropped
 * widget settles just below (instead of pushing the upper one down); in its
 * upper half, it takes that widget's place (see `pushOverlaps`).
 */
export function settleBelow<T extends GridPlacement & { id: string }>(widgets: T[], movedId: string): T[] {
  const index = widgets.findIndex(widget => widget.id === movedId);
  if (index < 0) return widgets;
  let moved = widgets[index];
  for (let guard = 0; guard < widgets.length; guard++) {
    const above = widgets.find(other => other.id !== movedId && overlaps(other, moved) && other.y < moved.y && moved.y >= other.y + other.h / 2);
    if (!above) break;
    moved = { ...moved, y: above.y + above.h };
  }
  const result = [...widgets];
  result[index] = moved;
  return result;
}

export function pushOverlaps<T extends GridPlacement & { id: string }>(widgets: T[], firstId: string): T[] {
  const placed: T[] = [];
  const order = widgets.map((widget, index) => ({ widget, index }))
    .sort((a, b) => Number(b.widget.id === firstId) - Number(a.widget.id === firstId) || a.widget.y - b.widget.y || a.widget.x - b.widget.x);
  const result = [...widgets];
  for (const { widget, index } of order) {
    let next = widget;
    let blocker = placed.find(other => overlaps(other, next));
    while (blocker) {
      next = { ...next, y: blocker.y + blocker.h };
      blocker = placed.find(other => overlaps(other, next));
    }
    placed.push(next);
    result[index] = next;
  }
  return result;
}
