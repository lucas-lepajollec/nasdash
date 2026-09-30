import { describe, expect, it } from 'vitest';
import { autoMobileOrder, isHiddenOnMobile, mobileOrder, moveOnMobile, resetMobileLayout, setHiddenOnMobile } from './operations';
import type { Page, WidgetInstance } from './types';
import { validatePage } from './validation';

const widget = (id: string, x: number, y: number, w: number, h = 10): WidgetInstance => ({ id, type: 'clock', settings: {}, x, y, w, h });
const page = (widgets: WidgetInstance[], mobile?: Page['mobile']): Page => ({ id: 'home', name: 'Home', icon: '🏠', revision: 1, widgets, ...(mobile ? { mobile } : {}) });

describe('phone and tablet order', () => {
  it('reads the desktop columns one after the other', () => {
    // A C E / B D
    const widgets = [widget('A', 0, 0, 8), widget('C', 8, 0, 8), widget('E', 16, 0, 8), widget('B', 0, 12, 8), widget('D', 8, 12, 8)];
    expect(autoMobileOrder(widgets).map(item => item.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('keeps a column together when its widgets have different widths', () => {
    const widgets = [widget('clock', 0, 0, 5), widget('devices', 0, 12, 6), widget('media', 6, 0, 6)];
    expect(autoMobileOrder(widgets).map(item => item.id)).toEqual(['clock', 'devices', 'media']);
  });

  it('lets a wide widget end the columns above it', () => {
    const widgets = [widget('A', 0, 0, 12), widget('B', 12, 0, 12), widget('band', 0, 20, 24), widget('C', 0, 40, 12), widget('D', 12, 40, 12)];
    expect(autoMobileOrder(widgets).map(item => item.id)).toEqual(['A', 'B', 'band', 'C', 'D']);
  });

  it('reads a wide widget with columns beside it as a column, not a band', () => {
    // Docker page: hosts | explorer (wide) | containers
    const widgets = [widget('hosts', 0, 0, 5), widget('summary', 0, 12, 5), widget('explorer', 5, 0, 14, 40), widget('containers', 19, 0, 5)];
    expect(autoMobileOrder(widgets).map(item => item.id)).toEqual(['hosts', 'summary', 'explorer', 'containers']);
  });

  it('puts the chosen order first, then the others automatically', () => {
    const current = page([widget('A', 0, 0, 8), widget('B', 0, 12, 8), widget('C', 8, 0, 8)], { order: ['C', 'gone'] });
    expect(mobileOrder(current).map(item => item.id)).toEqual(['C', 'A', 'B']);
  });

  it('moves, hides and resets without touching the desktop positions', () => {
    const start = page([widget('A', 0, 0, 8), widget('B', 0, 12, 8), widget('C', 8, 0, 8)]);
    const moved = moveOnMobile(start, 'C', 0);
    expect(mobileOrder(moved).map(item => item.id)).toEqual(['C', 'A', 'B']);
    expect(moved.widgets).toEqual(start.widgets);
    const hidden = setHiddenOnMobile(moved, 'B', true);
    expect(isHiddenOnMobile(hidden, 'B')).toBe(true);
    expect(isHiddenOnMobile(setHiddenOnMobile(hidden, 'B', false), 'B')).toBe(false);
    expect(resetMobileLayout(hidden).mobile).toBeUndefined();
  });

  it('keeps only valid, known and unique ids when saved', () => {
    const saved = validatePage(page([widget('A', 0, 0, 8), widget('B', 0, 12, 8)], { order: ['B', 'B', 'ghost', 'A'], hidden: ['ghost'] }));
    expect(saved.mobile).toEqual({ order: ['B', 'A'] });
    expect(validatePage(page([widget('A', 0, 0, 8)], { order: [], hidden: [] })).mobile).toBeUndefined();
    expect(() => validatePage({ ...page([widget('A', 0, 0, 8)]), mobile: { order: 'A' } })).toThrow();
  });
});
