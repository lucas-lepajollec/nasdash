/**
 * Universal page model.
 *
 * Every page of the dashboard — the official Home, Docker, Networks and Widgets
 * pages as well as pages created by the user — is one free grid of widgets,
 * each with its own position and width.
 *
 * A page describes presentation only. Widget settings reference resources
 * (categories, Docker hosts, devices…) by id; they never copy them and never
 * store credentials. Removing a widget from a page never deletes its resource.
 */

export const PAGES_SCHEMA_VERSION = 5;

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type WidgetSettings = { [key: string]: JsonValue };

/** Official pages that can be restored from a preset. */
export const OFFICIAL_PAGE_IDS = ['dashboard', 'docker', 'networks', 'widgets'] as const;
export type OfficialPageId = typeof OFFICIAL_PAGE_IDS[number];
export type PresetId = OfficialPageId;

/** Every page is one free grid of this many columns (desktop reference). */
export const GRID_COLUMNS = 24;
/** Height of one grid row in pixels. Widgets keep the height chosen by the user. */
export const GRID_ROW_PX = 4;

export interface GridPlacement {
  /** Column of the left edge, 0–23. */
  x: number;
  /** Row of the top edge. Widgets stay where they are placed; gaps are allowed. */
  y: number;
  /** Width in columns, 1–24. */
  w: number;
  /** Height in rows; the content scrolls when it does not fit. */
  h: number;
}

export interface WidgetInstance extends GridPlacement {
  id: string;
  type: string;
  /** Kept on the page with its settings, shown only while editing. */
  hidden?: boolean;
  settings: WidgetSettings;
}

export interface Page {
  id: string;
  /** Displayed through the translator, like the historical tab names. */
  name: string;
  icon: string;
  description?: string;
  /** Official preset this page was created from, used to restore it. */
  preset?: PresetId;
  /** Incremented on every write; used to detect concurrent edits. */
  revision: number;
  widgets: WidgetInstance[];
}

export interface PagesDocument {
  schemaVersion: typeof PAGES_SCHEMA_VERSION;
  pages: Page[];
  /** Set when the document was generated from the pre-page configuration. */
  migration?: { from: 'legacy' | 'sections'; at: string; notes: string[] };
}

export function isOfficialPageId(id: string): id is OfficialPageId {
  return (OFFICIAL_PAGE_IDS as readonly string[]).includes(id);
}
