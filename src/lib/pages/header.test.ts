import { describe, expect, it } from 'vitest';
import { addHeaderWidgets, DEFAULT_HEADER_SLOTS, ensureRequiredWidgets, growMenusIntoFreedColumns, isLastRequiredWidget, legacyHeaderSlots, type LegacyHeaderSettings } from './header';
import type { Page } from './types';

const place = (settings: LegacyHeaderSettings | undefined) => legacyHeaderSlots(settings).map(({ type, x, w, settings: own, hidden }) => ({ type, x, w, ...own, ...(hidden ? { hidden } : {}) }));

describe('header widgets from the historical header', () => {
  it('places search, menu and buttons as the default header showed them', () => {
    expect(place(undefined)).toEqual([
      { type: 'page-search', x: 0, w: 4 },
      { type: 'page-menu', x: 4, w: 15, align: 'center' },
      { type: 'page-actions', x: 19, w: 5, align: 'end' },
    ]);
    expect(place(undefined)).toEqual(DEFAULT_HEADER_SLOTS.map(({ type, x, w, settings }) => ({ type, x, w, ...settings })));
  });

  it('drops the site title and keeps the menu centred', () => {
    const slots = place({ headerLayoutDesktop: { left: 'title', center: 'menu', right: 'search', splitMenuAround: 'none' } });
    expect(slots.map(slot => slot.type)).toEqual(['page-menu', 'page-search', 'page-actions']);
    expect(slots[0]).toMatchObject({ x: 0, w: 15, align: 'center' });
    expect(slots[1]).toMatchObject({ x: 15, w: 4 });
  });

  it('splits the menu around the search', () => {
    expect(place({ headerLayoutDesktop: { left: 'none', center: 'menu', right: 'none', splitMenuAround: 'search' } })).toEqual([
      { type: 'page-menu', x: 5, w: 5, align: 'end', part: 'first' },
      { type: 'page-search', x: 10, w: 4 },
      { type: 'page-menu', x: 14, w: 5, align: 'start', part: 'second' },
      { type: 'page-actions', x: 19, w: 5, align: 'end' },
    ]);
  });

  it('keeps a hidden search out and a hidden menu hidden', () => {
    const slots = place({ hideHeaderSearch: true, hideHeaderMenu: true });
    expect(slots.map(slot => slot.type)).toEqual(['page-menu', 'page-actions']);
    expect(slots[0]).toMatchObject({ hidden: true });
  });

  it('keeps a menu that was not placed anywhere, hidden', () => {
    const slots = place({ headerLayoutDesktop: { left: 'search', center: 'title', right: 'none', splitMenuAround: 'none' } });
    expect(slots.find(slot => slot.type === 'page-menu')).toMatchObject({ hidden: true });
  });

  it('never overlaps and stays on the grid, whatever the historical layout', () => {
    const values = ['title', 'search', 'menu', 'none'];
    for (const left of values) for (const center of values) for (const right of values) for (const splitMenuAround of ['none', 'title', 'search']) {
      const slots = legacyHeaderSlots({ headerLayoutDesktop: { left, center, right, splitMenuAround } });
      for (const slot of slots) {
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.w).toBeGreaterThanOrEqual(1);
        expect(slot.x + slot.w).toBeLessThanOrEqual(24);
        expect(Number.isInteger(slot.x) && Number.isInteger(slot.w)).toBe(true);
      }
      const shown = slots.filter(slot => !slot.hidden);
      for (const a of shown) for (const b of shown) if (a !== b) expect(a.x + a.w <= b.x || b.x + b.w <= a.x).toBe(true);
      expect(slots.filter(slot => slot.type === 'page-actions')).toHaveLength(1);
      expect(slots.some(slot => slot.type === 'page-menu')).toBe(true);
    }
  });
});

describe('required header widgets', () => {
  const page: Page = { id: 'p', name: 'P', icon: '', revision: 1, widgets: [{ id: 'a', type: 'clock', settings: {}, x: 0, y: 0, w: 6, h: 40 }] };

  it('moves the page down by the header and adds the widgets on top', () => {
    const next = addHeaderWidgets(page, DEFAULT_HEADER_SLOTS);
    expect(next.widgets.map(widget => [widget.type, widget.y])).toEqual([['page-search', 0], ['page-menu', 0], ['page-actions', 0], ['clock', 14]]);
  });

  it('adds only what is missing, and only once', () => {
    const full = ensureRequiredWidgets(page);
    expect(full.widgets.map(widget => widget.type)).toEqual(['page-menu', 'page-actions', 'clock']);
    expect(ensureRequiredWidgets(full)).toBe(full);
  });

  it('protects the last menu and the last buttons of a page', () => {
    const full = addHeaderWidgets(page, DEFAULT_HEADER_SLOTS);
    const menu = full.widgets.find(widget => widget.type === 'page-menu')!;
    expect(isLastRequiredWidget(full, menu.id)).toBe(true);
    expect(isLastRequiredWidget(full, full.widgets.find(widget => widget.type === 'page-search')!.id)).toBe(false);
    const twice = { ...full, widgets: [...full.widgets, { ...menu, id: 'menu-2', y: 100 }] };
    expect(isLastRequiredWidget(twice, menu.id)).toBe(false);
  });
});

describe('growMenusIntoFreedColumns', () => {
  const widget = (id: string, type: string, x: number, w: number, y = 0, h = 13) => ({ id, type, x, y, w, h });
  it('gives the menu the columns the fitted buttons leave beside it', () => {
    const stored = [widget('s', 'page-search', 0, 4), widget('m', 'page-menu', 4, 15), widget('a', 'page-actions', 19, 5)];
    const shown = [stored[0], stored[1], widget('a', 'page-actions', 21, 3)];
    expect(growMenusIntoFreedColumns(stored, shown).map(item => [item.id, item.x, item.w])).toEqual([['s', 0, 4], ['m', 4, 17], ['a', 21, 3]]);
  });
  it('takes the columns freed on its left by start-aligned buttons', () => {
    const stored = [widget('a', 'page-actions', 0, 5), widget('m', 'page-menu', 5, 10)];
    const shown = [widget('a', 'page-actions', 0, 3), stored[1]];
    expect(growMenusIntoFreedColumns(stored, shown)[1]).toMatchObject({ x: 3, w: 12 });
  });
  it('leaves a menu alone when the buttons are elsewhere or unchanged', () => {
    const stored = [widget('m', 'page-menu', 4, 10), widget('a', 'page-actions', 19, 5), widget('b', 'page-actions', 14, 5, 20)];
    const shown = [stored[0], widget('a', 'page-actions', 21, 3), widget('b', 'page-actions', 16, 3, 20)];
    expect(growMenusIntoFreedColumns(stored, shown)[0]).toBe(stored[0]);
  });
});
