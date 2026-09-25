import type { Category, CustomTabColumn, CustomTabLayout, CustomTabRow, CustomTabWidgetInfo, DashboardConfig } from '../types';
import { getWidgetConfigKeys, WIDGET_REGISTRY } from '../widgetRegistry';
import { SPACER_HEIGHT } from '../widgets/catalog';
import { OFFICIAL_PAGE_META } from './presets';
import { sanitizeSettings } from './validation';
import { sectionsToGrid, type SectionedColumn as PageColumn, type SectionedSection as PageSection, type SectionedWidget as WidgetInstance, type SizingContext } from './sectioned';
import {
  PAGES_SCHEMA_VERSION,
  type Page as GridPage,
  type PagesDocument,
  type WidgetSettings,
} from './types';

/** A page arranged in the historical sections/columns, before grid placement. */
export interface SectionedPage extends Omit<GridPage, 'widgets'> {
  sections: PageSection[];
  widgets: WidgetInstance[];
}
type Page = SectionedPage;

/** Places a sectioned page on the free grid. */
export function sectionedPageToGrid(page: SectionedPage, context: SizingContext): GridPage {
  const { sections, widgets, ...rest } = page;
  return { ...rest, widgets: sectionsToGrid(sections, widgets, context) };
}

/**
 * Builds the universal pages from the historical configuration.
 *
 * - Read-only: the historical config and custom tab files are never modified,
 *   so an older NasDash version keeps working on the same data directory.
 * - Deterministic: the same input always produces the same ids.
 * - Lossless where it matters: hidden widgets stay on their page (hidden),
 *   props become instance settings, empty Home/Widgets slots are preserved.
 *   Anything that cannot be represented is reported in `notes`.
 */

interface LegacyTab {
  id: string;
  name?: string;
  icon?: string;
  description?: string;
}

export interface LegacyInput {
  config: DashboardConfig;
  categories: Category[];
  customTabs?: { tabs: LegacyTab[]; layouts: Record<string, CustomTabLayout> } | null;
}

type Settings = DashboardConfig['settings'] & Record<string, unknown>;

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_TYPE = /^[a-z0-9][a-z0-9-]{0,63}$/;

class PageBuilder {
  readonly widgets: WidgetInstance[] = [];
  private readonly ids = new Set<string>();
  private counter = 0;

  constructor(private readonly prefix: string, private readonly notes: string[]) {}

  uniqueId(candidate: string | undefined): string {
    let base = candidate && SAFE_ID.test(candidate) ? candidate : `${this.prefix}-w${++this.counter}`;
    if (base.length > 120) base = base.slice(0, 120);
    let id = base;
    let suffix = 2;
    while (this.ids.has(id)) id = `${base}-${suffix++}`;
    this.ids.add(id);
    return id;
  }

  add(type: string, settings: unknown, options: { id?: string; hidden?: boolean; context: string }): string | null {
    if (!SAFE_TYPE.test(type)) {
      this.notes.push(`${options.context}: widget type "${type}" is not supported and was not migrated.`);
      return null;
    }
    let safeSettings: WidgetSettings;
    try {
      safeSettings = sanitizeSettings(settings ?? {}, options.context);
    } catch {
      this.notes.push(`${options.context}: settings of "${type}" were invalid and were reset.`);
      safeSettings = {};
    }
    const id = this.uniqueId(options.id);
    this.widgets.push({ id, type, ...(options.hidden ? { hidden: true } : {}), settings: safeSettings });
    return id;
  }
}

function isGloballyHidden(settings: Settings, type: string): boolean {
  const definition = WIDGET_REGISTRY.find(entry => entry.id === type);
  if (!definition) return false;
  const value = settings[getWidgetConfigKeys(type).hide];
  return typeof value === 'boolean' ? value : definition.defaultHidden;
}

function spacerSettings(height: unknown, props: unknown): WidgetSettings {
  const base = props && typeof props === 'object' && !Array.isArray(props) ? { ...(props as Record<string, unknown>) } : {};
  const numeric = typeof height === 'number' && Number.isFinite(height) ? height : SPACER_HEIGHT.default;
  return { ...(base as WidgetSettings), height: Math.round(Math.max(SPACER_HEIGHT.min, Math.min(SPACER_HEIGHT.max, numeric))) };
}

function panelWidgets(settings: Settings, panelId: string) {
  const panel = settings.panels?.[panelId];
  return Array.isArray(panel?.widgets) ? panel.widgets : [];
}

function addPanelWidgets(builder: PageBuilder, settings: Settings, panelId: string, forceHidden: boolean): string[] {
  return panelWidgets(settings, panelId).flatMap(widget => {
    if (!widget || typeof widget.type !== 'string') return [];
    const id = builder.add(widget.type, widget.props, {
      id: typeof widget.id === 'string' ? widget.id : undefined,
      hidden: forceHidden || isGloballyHidden(settings, widget.type),
      context: `panel ${panelId}`,
    });
    return id ? [id] : [];
  });
}

function trimEmpty(items: (string | null)[]): (string | null)[] {
  const result = [...items];
  while (result.length && result[result.length - 1] === null) result.pop();
  return result;
}

// ---- Home ------------------------------------------------------------------

function migrateHome(input: LegacyInput, notes: string[]): Page {
  const settings = input.config.settings as Settings;
  const tabConf = settings.tabs?.home ?? {};
  const builder = new PageBuilder('home', notes);

  const leftItems = addPanelWidgets(builder, settings, 'home-left', tabConf.hideLeftSidebar === true);
  const rightItems = addPanelWidgets(builder, settings, 'home-right', tabConf.hideRightSidebar === true);

  // Central slots: categories and Home widgets share one ordered slot list.
  const slotted: { order: number; id: string }[] = [];
  for (const category of [...input.categories].sort((a, b) => a.order - b.order)) {
    const id = builder.add('service-category', { categoryId: category.id }, {
      id: `home-cat-${category.id}`,
      context: `category ${category.id}`,
    });
    if (id) slotted.push({ order: Number.isInteger(category.order) ? category.order : Number.MAX_SAFE_INTEGER, id });
  }
  for (const widget of settings.homeWidgets ?? []) {
    if (!widget || typeof widget.type !== 'string') continue;
    const isSpacer = widget.type === 'spacer';
    const id = builder.add(widget.type, isSpacer ? spacerSettings(widget.height, widget.props) : widget.props, {
      id: typeof widget.id === 'string' ? widget.id : undefined,
      hidden: !isSpacer && isGloballyHidden(settings, widget.type),
      context: `home widget ${widget.id}`,
    });
    if (id) slotted.push({ order: Number.isInteger(widget.order) ? widget.order : Number.MAX_SAFE_INTEGER, id });
  }
  const centerItems: (string | null)[] = [];
  const overflow: string[] = [];
  for (const entry of slotted.sort((a, b) => a.order - b.order)) {
    if (entry.order >= 0 && entry.order < 10_000 && centerItems[entry.order] === undefined) {
      while (centerItems.length < entry.order) centerItems.push(null);
      centerItems[entry.order] = entry.id;
    } else {
      overflow.push(entry.id);
    }
  }
  for (let index = 0; index < centerItems.length; index++) if (centerItems[index] === undefined) centerItems[index] = null;
  if (overflow.length) notes.push(`Home: ${overflow.length} item(s) shared a slot and were placed at the end of the grid.`);

  const left: PageColumn = { id: 'home-left', width: 'sidebar', arrangement: 'stack', sticky: true, items: leftItems };
  const right: PageColumn = { id: 'home-right', width: 'sidebar', arrangement: 'stack', sticky: true, items: rightItems };
  const before: PageColumn[] = [];
  const after: PageColumn[] = [];
  // Same placement rules as the historical Home grid. Empty side columns are
  // kept: they collapse outside edit mode and remain familiar drop zones.
  ((tabConf.leftSidebarPosition || 'left') === 'left' ? before : after).push(left);
  ((tabConf.rightSidebarPosition || 'right') === 'left' ? before : after).push(right);
  const mainColumns: PageColumn[] = [
    ...before,
    { id: 'home-center', width: 'fill', arrangement: 'masonry', maxColumns: 6, items: trimEmpty([...centerItems, ...overflow]) },
    ...after,
  ];

  const sections: PageSection[] = [{ id: 'home-main', columns: mainColumns }];
  const bottomItems = addPanelWidgets(builder, settings, 'home-bottom', tabConf.hideBottomPanel === true);
  const bottomTitle = tabConf.bottomPanelTitle ?? 'Activité réseau';
  sections.push({
    id: 'home-bottom',
    ...(bottomTitle.trim() ? { title: bottomTitle } : {}),
    columns: [{ id: 'home-bottom-grid', width: 'fill', arrangement: 'masonry', maxColumns: Math.max(1, Math.min(6, bottomItems.length || 3)), items: bottomItems }],
  });
  const ports = builder.add('service-ports', {}, { id: 'home-service-ports', context: 'home footer' });
  sections.push({ id: 'home-footer', columns: [{ id: 'home-footer-column', width: 'fill', arrangement: 'stack', items: ports ? [ports] : [] }] });

  const meta = OFFICIAL_PAGE_META.dashboard;
  return { id: 'dashboard', name: meta.name, icon: meta.icon, description: meta.description, preset: 'dashboard', revision: 1, sections, widgets: builder.widgets };
}

// ---- Docker / Networks -------------------------------------------------------

function sidePageColumns(
  panel: PageColumn,
  main: PageColumn,
  widgets: PageColumn | null,
  panelPos: 'left' | 'right',
  widgetsPos: 'left' | 'right',
): PageColumn[] {
  // Mirrors the historical flex ordering of the three blocks.
  if (!widgets) return panelPos === 'left' ? [panel, main] : [main, panel];
  if (panelPos === 'left' && widgetsPos === 'right') return [panel, main, widgets];
  if (panelPos === 'right' && widgetsPos === 'left') return [widgets, main, panel];
  if (panelPos === 'left' && widgetsPos === 'left') return [widgets, panel, main];
  return [main, widgets, panel];
}

function migrateDocker(input: LegacyInput, notes: string[]): Page {
  const settings = input.config.settings as Settings;
  const tabConf = settings.tabs?.docker ?? {};
  const builder = new PageBuilder('docker', notes);
  const panelItems = ['docker-hosts', 'docker-summary', 'docker-container-list']
    .map(type => builder.add(type, {}, { id: `docker-${type.replace('docker-', '')}`, context: 'docker page' }))
    .filter((id): id is string => id !== null);
  const explorer = builder.add('docker-explorer', {}, { id: 'docker-explorer', context: 'docker page' });
  const sidebarHidden = tabConf.hideWidgetsSidebar ?? true;
  const extraItems = addPanelWidgets(builder, settings, 'docker-widgets', sidebarHidden);
  const widgetsColumn: PageColumn | null = extraItems.length
    ? { id: 'docker-widgets', width: 'sidebar', arrangement: 'stack', sticky: true, mobileOrder: 99, items: extraItems }
    : null;
  const columns = sidePageColumns(
    { id: 'docker-panel', width: 'panel', arrangement: 'stack', items: panelItems },
    { id: 'docker-main', width: 'fill', arrangement: 'stack', items: explorer ? [explorer] : [] },
    widgetsColumn,
    tabConf.dockerPanelPosition || 'left',
    tabConf.widgetsSidebarPosition || 'right',
  );
  const meta = OFFICIAL_PAGE_META.docker;
  return { id: 'docker', name: meta.name, icon: meta.icon, description: meta.description, preset: 'docker', revision: 1, sections: [{ id: 'docker-section', columns }], widgets: builder.widgets };
}

function migrateNetworks(input: LegacyInput, notes: string[]): Page {
  const settings = input.config.settings as Settings;
  const tabConf = settings.tabs?.networks ?? {};
  const builder = new PageBuilder('networks', notes);
  const tools = builder.add('network-tools', {}, { id: 'networks-tools', context: 'networks page' });
  const topology = builder.add('network-topology', {}, { id: 'networks-topology', context: 'networks page' });
  const sidebarHidden = tabConf.hideWidgetsSidebar ?? true;
  const extraItems = addPanelWidgets(builder, settings, 'networks-widgets', sidebarHidden);
  const widgetsColumn: PageColumn | null = extraItems.length
    ? { id: 'networks-widgets', width: 'sidebar', arrangement: 'stack', sticky: true, mobileOrder: 99, items: extraItems }
    : null;
  const columns = sidePageColumns(
    { id: 'networks-panel', width: 'panel', arrangement: 'stack', sticky: true, items: tools ? [tools] : [] },
    { id: 'networks-main', width: 'fill', arrangement: 'stack', items: topology ? [topology] : [] },
    widgetsColumn,
    tabConf.networksPanelPosition || 'left',
    tabConf.widgetsSidebarPosition || 'right',
  );
  const meta = OFFICIAL_PAGE_META.networks;
  return { id: 'networks', name: meta.name, icon: meta.icon, description: meta.description, preset: 'networks', revision: 1, sections: [{ id: 'networks-section', columns }], widgets: builder.widgets };
}

// ---- Widgets page ------------------------------------------------------------

function migrateWidgetsPage(input: LegacyInput, notes: string[]): Page {
  const settings = input.config.settings as Settings;
  const tabConf = (settings.tabs?.widgets ?? {}) as Record<string, unknown>;
  const builder = new PageBuilder('widgets', notes);
  const instanceIds = new Map<string, string>();

  for (const definition of WIDGET_REGISTRY) {
    const hideKey = getWidgetConfigKeys(definition.id).hide;
    const hidden = isGloballyHidden(settings, definition.id) || tabConf[hideKey] === true;
    const props = settings[`widgets-${definition.id}Props`] ?? settings[`${definition.id}Props`];
    const id = builder.add(definition.id, props, { id: `widgets-${definition.id}`, hidden, context: `widgets page ${definition.id}` });
    if (id) instanceIds.set(definition.id, id);
  }

  // Historical slots: ids of registry widgets or `empty-*` placeholders.
  const order = Array.isArray(settings.widgetsOrder) ? settings.widgetsOrder : [];
  const items: (string | null)[] = [];
  const placed = new Set<string>();
  for (const entry of order) {
    if (typeof entry !== 'string') continue;
    const id = instanceIds.get(entry);
    if (id && !placed.has(id)) {
      items.push(id);
      placed.add(id);
    } else {
      items.push(null);
    }
  }
  // Widgets the old page would have auto-placed go into the first empty slots.
  for (const [, id] of instanceIds) {
    if (placed.has(id)) continue;
    const widget = builder.widgets.find(candidate => candidate.id === id)!;
    const empty = widget.hidden ? -1 : items.indexOf(null);
    if (empty !== -1) items[empty] = id;
    else items.push(id);
    placed.add(id);
  }
  const meta = OFFICIAL_PAGE_META.widgets;
  return {
    id: 'widgets', name: meta.name, icon: meta.icon, description: meta.description, preset: 'widgets', revision: 1,
    sections: [{ id: 'widgets-section', columns: [{ id: 'widgets-grid', width: 'fill', arrangement: 'masonry', maxColumns: 5, items: trimEmpty(items) }] }],
    widgets: builder.widgets,
  };
}

// ---- Custom tabs -------------------------------------------------------------

function percent(width: unknown): number {
  const value = typeof width === 'string' ? Number.parseFloat(width) : Number.NaN;
  return Number.isFinite(value) && value >= 10 && value <= 100 ? Math.round(value * 100) / 100 : 100;
}

function migrateCustomTab(tab: LegacyTab, layout: CustomTabLayout | undefined, settings: Settings, notes: string[]): Page | null {
  if (!SAFE_ID.test(tab.id)) {
    notes.push(`Custom tab "${tab.name ?? tab.id}" has an unsupported id and was not migrated.`);
    return null;
  }
  const builder = new PageBuilder(tab.id.slice(0, 48), notes);
  const sections: PageSection[] = [];
  let sectionCounter = 0;

  const addWidget = (info: CustomTabWidgetInfo, context: string): string | null => {
    if (!info || typeof info.type !== 'string') return null;
    if (info.type === 'spacer') return builder.add('spacer', spacerSettings(info.height, info.props), { context });
    const known = WIDGET_REGISTRY.some(entry => entry.id === info.type);
    // Unknown types were silently skipped by the old renderer; keep them hidden.
    return builder.add(info.type, info.props, { hidden: !known || isGloballyHidden(settings, info.type), context });
  };

  const visitRow = (row: CustomTabRow, depth: number) => {
    if (!row || !Array.isArray(row.columns) || depth > 8) return;
    const nested: CustomTabRow[] = [];
    const columns: PageColumn[] = row.columns.slice(0, 6).map((legacyColumn: CustomTabColumn, index) => {
      const widgets = Array.isArray(legacyColumn.widgets)
        ? legacyColumn.widgets
        : legacyColumn.content && !('columns' in legacyColumn.content) ? [legacyColumn.content as CustomTabWidgetInfo] : [];
      if (legacyColumn.content && 'columns' in legacyColumn.content) nested.push(legacyColumn.content as CustomTabRow);
      const items = widgets
        .map((widget, widgetIndex) => addWidget(widget, `custom tab ${tab.id} row ${row.id} column ${index} widget ${widgetIndex}`))
        .filter((id): id is string => id !== null);
      const columnId = builder.uniqueId(SAFE_ID.test(legacyColumn.id) ? `col-${legacyColumn.id}`.slice(0, 120) : undefined);
      return { id: columnId, width: row.columns.length === 1 ? 'fill' : percent(legacyColumn.width), arrangement: 'stack', items };
    });
    if (row.columns.length > 6) notes.push(`Custom tab "${tab.name ?? tab.id}": columns beyond the sixth were not migrated.`);
    if (columns.length) {
      const sectionId = builder.uniqueId(SAFE_ID.test(row.id) ? `row-${row.id}`.slice(0, 120) : `${tab.id.slice(0, 40)}-s${++sectionCounter}`);
      sections.push({ id: sectionId, columns });
    }
    if (nested.length) {
      notes.push(`Custom tab "${tab.name ?? tab.id}": a nested row became its own section below its parent.`);
      nested.forEach(child => visitRow(child, depth + 1));
    }
  };
  (layout?.rows ?? []).forEach(row => visitRow(row, 0));
  if (!sections.length) {
    sections.push({ id: `${tab.id.slice(0, 100)}-s1`, columns: [{ id: `${tab.id.slice(0, 100)}-c1`, width: 'fill', arrangement: 'stack', items: [] }] });
  }
  return {
    id: tab.id,
    name: (tab.name || 'Nouvel Onglet').slice(0, 100),
    icon: (tab.icon || '📝').slice(0, 64),
    ...(tab.description ? { description: tab.description.slice(0, 500) } : {}),
    revision: 1,
    sections,
    widgets: builder.widgets,
  };
}

export function migrateLegacyPages(input: LegacyInput, now = new Date()): PagesDocument {
  const notes: string[] = [];
  const settings = input.config.settings as Settings;
  const pages: Page[] = [
    migrateHome(input, notes),
    migrateDocker(input, notes),
    migrateNetworks(input, notes),
    migrateWidgetsPage(input, notes),
  ];
  // Dock icon overrides become the pages' own icons.
  const icons = settings.tabIcons ?? {};
  for (const page of pages) {
    if (typeof icons[page.id] === 'string' && icons[page.id].length <= 64) page.icon = icons[page.id];
  }
  const known = new Set(pages.map(page => page.id));
  for (const tab of input.customTabs?.tabs ?? []) {
    if (!tab || typeof tab.id !== 'string' || known.has(tab.id)) continue;
    const page = migrateCustomTab(tab, input.customTabs?.layouts?.[tab.id], settings, notes);
    if (page) {
      if (typeof icons[page.id] === 'string' && icons[page.id].length <= 64) page.icon = icons[page.id];
      pages.push(page);
      known.add(page.id);
    }
  }
  const context: SizingContext = { categories: input.categories, deviceCount: input.config.devices?.length ?? 1 };
  return {
    schemaVersion: PAGES_SCHEMA_VERSION,
    pages: pages.map(page => sectionedPageToGrid(page, context)),
    migration: { from: 'legacy', at: now.toISOString(), notes },
  };
}
