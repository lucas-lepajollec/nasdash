import { GRID_COLUMNS, type Page, type WidgetInstance, type WidgetSettings } from './types';

/**
 * The page header is made of widgets: the search field, the page menu and the
 * action buttons (hide information, edit, settings, account). They sit at the
 * top of each page's grid like any other widget.
 *
 * The menu and the actions are required on every page, so a page can never
 * lose its way to the other pages or to the settings. Pages saved before
 * header widgets existed get them once, placed where the historical header
 * showed them (`legacyHeaderSlots`), with everything else moved down by the
 * header's height: the page looks the same as before.
 */

export const SEARCH_WIDGET = 'page-search';
export const MENU_WIDGET = 'page-menu';
export const ACTIONS_WIDGET = 'page-actions';

export const HEADER_WIDGET_TYPES: ReadonlySet<string> = new Set([SEARCH_WIDGET, MENU_WIDGET, ACTIONS_WIDGET]);
/** Every page keeps at least one of each. */
export const REQUIRED_WIDGET_TYPES: readonly string[] = [MENU_WIDGET, ACTIONS_WIDGET];

/** Header widget height in rows: 36 px of content and the 8 px grid gutter above and below. */
export const HEADER_ROWS = 13;
/** Rows between the header widgets and the page below them, as under the historical header. */
export const HEADER_GAP_ROWS = 1;

export type HeaderAlign = 'start' | 'center' | 'end';

export interface HeaderSlot {
  type: string;
  x: number;
  w: number;
  settings: WidgetSettings;
  hidden?: boolean;
}

/*
 * Widths close to the historical header's: the search about as wide as its
 * field was, the buttons as wide as they are (their widget fits them), and the
 * menu all the room between, as it had (it no longer squeezes its pages, so a
 * narrower menu would have taken a second line).
 */
const SEARCH_W = 4;
const ACTIONS_W = 5;
/** The menu never gets fewer columns than this when it shares the row. */
const MENU_MIN_W = 6;

/** New pages: search on the left, the menu in the middle, the buttons on the right. */
export const DEFAULT_HEADER_SLOTS: readonly HeaderSlot[] = [
  { type: SEARCH_WIDGET, x: 0, w: SEARCH_W, settings: {} },
  { type: MENU_WIDGET, x: SEARCH_W, w: GRID_COLUMNS - SEARCH_W - ACTIONS_W, settings: { align: 'center' } },
  { type: ACTIONS_WIDGET, x: GRID_COLUMNS - ACTIONS_W, w: ACTIONS_W, settings: { align: 'end' } },
];

/** The historical header settings (`config.settings`), read only to place the header widgets once. */
export interface LegacyHeaderSettings {
  hideHeaderSearch?: boolean;
  hideHeaderMenu?: boolean;
  showHeaderMenuIcons?: boolean;
  headerLayoutDesktop?: { left?: string; center?: string; right?: string; splitMenuAround?: string };
}

/**
 * Where the historical header showed each element, as header widgets. Its
 * three zones (left, centre, right) become columns; the buttons were always at
 * the right end. The site title is no longer part of the header.
 */
export function legacyHeaderSlots(settings: LegacyHeaderSettings | undefined): HeaderSlot[] {
  const layout = { left: 'search', center: 'menu', right: 'none', splitMenuAround: 'none', ...(settings?.headerLayoutDesktop ?? {}) };
  const searchShown = !settings?.hideHeaderSearch;
  const icons = settings?.showHeaderMenuIcons === true;
  const menu = (x: number, w: number, align: HeaderAlign, part?: 'first' | 'second'): HeaderSlot => ({
    type: MENU_WIDGET, x, w, settings: { align, ...(icons ? { icons: true } : {}), ...(part ? { part } : {}) },
  });
  const search = (x: number): HeaderSlot => ({ type: SEARCH_WIDGET, x, w: SEARCH_W, settings: {} });
  const split = layout.splitMenuAround === 'title' || layout.splitMenuAround === 'search' ? layout.splitMenuAround : 'none';
  // With a split menu, the element it surrounds is drawn in the middle and the menu only there.
  const side = (value: string) => (split !== 'none' && value === split) || (split !== 'none' && value === 'menu') ? 'none' : value;
  // Each element appears once, in its first zone (left, centre, right).
  const used = new Set<string>();
  const once = (value: string) => {
    if (value === 'none' || value === 'title') return value;
    if (used.has(value)) return 'none';
    used.add(value);
    return value;
  };
  if (split !== 'none') { used.add('menu'); if (split === 'search') used.add('search'); }
  const left = once(side(layout.left));
  const center = split !== 'none' ? layout.center : once(layout.center);
  const right = once(side(layout.right));

  const slots: HeaderSlot[] = [{ type: ACTIONS_WIDGET, x: GRID_COLUMNS - ACTIONS_W, w: ACTIONS_W, settings: { align: 'end' } }];
  let leftEnd = 0;
  let rightStart = GRID_COLUMNS - ACTIONS_W;
  if (left === 'search' && searchShown) { slots.push(search(0)); leftEnd = SEARCH_W; }
  if (right === 'search' && searchShown) { rightStart -= SEARCH_W; slots.push(search(rightStart)); }
  // A menu takes all the room the sides leave (the historical one did); a
  // menu split around something stays symmetric, so that thing is centred.
  const middle = { start: leftEnd, end: rightStart };
  const margin = Math.max(leftEnd, GRID_COLUMNS - rightStart);
  const symmetric = GRID_COLUMNS - 2 * margin >= MENU_MIN_W ? { start: margin, end: GRID_COLUMNS - margin } : middle;
  let menuPlaced = false;

  if (split !== 'none') {
    // The two halves of the menu frame the middle of the page.
    const mid = Math.floor((symmetric.start + symmetric.end) / 2);
    const halves: [number, number][] = [];
    if (split === 'search' && searchShown) {
      const x = Math.max(symmetric.start, Math.min(symmetric.end - SEARCH_W, mid - SEARCH_W / 2));
      slots.push(search(x));
      halves.push([symmetric.start, x], [x + SEARCH_W, symmetric.end]);
    } else {
      halves.push([symmetric.start, mid], [mid, symmetric.end]);
    }
    halves.forEach(([start, end], index) => {
      if (end - start < 1) return;
      slots.push(menu(start, end - start, index === 0 ? 'end' : 'start', index === 0 ? 'first' : 'second'));
      menuPlaced = true;
    });
  } else if (center === 'menu') {
    slots.push(menu(middle.start, middle.end - middle.start, 'center'));
    menuPlaced = true;
  } else if (center === 'search' && searchShown) {
    if (right === 'menu') {
      // The menu keeps room on the right: the search moves left of the middle.
      const x = Math.max(leftEnd, rightStart - MENU_MIN_W - 2 - SEARCH_W);
      slots.push(search(x));
      slots.push(menu(x + SEARCH_W, rightStart - x - SEARCH_W, 'end'));
      menuPlaced = true;
    } else {
      const x = Math.max(leftEnd, GRID_COLUMNS / 2 - SEARCH_W / 2);
      slots.push(search(x));
      if (left === 'menu') { slots.push(menu(0, x, 'start')); menuPlaced = true; }
    }
  } else {
    if (left === 'menu') { slots.push(menu(0, rightStart, 'start')); menuPlaced = true; }
    else if (right === 'menu') { slots.push(menu(leftEnd, rightStart - leftEnd, 'end')); menuPlaced = true; }
  }
  if (!menuPlaced) {
    // The menu was not shown: it exists (required) but stays hidden, as before.
    slots.push({ ...menu(SEARCH_W, GRID_COLUMNS - SEARCH_W - ACTIONS_W, 'center'), hidden: true });
  } else if (settings?.hideHeaderMenu) {
    for (const slot of slots) if (slot.type === MENU_WIDGET) slot.hidden = true;
  }
  return slots.sort((a, b) => a.x - b.x);
}

function uniqueId(base: string, taken: Set<string>): string {
  const clean = base.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 120);
  let id = clean;
  for (let index = 2; taken.has(id); index++) id = `${clean}-${index}`;
  taken.add(id);
  return id;
}

/**
 * Puts header widgets on the top row of a page and moves every other widget
 * down by the header's height, so the page below looks unchanged.
 */
export function addHeaderWidgets(page: Page, slots: readonly HeaderSlot[]): Page {
  if (!slots.length) return page;
  const shift = HEADER_ROWS + HEADER_GAP_ROWS;
  const taken = new Set(page.widgets.map(widget => widget.id));
  const header: WidgetInstance[] = slots.map(slot => ({
    id: uniqueId(`${slot.type}-${page.id}`, taken),
    type: slot.type,
    x: slot.x,
    y: 0,
    w: slot.w,
    h: HEADER_ROWS,
    settings: { ...slot.settings },
    ...(slot.hidden ? { hidden: true } : {}),
  }));
  return { ...page, widgets: [...header, ...page.widgets.map(widget => ({ ...widget, y: widget.y + shift }))] };
}

/** Required header widgets a page does not have. */
export function missingRequiredWidgets(page: Pick<Page, 'widgets'>): string[] {
  return REQUIRED_WIDGET_TYPES.filter(type => !page.widgets.some(widget => widget.type === type));
}

/** Adds the required header widgets a page lacks, at their default place. */
export function ensureRequiredWidgets(page: Page): Page {
  const missing = missingRequiredWidgets(page);
  if (!missing.length) return page;
  return addHeaderWidgets(page, DEFAULT_HEADER_SLOTS.filter(slot => missing.includes(slot.type)));
}

/** The last menu or last actions widget of a page cannot be removed. */
export function isLastRequiredWidget(page: Pick<Page, 'widgets'>, widgetId: string): boolean {
  const widget = page.widgets.find(candidate => candidate.id === widgetId);
  if (!widget || !REQUIRED_WIDGET_TYPES.includes(widget.type)) return false;
  return page.widgets.filter(candidate => candidate.type === widget.type).length === 1;
}

type Placed = Pick<WidgetInstance, 'id' | 'type' | 'x' | 'y' | 'w' | 'h'>;

/**
 * A widget fitted to its content (the buttons) shows narrower than stored;
 * a page menu touching it takes the columns it leaves on the menu's side, as
 * the historical header gave the menu all the room the buttons did not use.
 * Display only: `stored` is what the page saves, `shown` the fitted widths.
 */
export function growMenusIntoFreedColumns<T extends Placed>(stored: readonly T[], shown: readonly T[]): T[] {
  const before = new Map(stored.map(widget => [widget.id, widget]));
  const overlaps = (a: Placed, b: Placed) => a.y < b.y + b.h && b.y < a.y + a.h;
  return shown.map(menu => {
    if (menu.type !== MENU_WIDGET) return menu;
    let { x, w } = menu;
    for (const other of shown) {
      const was = before.get(other.id);
      if (!was || other.id === menu.id || other.w >= was.w || !overlaps(menu, other)) continue;
      // Freed on its left side, against the menu's right edge.
      if (was.x === menu.x + menu.w && other.x > was.x) w += other.x - was.x;
      // Freed on its right side, against the menu's left edge.
      if (was.x + was.w === menu.x && other.x + other.w < was.x + was.w) {
        const freed = was.x + was.w - (other.x + other.w);
        x -= freed;
        w += freed;
      }
    }
    return x === menu.x && w === menu.w ? menu : { ...menu, x, w };
  });
}
