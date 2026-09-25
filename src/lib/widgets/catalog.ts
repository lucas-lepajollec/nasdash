import type { WidgetGroup, WidgetDefinition } from '@/widgets/define';
import { WIDGET_DEFINITIONS } from '@/widgets/definitions';

/**
 * Server-safe description of every widget type. It drives validation, access
 * filtering, the migration and the widget library. React components are bound
 * to these types separately, on the client.
 */

export type { WidgetGroup } from '@/widgets/define';

/**
 * Catalogue entry as the rest of the app reads it (grid sizes flattened).
 * Each entry is written in `src/widgets/<type>/definition.ts`.
 */
export interface WidgetCatalogEntry extends Omit<WidgetDefinition, 'sizes'> {
  /** Width when added, smallest usable width (px), typical height (px), allowed widths (columns). */
  grid: { w: number; minPx: number; h: number; sizes: readonly number[] };
}

export const WIDGET_CATALOG: readonly WidgetCatalogEntry[] = WIDGET_DEFINITIONS.map(({ sizes, ...definition }) => ({
  ...definition,
  grid: { w: sizes.default, minPx: sizes.minPx, h: sizes.h, sizes: sizes.formats },
}));

const BY_TYPE = new Map(WIDGET_CATALOG.map(entry => [entry.type, entry]));

export function getWidgetCatalogEntry(type: string): WidgetCatalogEntry | undefined {
  return BY_TYPE.get(type);
}

export const WIDGET_GROUP_ORDER: readonly WidgetGroup[] = ['services', 'system', 'docker', 'network', 'gadgets', 'layout'];

/** Minimal bounds for per-instance settings stored on pages. */
export const SPACER_HEIGHT = { min: 20, max: 1000, default: 120 } as const;

export interface WidgetViewer {
  role: 'admin' | 'viewer';
  allowedTabs?: string[];
  allowedWidgets?: string[];
}

function listAllows(values: string[] | undefined, id: string): boolean {
  // Historical convention: an empty or missing list means unrestricted.
  return !values || values.length === 0 || values.includes(id);
}

/**
 * Same rules on the server (page filtering) and the client (rendering).
 * Unknown types are hidden from non-admin users.
 */
export function canViewWidget(viewer: WidgetViewer | null | undefined, type: string): boolean {
  if (!viewer || viewer.role === 'admin') return true;
  const entry = getWidgetCatalogEntry(type);
  if (!entry) return false;
  if (entry.access === null) return true;
  if ('permission' in entry.access) return listAllows(viewer.allowedWidgets, entry.access.permission);
  const { tabs = [], widgets = [] } = entry.access.requirement;
  return tabs.some(tab => listAllows(viewer.allowedTabs, tab))
    || widgets.some(widget => listAllows(viewer.allowedWidgets, widget));
}
