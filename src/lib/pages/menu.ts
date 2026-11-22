/**
 * Settings of the page menu widgets. Every menu of the dashboard shares one
 * set (`settings.pageMenu` in the configuration), so changing a menu on one
 * page changes them all. A menu can instead keep its own settings, for that
 * widget only (`ownSettings` on the widget). Sub-menus group pages under a
 * name: the menu shows the name and unfolds its pages.
 */

export type MenuStyle = 'tabs' | 'pill' | 'segmented' | 'icons';
export const MENU_STYLES: readonly MenuStyle[] = ['tabs', 'pill', 'segmented', 'icons'];
export type MenuAlign = 'start' | 'center' | 'end';

export interface MenuGroup {
  id: string;
  name: string;
  /** Page ids; the menu lists them in the dashboard's page order. */
  pages: string[];
}

export interface MenuSettings {
  style: MenuStyle;
  icons: boolean;
  /** At most this many pages per line; undefined: as many as fit. */
  perRow?: number;
  /** Pages (or sub-menus) shown before "Others"; undefined: all. */
  maxPages?: number;
  align: MenuAlign;
  groups: MenuGroup[];
}

export const MENU_LIMITS = { groups: 20, groupName: 60, groupPages: 100 } as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : undefined;

/** The menu settings found in `source` (shared settings or a widget's own), unknown values left out. */
export function readMenuSettings(source: unknown): Partial<MenuSettings> {
  if (!isRecord(source)) return {};
  const read: Partial<MenuSettings> = {};
  if (MENU_STYLES.includes(source.style as MenuStyle)) read.style = source.style as MenuStyle;
  if (typeof source.icons === 'boolean') read.icons = source.icons;
  // 0 means "as many as fit" / "all": saved explicitly so it wins over a fallback.
  if (source.perRow === 0) read.perRow = undefined; else if (count(source.perRow)) read.perRow = count(source.perRow);
  if (source.maxPages === 0) read.maxPages = undefined; else if (count(source.maxPages)) read.maxPages = count(source.maxPages);
  if (source.align === 'start' || source.align === 'center' || source.align === 'end') read.align = source.align;
  if (Array.isArray(source.groups)) read.groups = readGroups(source.groups);
  return read;
}

function readGroups(value: unknown[]): MenuGroup[] {
  const groups: MenuGroup[] = [];
  const taken = new Set<string>();
  for (const entry of value.slice(0, MENU_LIMITS.groups)) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.name !== 'string' || !Array.isArray(entry.pages)) continue;
    // A page belongs to one sub-menu at most: the first one keeps it.
    const pages = entry.pages.filter((page): page is string => typeof page === 'string' && !taken.has(page)).slice(0, MENU_LIMITS.groupPages);
    pages.forEach(page => taken.add(page));
    groups.push({ id: entry.id, name: entry.name.slice(0, MENU_LIMITS.groupName), pages });
  }
  return groups;
}

/**
 * The settings a menu widget uses: its own when it keeps them, otherwise the
 * shared ones. Upgraded menus carry their former alignment and icons, which
 * stand until shared values are saved, so the upgrade changes nothing.
 */
export function resolveMenuSettings(widget: Record<string, unknown>, shared: unknown, legacyIcons?: boolean): MenuSettings {
  const common = readMenuSettings(shared);
  const own = readMenuSettings(widget);
  const first = widget.ownSettings === true ? { ...common, ...own } : { ...own, ...common };
  return {
    style: first.style ?? 'tabs',
    icons: first.icons ?? legacyIcons ?? false,
    perRow: 'perRow' in first ? first.perRow : undefined,
    maxPages: 'maxPages' in first ? first.maxPages : undefined,
    align: first.align ?? 'center',
    groups: widget.ownSettings === true ? (own.groups ?? common.groups ?? []) : (common.groups ?? []),
  };
}

export type MenuItem<Tab extends { id: string }> =
  | { kind: 'page'; id: string; tab: Tab }
  | { kind: 'group'; id: string; group: MenuGroup; tabs: Tab[] };

/**
 * What the menu shows, in page order: pages, and sub-menus where their first
 * page is. A sub-menu with none of its pages here is left out.
 */
export function menuItems<Tab extends { id: string }>(tabs: readonly Tab[], groups: readonly MenuGroup[]): MenuItem<Tab>[] {
  const groupOf = new Map<string, MenuGroup>();
  for (const group of groups) for (const page of group.pages) if (!groupOf.has(page)) groupOf.set(page, group);
  const items: MenuItem<Tab>[] = [];
  const placed = new Map<string, Extract<MenuItem<Tab>, { kind: 'group' }>>();
  for (const tab of tabs) {
    const group = groupOf.get(tab.id);
    if (!group) { items.push({ kind: 'page', id: tab.id, tab }); continue; }
    const existing = placed.get(group.id);
    if (existing) { existing.tabs.push(tab); continue; }
    const item = { kind: 'group' as const, id: `group:${group.id}`, group, tabs: [tab] };
    placed.set(group.id, item);
    items.push(item);
  }
  return items;
}

/** The pages an item stands for, in order. */
export function itemPages<Tab extends { id: string }>(item: MenuItem<Tab>): Tab[] {
  return item.kind === 'page' ? [item.tab] : item.tabs;
}
