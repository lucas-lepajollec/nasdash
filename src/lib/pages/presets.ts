import type { Category } from '../types';
import { getWidgetCatalogEntry } from '../widgets/catalog';
import { sectionsToGrid, type SectionedColumn, type SectionedSection, type SectionedWidget } from './sectioned';
import type { Page, PagesDocument, PresetId, WidgetSettings } from './types';

/**
 * Official pages are ordinary pages produced by these factories. They use only
 * the primitives available to users, so any of them can be rebuilt by hand.
 */

export const OFFICIAL_PAGE_META: Record<PresetId, { name: string; icon: string; description: string }> = {
  dashboard: { name: 'Home', icon: '🏠', description: 'Services & monitoring' },
  docker: { name: 'Docker', icon: '🐳', description: 'Conteneurs & images' },
  networks: { name: 'Réseaux', icon: '📶', description: 'Cartographie & outils réseau' },
  widgets: { name: 'Widgets', icon: '🎛️', description: 'Grille de widgets fluide' },
};

export type PageTemplateId = 'blank' | PresetId;

export const PAGE_TEMPLATES: readonly PageTemplateId[] = ['blank', 'dashboard', 'docker', 'networks', 'widgets'];

interface Builder {
  widgets: SectionedWidget[];
  add: (type: string, settings?: WidgetSettings, id?: string) => string;
}

function builder(prefix: string): Builder {
  const widgets: SectionedWidget[] = [];
  let counter = 0;
  return {
    widgets,
    add(type, settings = {}, id) {
      const defaults = getWidgetCatalogEntry(type)?.defaultSettings ?? {};
      const widgetId = id ?? `${prefix}-${type}-${++counter}`;
      widgets.push({ id: widgetId, type, settings: { ...defaults, ...settings } });
      return widgetId;
    },
  };
}

function column(id: string, width: SectionedColumn['width'], arrangement: SectionedColumn['arrangement'], items: (string | null)[], extra: Partial<SectionedColumn> = {}): SectionedColumn {
  return { id, width, arrangement, items, ...extra };
}

function instanceCount(document: Pick<PagesDocument, 'pages'> | null, type: string, excludingPageId: string): number {
  if (!document) return 0;
  return document.pages
    .filter(page => page.id !== excludingPageId)
    .reduce((total, page) => total + page.widgets.filter(widget => widget.type === type).length, 0);
}

export interface PresetContext {
  categories: Category[];
  deviceCount?: number;
  /** Existing pages, to respect single-instance widgets when restoring a preset. */
  document?: Pick<PagesDocument, 'pages'> | null;
}

/** Arrangement of a template, expressed with the historical sections and columns. */
function buildSections(template: PageTemplateId, pageId: string, context: PresetContext): { preset?: PresetId; sections: SectionedSection[]; widgets: SectionedWidget[] } {
  const prefix = pageId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'page';
  const b = builder(prefix);
  const id = (suffix: string) => `${prefix}-${suffix}`;

  switch (template) {
    case 'blank':
      return { widgets: [], sections: [] };
    case 'dashboard': {
      const left = [b.add('clock'), b.add('devices')];
      const center = [...context.categories]
        .sort((a, c) => a.order - c.order)
        .map(category => b.add('service-category', { categoryId: category.id }, `${prefix}-cat-${category.id}`.slice(0, 128)));
      const right = [b.add('quickstats'), b.add('weather'), b.add('calendar')];
      const bottom = [b.add('networkgraph')];
      const footer = [b.add('service-ports')];
      return {
        preset: 'dashboard',
        widgets: b.widgets,
        sections: [
          {
            id: id('main'),
            columns: [
              column(id('left'), 'sidebar', 'stack', left, { sticky: true }),
              column(id('center'), 'fill', 'masonry', center, { maxColumns: 6 }),
              column(id('right'), 'sidebar', 'stack', right, { sticky: true }),
            ],
          },
          { id: id('bottom'), title: 'Activité réseau', columns: [column(id('bottom-grid'), 'fill', 'masonry', bottom, { maxColumns: 3 })] },
          { id: id('footer'), columns: [column(id('footer-column'), 'fill', 'stack', footer)] },
        ],
      };
    }
    case 'docker':
      return {
        preset: 'docker',
        sections: [{
          id: id('main'),
          columns: [
            column(id('panel'), 'panel', 'stack', [b.add('docker-hosts'), b.add('docker-summary'), b.add('docker-container-list')]),
            column(id('main-column'), 'fill', 'stack', [b.add('docker-explorer')]),
          ],
        }],
        widgets: b.widgets,
      };
    case 'networks': {
      const main = instanceCount(context.document ?? null, 'network-topology', pageId) === 0 ? [b.add('network-topology')] : [];
      return {
        preset: 'networks',
        sections: [{
          id: id('main'),
          columns: [
            column(id('panel'), 'panel', 'stack', [b.add('network-tools')], { sticky: true }),
            column(id('main-column'), 'fill', 'stack', main),
          ],
        }],
        widgets: b.widgets,
      };
    }
    case 'widgets':
      return {
        preset: 'widgets',
        sections: [{
          id: id('main'),
          columns: [column(id('grid'), 'fill', 'masonry', [
            b.add('devices'), b.add('quickstats'), b.add('clock'), b.add('weather'), b.add('calendar'), b.add('networkgraph'),
          ], { maxColumns: 5 })],
        }],
        widgets: b.widgets,
      };
  }
}

/** Widgets of a template for page `pageId`, placed on the grid. */
export function buildTemplate(template: PageTemplateId, pageId: string, context: PresetContext): Pick<Page, 'widgets' | 'preset'> {
  const built = buildSections(template, pageId, context);
  const widgets = sectionsToGrid(built.sections, built.widgets, { categories: context.categories, deviceCount: context.deviceCount ?? 1 });
  return { ...(built.preset ? { preset: built.preset } : {}), widgets };
}

export function buildOfficialPage(presetId: PresetId, context: PresetContext): Page {
  const meta = OFFICIAL_PAGE_META[presetId];
  return { id: presetId, name: meta.name, icon: meta.icon, description: meta.description, revision: 0, ...buildTemplate(presetId, presetId, context) };
}
