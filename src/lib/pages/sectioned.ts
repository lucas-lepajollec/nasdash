import type { Category } from '../types';
import { getWidgetCatalogEntry } from '../widgets/catalog';
import { GRID_COLUMNS, GRID_ROW_PX, type WidgetInstance, type WidgetSettings } from './types';

/**
 * The first page format arranged widgets in sections and columns. It is still
 * produced by the legacy migration (it mirrors the historical pages) and may
 * exist in `pages.json` files written before the free grid. This module turns
 * that arrangement into grid placements.
 */

export type SectionedColumnWidth = 'sidebar' | 'panel' | 'fill' | number;

export interface SectionedColumn {
  id: string;
  width: SectionedColumnWidth;
  arrangement: 'stack' | 'masonry';
  maxColumns?: number;
  sticky?: boolean;
  mobileOrder?: number;
  items: (string | null)[];
}

export interface SectionedSection {
  id: string;
  title?: string;
  columns: SectionedColumn[];
}

export interface SectionedWidget {
  id: string;
  type: string;
  hidden?: boolean;
  span?: number;
  settings: WidgetSettings;
}

export interface SizingContext {
  categories: Category[];
  deviceCount: number;
}

/** Widget height in rows, from the typical rendered height of its content. */
export function estimateRows(widget: Pick<SectionedWidget, 'type' | 'settings'>, context: SizingContext): number {
  const px = (() => {
    switch (widget.type) {
      case 'service-category': {
        const category = context.categories.find(candidate => candidate.id === widget.settings.categoryId);
        const count = category?.services.length ?? 3;
        const layout = category?.layout ?? 'standard';
        if (layout === 'standard' || layout === 'compact') return 70 + count * 49;
        return 70 + Math.ceil(count / 3) * 92;
      }
      case 'devices': return 60 + Math.max(1, context.deviceCount) * 250;
      case 'spacer': return typeof widget.settings.height === 'number' ? widget.settings.height : 120;
      default: return getWidgetCatalogEntry(widget.type)?.grid.h ?? 200;
    }
  })();
  return Math.max(2, Math.ceil((px + 16) / GRID_ROW_PX));
}

/** Column widths on the grid (sidebars match the historical 230 px on a 1920 px screen). */
export function columnSpans(columns: SectionedColumn[]): number[] {
  const fixed: number[] = columns.map(column => column.width === 'sidebar' ? 3 : column.width === 'panel' ? 5 : 0);
  const flexible = columns.map((_, index) => index).filter(index => !fixed[index]);
  if (!flexible.length) {
    // Only fixed columns: the last one takes what is left.
    const spans = [...fixed];
    spans[spans.length - 1] += Math.max(0, GRID_COLUMNS - fixed.reduce((sum, value) => sum + value, 0));
    return spans;
  }
  const available = Math.max(flexible.length, GRID_COLUMNS - fixed.reduce((sum, value) => sum + value, 0));
  const percentTotal = columns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 0);
  const fills = columns.filter(column => column.width === 'fill').length;
  const fillWeight = fills ? Math.max(10, 100 - Math.min(percentTotal, 90)) / fills : 0;
  const weights = flexible.map(index => {
    const width = columns[index].width;
    return typeof width === 'number' ? width : fillWeight;
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  const raw = weights.map(weight => (weight / total) * available);
  const spans = raw.map(value => Math.max(1, Math.floor(value)));
  // Largest remainders receive the columns left after flooring.
  let left = available - spans.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; left > 0; i = (i + 1) % order.length, left--) spans[order[i].index] += 1;
  const result = [...fixed];
  flexible.forEach((index, position) => { result[index] = spans[position]; });
  return result;
}

/** Tracks of a masonry column, like the historical Home grid at desktop width. */
function masonryTracks(span: number, maxColumns = 6): number {
  // Tracks as the historical masonry had them on a 1920 px screen (≈1856 px of grid).
  const px = (span / GRID_COLUMNS) * 1856;
  const auto = px <= 550 ? 1 : px <= 800 ? 2 : px <= 1100 ? 3 : px <= 1420 ? 4 : 5;
  return Math.max(1, Math.min(auto, maxColumns, span));
}

/**
 * Places the widgets of sections top to bottom; inside a section, columns keep
 * their horizontal order and proportions, and grid columns keep their
 * round-robin distribution. Heights are estimates of the content.
 */
export function sectionsToGrid(sections: SectionedSection[], widgets: SectionedWidget[], context: SizingContext): WidgetInstance[] {
  const byId = new Map(widgets.map(widget => [widget.id, widget]));
  const placed: WidgetInstance[] = [];
  let top = 0;

  for (const section of sections) {
    const spans = columnSpans(section.columns);
    let x = 0;
    let bottom = top;
    section.columns.forEach((column, columnIndex) => {
      const span = spans[columnIndex];
      const tracks = column.arrangement === 'masonry' ? masonryTracks(span, column.maxColumns) : 1;
      const trackWidths = Array.from({ length: tracks }, (_, track) => Math.floor(span / tracks) + (track < span % tracks ? 1 : 0));
      const trackX = trackWidths.map((_, track) => x + trackWidths.slice(0, track).reduce((sum, value) => sum + value, 0));
      const trackY = trackWidths.map(() => top);
      column.items.forEach((item, index) => {
        const track = index % tracks;
        const widget = item ? byId.get(item) : undefined;
        if (!widget) return;
        const h = estimateRows(widget, context);
        placed.push({
          id: widget.id,
          type: widget.type,
          ...(widget.hidden ? { hidden: true } : {}),
          settings: widget.settings,
          x: trackX[track],
          y: trackY[track],
          w: trackWidths[track],
          h,
        });
        trackY[track] += h;
      });
      bottom = Math.max(bottom, ...trackY);
      x += span;
    });
    top = bottom;
  }

  // Widgets that were not placed in any column stay on the page, at the end.
  for (const widget of widgets) {
    if (placed.some(entry => entry.id === widget.id)) continue;
    const h = estimateRows(widget, context);
    placed.push({ id: widget.id, type: widget.type, ...(widget.hidden ? { hidden: true } : {}), settings: widget.settings, x: 0, y: top, w: GRID_COLUMNS, h });
    top += h;
  }
  // Spacers only reserved room between widgets: on the free grid the gap stays by itself.
  return placed.filter(widget => widget.type !== 'spacer');
}
