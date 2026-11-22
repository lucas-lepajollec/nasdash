import { describe, expect, it } from 'vitest';
import { addHeaderWidgets, DEFAULT_HEADER_SLOTS, ensureRequiredWidgets, isLastRequiredWidget, legacyHeaderSlots, type LegacyHeaderSettings } from './header';
import type { Page } from './types';

const place = (settings: LegacyHeaderSettings | undefined) => legacyHeaderSlots(settings).map(({ type, x, w, settings: own, hidden }) => ({ type, x, w, ...own, ...(hidden ? { hidden } : {}) }));

describe('header widgets from the historical header', () => {
  it('places search, menu and buttons as the default header showed them', () => {
    expect(place(undefined)).toEqual([
      { type: 'page-search', x: 0, w: 6 },
      { type: 'page-menu', x: 6, w: 12, align: 'center' },
      { type: 'page-actions', x: 18, w: 6, align: 'end' },
    ]);
    expect(place(undefined)).toEqual(DEFAULT_HEADER_SLOTS.map(({ type, x, w, settings }) => ({ type, x, w, ...settings })));
  });

  it('drops the site title and keeps the menu centred', () => {
    const slots = place({ headerLayoutDesktop: { left: 'title', center: 'menu', right: 'search', splitMenuAround: 'none' } });
    expect(slots.map(slot => slot.type)).toEqual(['page-menu', 'page-search', 'page-actions']);
    expect(slots[0]).toMatchObject({ x: 0, w: 12, align: 'center' });
    expect(slots[1]).toMatchObject({ x: 12, w: 6 });
  });

  it('splits the menu around the search', () => {
    expect(place({ headerLayoutDesktop: { left: 'none', center: 'menu', right: 'none', splitMenuAround: 'search' } })).toEqual([
      { type: 'page-menu', x: 6, w: 3, align: 'end', part: 'first' },
      { type: 'page-search', x: 9, w: 6 },
      { type: 'page-menu', x: 15, w: 3, align: 'start', part: 'second' },
      { type: 'page-actions', x: 18, w: 6, align: 'end' },
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
