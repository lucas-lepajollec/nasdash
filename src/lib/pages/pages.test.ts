import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Category, DashboardConfig } from '../types';
import { migrateLegacyPages } from './legacy-migration';
import {
  applyPlacements,
  firstFreePlacement,
  insertWidget,
  newWidgetInstance,
  placementProblem,
  pushOverlaps,
  settleBelow,
  reflowHeights,
  removeWidget,
  resolveOverlaps,
  setWidgetHidden,
  snapWidth,
  widgetsInReadingOrder,
  widthFormats,
} from './operations';
import { buildOfficialPage, buildTemplate, PAGE_TEMPLATES } from './presets';
import { columnSpans, sectionsToGrid } from './sectioned';
import { GRID_COLUMNS, type Page, type WidgetInstance } from './types';
import { WIDGET_CATALOG } from '../widgets/catalog';
import { validatePage, validatePagesDocument } from './validation';

const fixtures = path.join(process.cwd(), 'demo', 'fixtures');
const readFixture = <T,>(name: string): T => JSON.parse(fs.readFileSync(path.join(fixtures, name), 'utf8')) as T;

function demoInput() {
  const config = readFixture<DashboardConfig>('config.json');
  const categories = readFixture<Category[]>('services.json');
  const customTabs = readFixture<{ tabs: { id: string; name: string; icon: string }[]; layouts: Record<string, never> }>('custom_tabs.json');
  return { config: { ...config, categories }, categories, customTabs };
}

const byId = (page: Page, id: string) => page.widgets.find(widget => widget.id === id)!;

function page(): Page {
  return {
    id: 'p', name: 'Test', icon: '🧪', revision: 1,
    widgets: [
      { id: 'a', type: 'clock', settings: {}, x: 0, y: 0, w: 6, h: 20 },
      { id: 'b', type: 'weather', settings: {}, x: 6, y: 0, w: 6, h: 30 },
      { id: 'c', type: 'service-category', settings: { categoryId: 'media' }, x: 0, y: 20, w: 12, h: 40 },
    ],
  };
}

describe('legacy migration to the grid', () => {
  it('turns every historical page of the demo into a valid grid page', () => {
    const document = migrateLegacyPages(demoInput(), new Date('2026-09-23T00:00:00Z'));
    expect(() => validatePagesDocument(document)).not.toThrow();
    expect(document.schemaVersion).toBe(5);
    expect(document.pages.map(p => p.id)).toEqual([
      'dashboard', 'docker', 'networks', 'widgets', 'custom_abfe3709-c807-49cd-b64b-a1931d6cb2a2',
    ]);
  });

  it('keeps the Home arrangement: sidebars, category grid, bottom panel and footer', () => {
    const home = migrateLegacyPages(demoInput()).pages[0];
    expect(byId(home, 'clock-demo')).toMatchObject({ x: 0, y: 0, w: 3 });
    expect(byId(home, 'devices-demo').x).toBe(0);
    expect(byId(home, 'devices-demo').y).toBeGreaterThan(0);
    expect(byId(home, 'quickstats-demo')).toMatchObject({ x: 21, y: 0, w: 3 });
    const media = byId(home, 'home-cat-category-media');
    const infra = byId(home, 'home-cat-category-infrastructure');
    const automation = byId(home, 'home-cat-category-automation');
    expect([media.x, infra.x, automation.x]).toEqual([3, 8, 13]);
    expect(media.y).toBe(0);
    expect(byId(home, 'home-cat-category-library-automation')).toMatchObject({ x: 17, y: 0 });
    const lowest = Math.max(...home.widgets.filter(w => !['network-demo', 'home-service-ports'].includes(w.id)).map(w => w.y + w.h));
    expect(byId(home, 'network-demo').y).toBeGreaterThanOrEqual(lowest);
    expect(byId(home, 'home-service-ports')).toMatchObject({ x: 0, w: 24 });
    expect(byId(home, 'devices-demo').settings).toHaveProperty('deviceConfigs');
  });

  it('keeps globally hidden widgets, hidden', () => {
    const input = demoInput();
    input.config.settings.hideClock = true;
    expect(byId(migrateLegacyPages(input).pages[0], 'clock-demo').hidden).toBe(true);
  });

  it('places Docker as a panel next to the explorer', () => {
    const docker = migrateLegacyPages(demoInput()).pages.find(p => p.id === 'docker')!;
    expect(byId(docker, 'docker-hosts')).toMatchObject({ x: 0, w: 5 });
    expect(byId(docker, 'docker-explorer')).toMatchObject({ x: 5, y: 0 });
    expect(byId(docker, 'docker-explorer').w).toBeGreaterThanOrEqual(10);
  });

  it('migrates custom tab rows with their proportions', () => {
    const input = demoInput();
    input.customTabs = {
      tabs: [{ id: 'custom_x', name: 'Mine', icon: '⭐' }],
      layouts: {
        custom_x: {
          id: 'custom_x',
          rows: [{
            id: 'r1', type: '25-75',
            columns: [
              { id: 'c1', width: '25%', content: null, widgets: [{ type: 'clock' }] },
              { id: 'c2', width: '75%', content: null, widgets: [{ type: 'weather', props: { a: 1 } }] },
            ],
          }],
        } as never,
      },
    };
    const custom = migrateLegacyPages(input).pages.find(p => p.id === 'custom_x')!;
    expect(() => validatePage(custom)).not.toThrow();
    const [clock, weather] = widgetsInReadingOrder(custom);
    expect(clock).toMatchObject({ type: 'clock', x: 0, w: 6 });
    expect(weather).toMatchObject({ type: 'weather', x: 6, w: 18, settings: { a: 1 } });
  });

  it('is deterministic', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    expect(migrateLegacyPages(demoInput(), date)).toEqual(migrateLegacyPages(demoInput(), date));
  });
});

describe('sections to grid', () => {
  it('shares the grid columns between fixed and flexible columns', () => {
    const column = (width: 'sidebar' | 'panel' | 'fill' | number) => ({ id: String(width), width, arrangement: 'stack' as const, items: [] });
    expect(columnSpans([column('sidebar'), column('fill'), column('sidebar')])).toEqual([3, 18, 3]);
    expect(columnSpans([column('panel'), column('fill')])).toEqual([5, 19]);
    expect(columnSpans([column(33.33), column(33.33), column(33.33)])).toEqual([8, 8, 8]);
    expect(columnSpans([column(25), column(75)])).toEqual([6, 18]);
  });

  it('never loses a widget that is not placed in a column', () => {
    const placed = sectionsToGrid([], [{ id: 'z', type: 'clock', settings: {} }], { categories: [], deviceCount: 1 });
    expect(placed).toEqual([expect.objectContaining({ id: 'z', x: 0, y: 0, w: 24 })]);
  });
});

describe('page validation', () => {
  it('accepts a well-formed page', () => {
    expect(validatePage(page())).toEqual(page());
  });

  it('refuses placements outside the grid, duplicates and unsafe settings', () => {
    const outside = page();
    outside.widgets[0] = { ...outside.widgets[0], x: 23, w: 3 };
    expect(() => validatePage(outside)).toThrow(/entier/);
    const twice = page();
    twice.widgets.push({ ...twice.widgets[0] });
    expect(() => validatePage(twice)).toThrow(/dupliqué/);
    const proto = page();
    proto.widgets[0].settings = JSON.parse('{"__proto__": {"x": 1}}');
    expect(() => validatePage(proto)).toThrow(/interdite/);
    expect(() => validatePage({ ...page(), sections: [] })).toThrow(/inconnu/);
    const noCategory = page();
    noCategory.widgets[2].settings = {};
    expect(() => validatePage(noCategory)).toThrow(/catégorie/);
  });

  it('accepts every template and official preset', () => {
    for (const template of PAGE_TEMPLATES) {
      const built = buildTemplate(template, 'page_1', { categories: [{ id: 'media', title: 'Media', emoji: '🎬', order: 0, services: [] }] });
      expect(() => validatePage({ id: 'page_1', name: 'x', icon: '', revision: 0, ...built }), template).not.toThrow();
    }
  });
});

describe('grid operations', () => {
  it('moves widgets below a growing widget and brings them back when it shrinks', () => {
    const stored = [
      { id: 'a', x: 0, y: 0, w: 6, h: 20 },
      { id: 'b', x: 6, y: 0, w: 6, h: 30 },
      { id: 'c', x: 0, y: 30, w: 12, h: 40 },
    ];
    // a grows by 4 rows, like a title shown in edit mode.
    const grown = reflowHeights(stored, { a: 24 });
    expect(grown.find(w => w.id === 'a')).toMatchObject({ y: 0, h: 24 });
    // c spans a and b: its gap to the lowest one (b, bottom 30) is kept.
    expect(grown.find(w => w.id === 'c')).toMatchObject({ y: 30 });
    const taller = reflowHeights(stored, { a: 40 });
    expect(taller.find(w => w.id === 'c')).toMatchObject({ y: 40 });
    // Back to the stored heights: exactly the stored layout, no gap left.
    expect(reflowHeights(taller, { a: 20 })).toEqual(stored);
  });

  it('keeps deliberate vertical gaps', () => {
    const spaced = [
      { id: 'top', x: 0, y: 0, w: 6, h: 10 },
      { id: 'low', x: 0, y: 25, w: 6, h: 10 },
    ];
    expect(reflowHeights(spaced, { top: 5 }).map(w => w.y)).toEqual([0, 20]);
    expect(reflowHeights(spaced, { top: 14 }).map(w => w.y)).toEqual([0, 29]);
  });

  it('resolves overlaps by moving widgets down', () => {
    const resolved = resolveOverlaps([
      { x: 0, y: 0, w: 6, h: 10 },
      { x: 2, y: 5, w: 6, h: 10 },
      { x: 12, y: 0, w: 6, h: 10 },
    ]);
    expect(resolved.map(widget => widget.y)).toEqual([0, 10, 0]);
  });

  it('offers only the formats of a widget that fit the screen', () => {
    for (const entry of WIDGET_CATALOG) {
      const { sizes, w } = entry.grid;
      expect(sizes.length, entry.type).toBeGreaterThan(0);
      expect([...sizes].sort((a, b) => a - b), entry.type).toEqual(sizes);
      expect(sizes.every(size => Number.isInteger(size) && size >= 1 && size <= GRID_COLUMNS), entry.type).toBe(true);
      expect(sizes, entry.type).toContain(w);
    }
    // One definition per widget type.
    expect(new Set(WIDGET_CATALOG.map(entry => entry.type)).size).toBe(WIDGET_CATALOG.length);
    // 1920 px wide page: 80 px columns, every clock format fits.
    expect(widthFormats('clock', 80)).toEqual([3, 4, 6, 8]);
    // 1000 px: 3 columns (≈ 125 px) are below the clock's 150 px minimum.
    expect(widthFormats('clock', 42)).toEqual([4, 6, 8]);
    // Nothing fits: the largest format is still offered.
    expect(widthFormats('network-topology', 10)).toEqual([24]);
    expect(snapWidth([3, 4, 6, 8], 5.2)).toBe(6);
    expect(snapWidth([3, 4, 6, 8], 5)).toBe(4);
    expect(snapWidth([3, 4, 6, 8], 30)).toBe(8);
  });

  it('pushes neighbours below a widget being widened', () => {
    const widened = pushOverlaps([
      { id: 'left', x: 0, y: 0, w: 6, h: 10 },
      { id: 'right', x: 4, y: 0, w: 6, h: 10 },
      { id: 'below', x: 4, y: 12, w: 6, h: 10 },
    ], 'right');
    expect(widened.map(widget => widget.y)).toEqual([10, 0, 20]);
  });

  it('finds the first free spot', () => {
    expect(firstFreePlacement(page().widgets, 12, 10)).toEqual({ x: 12, y: 0, w: 12, h: 10 });
    expect(firstFreePlacement(page().widgets, 24, 10)).toEqual({ x: 0, y: 60, w: 24, h: 10 });
    expect(firstFreePlacement([], 40, 5)).toEqual({ x: 0, y: 0, w: 24, h: 5 });
  });

  it('adds widgets at a free spot with their default width', () => {
    const widget = newWidgetInstance('calendar', {}, page());
    expect(widget).toMatchObject({ type: 'calendar', x: 12, y: 0, w: 6 });
    expect(insertWidget(page(), widget).widgets).toHaveLength(4);
    const spacer = newWidgetInstance('spacer');
    expect(spacer.settings).toEqual({ height: 120 });
    expect(spacer.w).toBe(24);
  });

  it('applies grid positions and records nothing when nothing moved', () => {
    const same = page();
    expect(applyPlacements(same, same.widgets)).toBe(same);
    const moved = applyPlacements(page(), [{ id: 'c', x: 12, y: 0, w: 12, h: 40 }, { id: 'ghost', x: 0, y: 0, w: 1, h: 1 }]);
    expect(byId(moved, 'c')).toMatchObject({ x: 12, y: 0, w: 12 });
    const clamped = applyPlacements(page(), [{ id: 'a', x: 22, y: -2, w: 5, h: 0 }]);
    expect(byId(clamped, 'a')).toMatchObject({ x: 22, y: 0, w: 2, h: 1 });
  });

  it('removes views, hides and orders widgets', () => {
    expect(removeWidget(page(), 'c').widgets.map(w => w.id)).toEqual(['a', 'b']);
    expect(setWidgetHidden(page(), 'a', true).widgets[0].hidden).toBe(true);
    expect(setWidgetHidden(setWidgetHidden(page(), 'a', true), 'a', false).widgets[0]).not.toHaveProperty('hidden');
    expect(widgetsInReadingOrder(page()).map(w => w.id)).toEqual(['a', 'b', 'c']);
  });

  it('allows the topology only once across pages', () => {
    const networks = buildOfficialPage('networks', { categories: [] });
    const other: Page = { ...page(), widgets: [] as WidgetInstance[] };
    expect(placementProblem({ pages: [networks] }, other, 'network-topology')).toBe('max-instances');
    expect(placementProblem(null, other, 'network-topology')).toBeNull();
    const restored = buildOfficialPage('networks', { categories: [], document: { pages: [{ ...networks, id: 'custom_map' }] } });
    expect(restored.widgets.some(w => w.type === 'network-topology')).toBe(false);
  });
});

describe('dropping a widget under another', () => {
  const upper = { id: 'upper', x: 0, y: 0, w: 6, h: 40 };
  it('settles below when its top edge lands in the lower half of the widget above', () => {
    const placed = pushOverlaps(settleBelow([upper, { id: 'moved', x: 0, y: 36, w: 6, h: 30 }], 'moved'), 'moved');
    expect(placed.find(item => item.id === 'upper')).toMatchObject({ y: 0 });
    expect(placed.find(item => item.id === 'moved')).toMatchObject({ y: 40 });
  });
  it('takes the place of the widget when dropped over its upper half', () => {
    const placed = pushOverlaps(settleBelow([upper, { id: 'moved', x: 0, y: 8, w: 6, h: 30 }], 'moved'), 'moved');
    expect(placed.find(item => item.id === 'moved')).toMatchObject({ y: 8 });
    expect(placed.find(item => item.id === 'upper')).toMatchObject({ y: 38 });
  });
  it('keeps settling below a stack of widgets', () => {
    const placed = settleBelow([upper, { id: 'second', x: 0, y: 40, w: 6, h: 20 }, { id: 'moved', x: 0, y: 30, w: 6, h: 10 }], 'moved');
    expect(placed.find(item => item.id === 'moved')).toMatchObject({ y: 40 });
  });
});
