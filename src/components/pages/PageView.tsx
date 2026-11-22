'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GridItemHTMLElement, GridStack, GridStackNode } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { List, Plus, Settings2, SquareStack, X } from 'lucide-react';
import { WidgetTitleContext } from '@/widgets/calme';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { applyPlacements, isHiddenOnMobile, mobileOrder, pushOverlaps, reflowHeights, removeWidget, settleBelow, snapWidth, widthFormats } from '@/lib/pages/operations';
import { MobileOrderEditor } from './MobileOrderEditor';
import { CalmeInfo } from '../modals/settings/shared/CalmeControls';
import { HEADER_WIDGET_TYPES, isLastRequiredWidget } from '@/lib/pages/header';
import { prepareSearchText, searchTerms, textMatches, widgetSearchText } from '@/lib/search/match';
import { MOBILE_QUERY } from '../layout/MobilePager';
import { GRID_COLUMNS, GRID_ROW_PX, type GridPlacement, type Page, type WidgetInstance } from '@/lib/pages/types';
import { moveService, readServiceDropTarget } from '@/lib/serviceMoves';
import type { Service } from '@/lib/types';
import { canViewWidget, getWidgetCatalogEntry } from '@/lib/widgets/catalog';
import { usePages } from '@/providers/PagesProvider';
import ServiceItem from '../tabs/home/ServiceItem';
import { DockerWorkspaceProvider } from '../widgets/docker/DockerWorkspace';
import { WidgetActionsSlotContext } from '../widgets/WidgetHeaderActions';
import { WidgetFitContext } from '../widgets/WidgetFit';
import { Emoji } from '../shared/Emoji';
import { PageWidgetContent } from './PageWidgetContent';

/** GridStack starts loading with this module, not once the page has rendered. */
const gridstackModule = typeof window === 'undefined' ? null : import('gridstack');

/**
 * A page is one free grid (GridStack). In edit mode a widget is dragged from
 * anywhere and stays where it is dropped. Its width is changed from its sides
 * or bottom corners and jumps between the formats of its type (`grid.sizes`),
 * so a widget is never shown at a width its content does not support; its
 * height always follows its content (no inner scrollbar).
 * Heights are measured continuously and the layout is reflowed around them
 * while keeping the stored vertical gaps (`reflowHeights`), so a widget that
 * grows pushes the ones below and they come back when it shrinks. Below
 * the editing width the page becomes one read-only column in reading order.
 */

export interface LibraryTarget {
  pageId: string;
}

interface PageViewProps {
  pageId: string;
  isVisible: boolean;
  searchQuery: string;
  showSensitive: boolean;
  showSecretSections: boolean;
  onToggleSecretSections: () => void;
  onOpenLibrary: (target: LibraryTarget) => void;
}

/** Grid width below which the page stacks in one column and cannot be edited. */
const EDITABLE_MIN_WIDTH = 700;
/** Grid width below which the page reads in two columns (tablets). */
const TABLET_MAX_WIDTH = 1000;
/** Gap between the two tablet columns and between widgets (px). */
const COMPACT_GAP = 16;
/** Grid gutter: half on each side of every widget, 16 px between widgets. */
const GRID_MARGIN = 8;

/** Controls inside widgets keep working: a widget drag never starts from them. */
const NO_WIDGET_DRAG = [
  'button', 'a', 'input', 'textarea', 'select', 'label', 'summary', '[contenteditable="true"]', '[role="slider"]',
  '[aria-roledescription="draggable"]', '[aria-roledescription="sortable"]', '[data-no-widget-drag]', '.nd-anchor-plus',
].join(',');

type InnerDrag = { kind: 'service'; service: Service } | { kind: 'device'; name: string };

/** Services and devices keep their own drag-and-drop inside widgets. */
const innerCollision: CollisionDetection = args => {
  const kind = args.active.data.current?.type;
  const allowed = args.droppableContainers.filter(container => {
    const type = container.data.current?.type;
    if (kind === 'service') return type === 'service-drop' || type === 'service-gap' || type === 'category-empty-drop';
    if (kind === 'device') return type === 'device' && container.data.current?.scope === args.active.data.current?.scope;
    return false;
  });
  const scoped = { ...args, droppableContainers: allowed };
  if (kind === 'device') return closestCenter(scoped);
  const hits = pointerWithin(scoped);
  return hits.length ? hits : rectIntersection(scoped);
};

export function useWidgetName() {
  const { t } = useI18n();
  const { config } = useConfig();
  return useCallback((widget: WidgetInstance) => {
    if (widget.type === 'service-category') {
      const category = config?.categories.find(candidate => candidate.id === widget.settings.categoryId);
      if (category) return t(category.title);
    }
    const entry = getWidgetCatalogEntry(widget.type);
    return entry ? t(entry.nameKey) : widget.type;
  }, [config?.categories, t]);
}

export function PageView(props: PageViewProps) {
  const { pageId, isVisible } = props;
  const { t } = useI18n();
  const { getPage, editing, applyToPage, startEditing } = usePages();
  const { user, config, saveCategories, reorderDevices } = useConfig();
  const page = getPage(pageId);
  const editMode = editing && user?.role === 'admin';
  const [innerDrag, setInnerDrag] = useState<InnerDrag | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  // The same widgets in view and edit mode: hidden widgets are shown again from
  // the library, secret categories only once secret sections are revealed.
  const shown = useMemo(() => (page?.widgets ?? []).filter(widget => {
    if (widget.hidden || !canViewWidget(user, widget.type)) return false;
    if (widget.type !== 'service-category' || props.showSecretSections) return true;
    return !config?.categories.find(category => category.id === widget.settings.categoryId)?.isSecret;
  }), [config?.categories, page?.widgets, props.showSecretSections, user]);

  const edit = useCallback((operation: (page: Page) => Page) => applyToPage(pageId, operation), [applyToPage, pageId]);

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === 'service') setInnerDrag({ kind: 'service', service: data.service as Service });
    else if (data?.type === 'device') {
      const device = config?.devices?.find(candidate => candidate.id === data.deviceId);
      setInnerDrag({ kind: 'device', name: device ? `${device.icon} ${device.name}` : '' });
    }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setInnerDrag(null);
    if (!over || !config) return;
    const source = active.data.current;
    const target = over.data.current;
    if (source?.type === 'service') {
      const drop = readServiceDropTarget(target);
      const next = drop ? moveService(config.categories, source.service.id, source.categoryId, drop) : null;
      if (next) void saveCategories(next);
      return;
    }
    if (source?.type === 'device' && target?.type === 'device' && config.devices) {
      const from = config.devices.findIndex(device => device.id === source.deviceId);
      const to = config.devices.findIndex(device => device.id === target.deviceId);
      if (from !== -1 && to !== -1 && from !== to) void reorderDevices(arrayMove(config.devices, from, to));
    }
  };

  if (!page) return null;
  const hasDocker = page.widgets.some(widget => !widget.hidden && getWidgetCatalogEntry(widget.type)?.linkGroup === 'docker');

  return (
    <DockerWorkspaceProvider enabled={isVisible && hasDocker} summaryOnPage={page.widgets.some(widget => !widget.hidden && widget.type === 'docker-summary')}>
      <DndContext sensors={sensors} collisionDetection={innerCollision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setInnerDrag(null)}>
        <div className={`nd-page ${editMode ? 'nd-page--editing' : ''}`} data-page-id={page.id}>
          {shown.length === 0 && (user?.role === 'admin' ? (
            // Where the first widget will go: the whole slot enters edit mode and opens the widget library.
            <button type="button" className="nd-page-empty-slot" onClick={() => { if (!editMode) startEditing(); props.onOpenLibrary({ pageId: page.id }); }}>
              <span className="nd-page-empty-plus" aria-hidden="true"><Plus size={16} /></span>
              <span className="nd-page-empty-title">{t('pages.column.addWidget')}</span>
              <span className="nd-page-empty-hint">{t('pages.empty.lead')}</span>
            </button>
          ) : <p className="nd-page-empty-viewer">{t('pages.empty.viewer')}</p>)}
          <PageGrid {...props} page={page} widgets={shown} editMode={editMode} edit={edit} />
        </div>
        <DragOverlay>
          {innerDrag?.kind === 'service' && (
            <div style={{ transform: 'scale(1.02)', boxShadow: '0 10px 20px rgba(0,0,0,0.2)', opacity: 0.9 }}>
              <ServiceItem service={innerDrag.service} editMode showSensitive={props.showSensitive} />
            </div>
          )}
          {innerDrag?.kind === 'device' && <div className="nd-page-drag-overlay"><span>{innerDrag.name}</span></div>}
        </DragOverlay>
      </DndContext>
    </DockerWorkspaceProvider>
  );
}

interface PageGridProps extends PageViewProps {
  page: Page;
  widgets: WidgetInstance[];
  editMode: boolean;
  edit: (operation: (page: Page) => Page) => void;
}

function PageGrid({ page, widgets, editMode, edit, ...props }: PageGridProps) {
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<GridStack | null>(null);
  const [ready, setReady] = useState(false);
  // Below the grid: phones read one column, tablets two, both in the page's
  // phone order (`page.mobile`), edited as a list.
  const [mode, setMode] = useState<'grid' | 'tablet' | 'phone'>('grid');
  const narrow = mode !== 'grid';
  const narrowRef = useRef(false);
  const [gridWidth, setGridWidth] = useState(0);
  // Rendered heights (px), for the two tablet columns.
  const [pxHeights, setPxHeights] = useState<Record<string, number>>({});
  const [columnPx, setColumnPx] = useState(0);
  // Widths (px) asked by widgets that fit their content (see WidgetFit).
  const [fitPx, setFitPx] = useState<Record<string, number>>({});
  // The grid is shown once the page is visible and its widgets are measured
  // and placed: no flash of unplaced widgets, no animation for that placement.
  const [revealed, setRevealed] = useState(false);
  const [gesture, setGesture] = useState(false);
  // Width and minimum height being chosen from a resize handle (not committed yet).
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [heightsAt, setHeightsAt] = useState(0);
  // Measured content heights, in rows.
  const [heights, setHeights] = useState<Record<string, number>>({});
  // Where the dragged widget will land, drawn instead of GridStack's own
  // placeholder (which refuses big jumps across widgets and lags behind).
  const [dropPreview, setDropPreview] = useState<GridPlacement | null>(null);
  const heightsRef = useRef(heights);
  useEffect(() => { heightsRef.current = heights; }, [heights]);
  const editRef = useRef(edit);
  useEffect(() => { editRef.current = edit; }, [edit]);
  const widgetsRef = useRef(widgets);
  useEffect(() => { widgetsRef.current = widgets; }, [widgets]);
  const unfitRef = useRef<(placements: ({ id: string } & GridPlacement)[]) => ({ id: string } & GridPlacement)[]>(placements => placements);
  // Phones: the phone header (title, search, menu) replaces the header widgets.
  const [phoneHeader, setPhoneHeader] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setPhoneHeader(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const hits = useSearchHits(root, props.searchQuery, !editMode, widgets);

  // Create the grid once; items are rendered by React and registered below.
  useEffect(() => {
    let disposed = false;
    let pressCleanup: (() => void) | undefined;
    void (gridstackModule ?? import('gridstack')).then(({ GridStack: Grid }) => {
      if (disposed || !root.current) return;
      const instance = Grid.init({
        cellHeight: GRID_ROW_PX,
        margin: GRID_MARGIN,
        float: true,
        animate: false,
        auto: false,
        staticGrid: true,
        // Always 24 columns: narrow screens are laid out by CSS (one column),
        // and a hidden page (0 px wide) must not switch the grid to one column.
        column: GRID_COLUMNS,
        draggable: { handle: '.grid-stack-item-content', cancel: NO_WIDGET_DRAG, scroll: true },
        // Widths are changed by the handles of WidgetFrame, in formats.
        disableResize: true,
      }, root.current);
      if (!instance) return;
      grid.current = instance;
      // Where the dragged widget is on screen, relative to the grid. A fast drag
      // gives GridStack a single big jump that it refuses when it crosses other
      // widgets; the widget is then dropped where it was released instead.
      let dropped: { id: string; left: number; top: number } | null = null;
      // Positions when the drag started: GridStack moves the other widgets
      // around while dragging, the drop is decided from the layout as it was.
      let before = new Map<string, { x: number; y: number }>();
      // GridStack only reports cell changes (none at all on a quick flick): the
      // widget's own position is read after each pointer move instead.
      let follow: ((event: MouseEvent | TouchEvent) => void) | null = null;
      const stopFollowing = () => {
        if (!follow) return;
        document.removeEventListener('mousemove', follow);
        document.removeEventListener('touchmove', follow);
        follow = null;
      };
      // The landing cell of the dragged widget, exactly as the drop decides it:
      // the other widgets where they were at the start, the dragged one at the
      // pointer, settled below a widget it mostly sits under.
      const landing = (release: { id: string; left: number; top: number }) => {
        const gridBox = root.current?.getBoundingClientRect();
        if (!gridBox?.width) return null;
        const placements = instance.engine.nodes.map((node: GridStackNode) => {
          const id = String(node.id);
          const start = id !== release.id ? before.get(id) : undefined;
          return { id, x: start?.x ?? node.x ?? 0, y: start?.y ?? node.y ?? 0, w: node.w ?? 1, h: heightsRef.current[id] ?? node.h ?? 1 };
        });
        const moved = placements.find(placement => placement.id === release.id);
        if (!moved) return null;
        const column = gridBox.width / GRID_COLUMNS;
        const x = Math.min(GRID_COLUMNS - moved.w, Math.max(0, Math.round(release.left / column)));
        const y = Math.max(0, Math.round(release.top / GRID_ROW_PX));
        return settleBelow(placements.map(placement => placement.id === moved.id ? { ...placement, x, y } : placement), moved.id);
      };
      let previewFrame = 0;
      // GridStack pushes the other widgets around while dragging, but the drop
      // keeps them where they were (pushed down only when overlapped): they are
      // held at those final places meanwhile, so what is shown is what you get.
      const unhold = () => {
        root.current?.querySelectorAll<HTMLElement>(':scope > .nd-page-item--held').forEach(item => {
          item.classList.remove('nd-page-item--held');
          item.style.removeProperty('--nd-hold-x');
          item.style.removeProperty('--nd-hold-y');
        });
      };
      const hold = (layout: ({ id: string } & GridPlacement)[], draggedId: string) => {
        for (const placement of layout) {
          if (placement.id === draggedId) continue;
          const item = root.current?.querySelector<HTMLElement>(`:scope > .grid-stack-item[gs-id="${CSS.escape(placement.id)}"]`);
          if (!item) continue;
          item.style.setProperty('--nd-hold-x', String(placement.x));
          item.style.setProperty('--nd-hold-y', String(placement.y));
          item.classList.add('nd-page-item--held');
        }
      };
      const commit = () => {
        stopFollowing();
        cancelAnimationFrame(previewFrame);
        setDropPreview(null);
        unhold();
        const release = dropped;
        dropped = null;
        // GridStack finishes moving the other widgets after the stop callback.
        queueMicrotask(() => {
          setGesture(false);
          if (disposed || instance.getColumn() !== GRID_COLUMNS) return;
          let placements = instance.engine.nodes.map((node: GridStackNode) => {
            const id = String(node.id);
            return { id, x: node.x ?? 0, y: node.y ?? 0, w: node.w ?? 1, h: heightsRef.current[id] ?? node.h ?? 1 };
          });
          const settled = release && landing(release);
          if (release && settled) placements = pushOverlaps(settled, release.id);
          editRef.current(current => applyPlacements(current, unfitRef.current(placements)));
        });
      };
      // Where the pointer grabbed the widget, taken on press: GridStack measures
      // its offset from the first move, so a quick flick would lag behind.
      let grab: { x: number; y: number; left: number; top: number } | null = null;
      const press = (event: PointerEvent) => {
        const item = (event.target as HTMLElement | null)?.closest<HTMLElement>('.grid-stack-item');
        if (!item || item.parentElement !== root.current) { grab = null; return; }
        const box = item.getBoundingClientRect();
        grab = { x: event.clientX, y: event.clientY, left: box.left, top: box.top };
      };
      const host = root.current;
      host.addEventListener('pointerdown', press, true);
      pressCleanup = () => host.removeEventListener('pointerdown', press, true);
      instance.on('dragstart', (_event: Event, el: GridItemHTMLElement) => {
        dropped = null;
        before = new Map(instance.engine.nodes.map((node: GridStackNode) => [String(node.id), { x: node.x ?? 0, y: node.y ?? 0 }]));
        setGesture(true);
        const id = String(el.gridstackNode?.id ?? el.getAttribute('gs-id'));
        const start = grab;
        const read = (event: MouseEvent | TouchEvent) => {
          const gridBox = root.current?.getBoundingClientRect();
          const point = 'touches' in event ? event.touches[0] : event;
          if (!gridBox || !start || !point) return;
          dropped = { id, left: start.left + (point.clientX - start.x) - gridBox.left, top: start.top + (point.clientY - start.y) - gridBox.top };
          cancelAnimationFrame(previewFrame);
          previewFrame = requestAnimationFrame(() => {
            const settled = dropped && landing(dropped);
            // As the page will show it: stored gaps kept around the measured heights.
            const layout = settled ? reflowHeights(pushOverlaps(settled, id), heightsRef.current) : null;
            const target = layout?.find(placement => placement.id === id);
            setDropPreview(target ? { x: target.x, y: target.y, w: target.w, h: target.h } : null);
            if (layout) hold(layout, id);
          });
        };
        follow = read;
        document.addEventListener('mousemove', read);
        document.addEventListener('touchmove', read);
      });
      instance.on('dragstop', commit);
      setReady(true);
    });
    return () => {
      disposed = true;
      pressCleanup?.();
      grid.current?.destroy(false);
      grid.current = null;
    };
  }, []);

  const measureWidth = useCallback((id: string, px: number) => {
    setFitPx(current => current[id] === px ? current : { ...current, [id]: px });
  }, []);

  // Widgets that fit their content take just the columns it needs at this
  // screen width, on the side they are aligned to; never more than stored.
  const fitted = useMemo(() => {
    const column = gridWidth / GRID_COLUMNS;
    if (!column) return widgets;
    return widgets.map(widget => {
      const px = fitPx[widget.id];
      if (!px) return widget;
      const w = Math.max(1, Math.ceil((px + GRID_MARGIN * 2) / column));
      if (w >= widget.w) return widget;
      return { ...widget, w, x: widget.x + fitShift(widget, widget.w - w) };
    });
  }, [fitPx, gridWidth, widgets]);
  const fittedRef = useRef(fitted);
  useEffect(() => { fittedRef.current = fitted; }, [fitted]);
  // What is saved keeps the stored width of those widgets, at the place shown.
  const unfit = useCallback((placements: ({ id: string } & GridPlacement)[]) => {
    const stored = new Map(widgetsRef.current.map(widget => [widget.id, widget]));
    const shown = new Map(fittedRef.current.map(widget => [widget.id, widget]));
    return placements.map(placement => {
      const widget = stored.get(placement.id);
      if (!widget || shown.get(placement.id)?.w === widget.w || placement.w >= widget.w) return placement;
      const x = placement.x - fitShift(widget, widget.w - placement.w);
      return { ...placement, w: widget.w, x: Math.max(0, Math.min(GRID_COLUMNS - widget.w, x)) };
    });
  }, []);
  useEffect(() => { unfitRef.current = unfit; }, [unfit]);

  const measure = useCallback((id: string, px: number) => {
    // A hidden page measures 0; narrow screens have other widths: keep the desktop heights.
    if (px < 1) return;
    setPxHeights(current => current[id] === Math.round(px) ? current : { ...current, [id]: Math.round(px) });
    if (narrowRef.current) return;
    const rows = Math.max(MIN_ROWS, Math.ceil((px + GRID_MARGIN * 2) / GRID_ROW_PX));
    setHeights(current => {
      if (current[id] === rows) return current;
      setHeightsAt(Date.now());
      return { ...current, [id]: rows };
    });
  }, []);

  // Stored positions, moved around the measured heights. While a width is
  // being chosen, the widget pushes the ones it now overlaps downwards; they
  // come back if it shrinks again before the handle is released.
  const displayed = useMemo(() => {
    const base = resize ? fitted.map(widget => widget.id === resize.id ? { ...widget, x: resize.x, w: resize.w } : widget) : fitted;
    const flowed = reflowHeights(base, heights);
    if (hits) return packSearchResults(flowed, hits);
    return resize ? pushOverlaps(flowed, resize.id) : flowed;
  }, [fitted, heights, hits, resize]);
  const displayedRef = useRef(displayed);
  useEffect(() => { displayedRef.current = displayed; }, [displayed]);

  /** Formats the widget can take at the current screen width, in columns. */
  const formatsOf = useCallback((widget: WidgetInstance) => {
    return [...new Set([...widthFormats(widget.type, columnPx, GRID_MARGIN * 2), widget.w])].sort((a, b) => a - b);
  }, [columnPx]);

  const startResize = useCallback((widget: WidgetInstance, edge: ResizeEdge, event: React.PointerEvent<HTMLElement>) => {
    const el = root.current;
    if (!el || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const column = el.getBoundingClientRect().width / GRID_COLUMNS;
    if (!column) return;
    const formats = formatsOf(widget);
    const right = widget.x + widget.w;
    const room = edge === 'e' ? GRID_COLUMNS - widget.x : right;
    const fitting = formats.filter(size => size <= room);
    const startX = event.clientX;
    let current: ResizeState = { id: widget.id, x: widget.x, w: widget.w };
    setResize(current);
    const move = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - startX) / column;
      const w = snapWidth(fitting.length ? fitting : [widget.w], widget.w + (edge === 'e' ? delta : -delta));
      const x = edge === 'e' ? widget.x : right - w;
      if (w === current.w && x === current.x) return;
      current = { id: widget.id, x, w };
      setResize(current);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      // Let the widget measure its height at the new width, then keep what is shown.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const placements = displayedRef.current;
        setResize(null);
        editRef.current(page => applyPlacements(page, unfit(placements)));
      }));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }, [formatsOf, unfit]);

  // Register new items, forget removed ones and apply the displayed layout.
  useLayoutEffect(() => {
    const instance = grid.current;
    const el = root.current;
    if (!ready || !instance || !el || gesture) return;
    instance.batchUpdate();
    for (const node of [...instance.engine.nodes]) {
      if (node.el && !node.el.isConnected) instance.removeWidget(node.el, false, false);
    }
    const full = instance.getColumn() === GRID_COLUMNS;
    const moves: { item: GridItemHTMLElement; widget: WidgetInstance }[] = [];
    for (const item of Array.from(el.children) as GridItemHTMLElement[]) {
      const widget = displayed.find(candidate => candidate.id === item.getAttribute('gs-id'));
      if (!widget) continue;
      // The grid never resizes widgets itself: widths come from the handles,
      // heights from the content.
      if (!item.gridstackNode) {
        instance.makeWidget(item, { id: widget.id, x: widget.x, y: widget.y, w: widget.w, h: widget.h, noResize: true, minH: widget.h, maxH: widget.h });
      } else if (full) {
        const node = item.gridstackNode;
        if (node.x !== widget.x || node.y !== widget.y || node.w !== widget.w || node.h !== widget.h) moves.push({ item, widget });
      }
    }
    instance.batchUpdate(false);
    // Park the moved widgets below the page first, so none of them collides
    // with another one that has not reached its place yet. Both steps happen
    // before the next paint: widgets animate straight to their new place.
    if (!moves.length) return;
    const bottom = (nodes: { y?: number; h?: number }[]) => nodes.reduce((max, node) => Math.max(max, (node.y ?? 0) + (node.h ?? 1)), 0);
    let offset = Math.max(bottom(instance.engine.nodes), bottom(displayed)) + 1;
    // One batch: GridStack otherwise recomputes (and lays out) the grid height
    // after every single move, which made entering edit mode stutter.
    instance.batchUpdate();
    for (const { item } of moves) {
      instance.update(item, { y: offset, noResize: true, minH: 1, maxH: undefined });
      offset += item.gridstackNode?.h ?? 1;
    }
    for (const { item, widget } of [...moves].sort((a, b) => a.widget.y - b.widget.y || a.widget.x - b.widget.x)) {
      instance.update(item, { x: widget.x, y: widget.y, w: widget.w, h: widget.h, noResize: true, minH: widget.h, maxH: widget.h });
    }
    instance.batchUpdate(false);
  }, [displayed, gesture, ready]);

  // First display: wait until the page is visible and every widget has been
  // measured and stopped growing (content loading), then show the placed grid
  // at once and only animate later changes.
  const { isVisible } = props;
  // When every widget had its first height: the grid is shown at most REVEAL_CAP_MS later, even if some
  // widgets are still loading their data (they grow in place, animated, instead of holding the whole page).
  const measuredAt = useRef(0);
  const visibleAt = useRef(0);
  useEffect(() => {
    if (revealed || !ready || !isVisible) return;
    const now = Date.now();
    if (!visibleAt.current) visibleAt.current = now;
    const measured = widgets.every(widget => heights[widget.id] !== undefined);
    if (measured && !measuredAt.current) measuredAt.current = now;
    // Fixed deadlines: a widget changing height again must not push the first display back.
    const delay = measured
      ? Math.min(Math.max(0, SETTLE_MS - (now - heightsAt)), Math.max(0, measuredAt.current + REVEAL_CAP_MS - now))
      : Math.max(0, visibleAt.current + SETTLE_MAX_MS - now);
    const timer = window.setTimeout(() => {
      requestAnimationFrame(() => {
        setRevealed(true);
        requestAnimationFrame(() => grid.current?.setAnimation(true));
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [heights, heightsAt, isVisible, ready, revealed, widgets]);

  // Editing needs the full grid; narrow screens stay read-only.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0;
      // A hidden page (display: none) keeps its layout.
      if (width < 1) return;
      narrowRef.current = width < TABLET_MAX_WIDTH;
      setMode(width < EDITABLE_MIN_WIDTH ? 'phone' : width < TABLET_MAX_WIDTH ? 'tablet' : 'grid');
      setGridWidth(width);
      setColumnPx(Math.round(width / GRID_COLUMNS));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const editable = editMode && !narrow;
  useEffect(() => {
    grid.current?.setStatic(!editable);
  }, [editable, ready]);

  // Switching modes shows or hides titles: measure every widget right after
  // that render and before the browser paints, so the grid is re-placed in the
  // same frame (otherwise one frame shows widgets overlapping, then the fix).
  useLayoutEffect(() => {
    const el = root.current;
    if (!ready || !el || narrowRef.current) return;
    const next = { ...heightsRef.current };
    let changed = false;
    el.querySelectorAll<HTMLElement>('.nd-page-widget[data-widget-id]').forEach(node => {
      const px = node.getBoundingClientRect().height;
      const id = node.dataset.widgetId;
      if (!id || px < 1) return;
      const rows = Math.max(MIN_ROWS, Math.ceil((px + GRID_MARGIN * 2) / GRID_ROW_PX));
      if (next[id] !== rows) { next[id] = rows; changed = true; }
    });
    if (changed) setHeights(next);
  }, [editable]); // eslint-disable-line react-hooks/exhaustive-deps

  // Entering or leaving edit mode shows or hides titles, so heights change and
  // widgets are re-placed. That happens instantly: animating it made widgets
  // slide over their neighbours before settling. Moves made by the user keep
  // their animation.
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) { firstMode.current = false; return; }
    const instance = grid.current;
    if (!instance || !revealed) return;
    instance.setAnimation(false);
    const timer = window.setTimeout(() => instance.setAnimation(true), 700);
    return () => window.clearTimeout(timer);
  }, [editMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phones and tablets: the page's phone order, without the widgets hidden there.
  const compactOrder = useMemo(() => mobileOrder({ widgets, mobile: page.mobile }), [page.mobile, widgets]);
  const readingOrder = useMemo(() => new Map(compactOrder.map((widget, index) => [widget.id, index])), [compactOrder]);
  // Tablets: two columns, each widget going into the shorter one, in order.
  const tablet = useMemo(() => {
    if (mode !== 'tablet' || !gridWidth) return null;
    // Above the phone width the header widgets keep their row at the top, at
    // their desktop proportions; on phones the phone header replaces them.
    const shownAt = new Map(fitted.map(widget => [widget.id, widget]));
    const header = phoneHeader ? [] : compactOrder.filter(widget => HEADER_WIDGET_TYPES.has(widget.type)).map(widget => shownAt.get(widget.id) ?? widget);
    const bandHeight = header.length ? Math.max(...header.map(widget => pxHeights[widget.id] ?? 0)) + COMPACT_GAP : 0;
    const bottoms = [bandHeight, bandHeight];
    const places = new Map<string, { column: number; top: number }>();
    const band = new Map(header.map(widget => [widget.id, { left: widget.x / GRID_COLUMNS, width: widget.w / GRID_COLUMNS }]));
    for (const widget of compactOrder) {
      if (HEADER_WIDGET_TYPES.has(widget.type)) continue;
      if (hits && !hits.has(widget.id)) continue;
      // Hidden ones stay in place (dimmed) while editing, so they can be shown again.
      if (isHiddenOnMobile(page, widget.id) && !editMode) continue;
      const column = bottoms[1] < bottoms[0] ? 1 : 0;
      places.set(widget.id, { column, top: bottoms[column] });
      bottoms[column] += (pxHeights[widget.id] ?? 0) + COMPACT_GAP;
    }
    return { places, band, height: Math.max(0, ...bottoms) };
  }, [compactOrder, editMode, fitted, gridWidth, hits, mode, page, phoneHeader, pxHeights]);
  // Phones and tablets in edit mode: the widgets with their controls (default),
  // or the compact list to reorder quickly.
  const [listView, setListView] = useState(false);
  const compactEdit = editMode && narrow;
  const nameOf = useWidgetName();
  const titleOf = useCallback((widget: WidgetInstance) => (typeof widget.settings.customTitle === 'string' && widget.settings.customTitle.trim()) || nameOf(widget), [nameOf]);

  return (
    <>
      {compactEdit && (
        <div className="nd-page-mobile-bar" role="group" aria-label={t('pages.mobile.title')}>
          <span className="nd-page-mobile-switch">
            <button type="button" aria-pressed={!listView} onClick={() => setListView(false)}><SquareStack size={14} aria-hidden="true" /> {t('pages.mobile.widgets')}</button>
            <button type="button" aria-pressed={listView} onClick={() => setListView(true)}><List size={14} aria-hidden="true" /> {t('pages.mobile.list')}</button>
            {/* Drawn inside the Order segment (a sibling, as a button holds no other control). */}
            <CalmeInfo text={t('pages.mobile.editNote')} />
          </span>
        </div>
      )}
      {compactEdit && listView && <MobileOrderEditor page={page} edit={edit} nameOf={titleOf} />}
      <div
        ref={root}
        className={`grid-stack nd-page-grid ${editable ? 'nd-page-grid--editing' : ''} ${narrow ? 'nd-page-grid--narrow' : ''} ${mode === 'tablet' ? 'nd-page-grid--tablet' : ''} ${compactEdit && listView ? 'nd-page-grid--reordering' : ''} ${compactEdit ? 'nd-page-grid--compact-editing' : ''} ${revealed ? 'nd-animate-in' : 'nd-page-grid--placing'} ${resize ? 'nd-page-grid--resizing' : ''}`}
        style={tablet ? { '--nd-tablet-height': `${tablet.height}px` } as React.CSSProperties : undefined}
      >
        {widgets.map(widget => (
          <div
            key={widget.id}
            className={`grid-stack-item ${resize?.id === widget.id ? 'nd-page-item--resizing' : ''} ${narrow && isHiddenOnMobile(page, widget.id) ? (compactEdit ? 'nd-page-item--mobile-dimmed' : 'nd-page-item--mobile-hidden') : ''} ${hits && !hits.has(widget.id) ? 'nd-page-item--filtered' : ''} ${tablet?.band.has(widget.id) ? 'nd-page-item--band' : ''} ${HEADER_WIDGET_TYPES.has(widget.type) ? 'nd-page-item--header' : ''}`}
            gs-id={widget.id}
            gs-x={widget.x}
            gs-y={widget.y}
            gs-w={widget.w}
            gs-h={widget.h}
            data-widget-type={widget.type}
            style={{
              order: readingOrder.get(widget.id),
              ...(tablet?.places.has(widget.id) ? { '--nd-tablet-column': tablet.places.get(widget.id)!.column, '--nd-tablet-top': `${tablet.places.get(widget.id)!.top}px` } : {}),
              ...(tablet?.band.has(widget.id) ? { '--nd-band-left': tablet.band.get(widget.id)!.left, '--nd-band-width': tablet.band.get(widget.id)!.width } : {}),
            } as React.CSSProperties}
          >
            <div className="grid-stack-item-content">
              <WidgetFrame
                {...props}
                page={page}
                widget={widget}
                editMode={editable || compactEdit}
                edit={edit}
                onMeasure={measure}
                onMeasureWidth={measureWidth}
                onResizeStart={editable ? (edge, event) => startResize(widget, edge, event) : undefined}
                canResizeWidth={editable && !getWidgetCatalogEntry(widget.type)?.fixedWidth && formatsOf(widget).length > 1}
              />
            </div>
          </div>
        ))}
        {dropPreview && (
          <div
            className="nd-page-drop-preview"
            aria-hidden="true"
            style={{
              left: `${(dropPreview.x / GRID_COLUMNS) * 100}%`,
              width: `${(dropPreview.w / GRID_COLUMNS) * 100}%`,
              top: dropPreview.y * GRID_ROW_PX,
              height: dropPreview.h * GRID_ROW_PX,
            }}
          />
        )}
      </div>
      {hits && widgets.every(widget => HEADER_WIDGET_TYPES.has(widget.type) || !hits.has(widget.id)) && widgets.some(widget => !HEADER_WIDGET_TYPES.has(widget.type)) && (
        <p className="nd-page-search-empty" role="status">{t('search.noResult', { query: props.searchQuery.trim() })}</p>
      )}
    </>
  );
}

/** Smallest widget height, in rows. */
const MIN_ROWS = 2;
type ResizeEdge = 'e' | 'w';
interface ResizeState { id: string; x: number; w: number }

/** Top and bottom edges resize from the side of the widget the pointer is closest to. */
function pointerSide(event: React.PointerEvent<HTMLElement>): ResizeEdge {
  const box = (event.currentTarget.parentElement ?? event.currentTarget).getBoundingClientRect();
  return event.clientX >= box.left + box.width / 2 ? 'e' : 'w';
}
/** First display: heights unchanged for this long… */
const SETTLE_MS = 60;
/** …or at most this long after the page became visible (a widget with nothing to show yet never reports a height). */
const SETTLE_MAX_MS = 150;
/** The longest the first display waits for widgets that keep growing (data still loading). */
const REVEAL_CAP_MS = 120;

/** Widgets without a title of their own get one in edit mode, like the others. Network tools has its section titles. */
const UNTITLED_TYPES = new Set([
  'docker-summary', 'docker-container-list', 'docker-explorer', 'network-topology', 'spacer',
]);
/** Widgets that have their own title in the Calme style. */
const CALME_TITLED_TYPES = new Set(['docker-summary']);

interface WidgetFrameProps extends PageViewProps {
  page: Page;
  widget: WidgetInstance;
  editMode: boolean;
  edit: (operation: (page: Page) => Page) => void;
  onMeasure: (widgetId: string, px: number) => void;
  /** Widgets that fit their content report the width it needs. */
  onMeasureWidth: (widgetId: string, px: number) => void;
  /** Starts choosing the width from a side (`e`, `w`). */
  onResizeStart?: (edge: ResizeEdge, event: React.PointerEvent<HTMLElement>) => void;
  /** More than one width format at this screen width. */
  canResizeWidth?: boolean;
}

/**
 * The widget itself. Its height is watched so the grid always fits it; in edit
 * mode its controls sit in its top-right corner, together with the header
 * buttons of the widget (`WidgetHeaderActions`).
 */
function WidgetFrame({ page, widget, editMode, edit, onMeasure, onMeasureWidth, onResizeStart, canResizeWidth, ...props }: WidgetFrameProps) {
  const { t } = useI18n();
  const { updateWidgetSettings } = usePages();
  const { setSettingsModal } = useConfig();
  const widgetName = useWidgetName();
  const ref = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLSpanElement | null>(null);
  const actions = useRef<HTMLDivElement>(null);
  const [actionsWidth, setActionsWidth] = useState(0);
  const entry = getWidgetCatalogEntry(widget.type);
  const name = widgetName(widget);
  const customTitle = typeof widget.settings.customTitle === 'string' ? widget.settings.customTitle : undefined;
  const showTitle = typeof widget.settings.showTitle === 'boolean' ? widget.settings.showTitle : undefined;
  const titleContext = useMemo(() => ({
    custom: customTitle,
    rename: (title: string) => updateWidgetSettings(page.id, widget.id, { customTitle: title }),
    visible: showTitle,
    setVisible: (visible: boolean) => updateWidgetSettings(page.id, widget.id, { showTitle: visible }),
  }), [customTitle, page.id, showTitle, updateWidgetSettings, widget.id]);
  const reportWidth = useCallback((px: number) => onMeasureWidth(widget.id, px), [onMeasureWidth, widget.id]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(entries => {
      const box = entries[0]?.borderBoxSize?.[0];
      onMeasure(widget.id, box ? box.blockSize : node.getBoundingClientRect().height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onMeasure, widget.id]);

  // Titles keep clear of the controls, whatever buttons the widget adds.
  useEffect(() => {
    const node = actions.current;
    if (!editMode || !node) return;
    const observer = new ResizeObserver(() => setActionsWidth(Math.ceil(node.getBoundingClientRect().width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [editMode]);

  // A category itself is edited from its own button (in the group); this one
  // opens the options shared by every category (pings, address or latency).
  const configure = entry?.settingsTab
    ? () => setSettingsModal({ open: true, targetTab: entry.settingsTab })
    : undefined;
  return (
    <div
      ref={ref}
      className={`nd-page-widget ${editMode ? 'nd-page-widget--editing' : ''}`}
      data-widget-id={widget.id}
      style={editMode ? { '--nd-page-actions-width': `${actionsWidth}px` } as React.CSSProperties : undefined}
    >
      {editMode && UNTITLED_TYPES.has(widget.type) && !CALME_TITLED_TYPES.has(widget.type) && (
        <div className="nd-page-widget-edit-title nd-section-title">
          <Emoji emoji={entry?.icon ?? '🧩'} /> {name}
        </div>
      )}
      <WidgetActionsSlotContext.Provider value={editMode ? slot : undefined}>
        <WidgetTitleContext.Provider value={titleContext}>
        <WidgetFitContext.Provider value={reportWidth}>
        <PageWidgetContent
          pageId={page.id}
          instance={widget}
          editMode={editMode}
          isVisible={props.isVisible}
          showSensitive={props.showSensitive}
          searchQuery={props.searchQuery}
          showSecretSections={props.showSecretSections}
          onToggleSecretSections={props.onToggleSecretSections}
          onUpdateSettings={settings => updateWidgetSettings(page.id, widget.id, settings)}
          onRemoveView={() => edit(current => removeWidget(current, widget.id))}
        />
        </WidgetFitContext.Provider>
        </WidgetTitleContext.Provider>
      </WidgetActionsSlotContext.Provider>
      {editMode && onResizeStart && canResizeWidth && (
        <>
          {/* Invisible areas all around (sides, top, bottom, corners): each one changes the
              width from its side of the widget; the height always follows the content. */}
          <span className="nd-page-resize nd-page-resize--e" data-no-widget-drag aria-hidden="true" onPointerDown={event => onResizeStart('e', event)} />
          <span className="nd-page-resize nd-page-resize--w" data-no-widget-drag aria-hidden="true" onPointerDown={event => onResizeStart('w', event)} />
          <span className="nd-page-resize nd-page-resize--n" data-no-widget-drag aria-hidden="true" onPointerDown={event => onResizeStart(pointerSide(event), event)} />
          <span className="nd-page-resize nd-page-resize--s" data-no-widget-drag aria-hidden="true" onPointerDown={event => onResizeStart(pointerSide(event), event)} />
          <span className="nd-page-resize nd-page-resize--se" data-no-widget-drag aria-hidden="true" onPointerDown={event => onResizeStart('e', event)} />
          <span className="nd-page-resize nd-page-resize--sw" data-no-widget-drag aria-hidden="true" onPointerDown={event => onResizeStart('w', event)} />
          <span className="nd-page-resize nd-page-resize--ne" data-no-widget-drag aria-hidden="true" onPointerDown={event => onResizeStart('e', event)} />
          <span className="nd-page-resize nd-page-resize--nw" data-no-widget-drag aria-hidden="true" onPointerDown={event => onResizeStart('w', event)} />
          <span className="nd-page-resize-mark" aria-hidden="true" />
        </>
      )}
      {editMode && (
        <div ref={actions} className="nd-page-widget-actions" data-no-widget-drag>
          <span ref={setSlot} className="nd-page-widget-actions-slot" />
          {configure && (
            <button type="button" className="nd-action-icon accent" onClick={configure} title={t('pages.widget.configureNamed', { name })} aria-label={t('pages.widget.configureNamed', { name })}>
              <Settings2 size={13} />
            </button>
          )}
          {/* The last menu and the last buttons of a page stay: without them the page would be a dead end. */}
          {!isLastRequiredWidget(page, widget.id) && (
            <button type="button" className="nd-action-icon danger" onClick={() => edit(current => removeWidget(current, widget.id))} title={t('pages.widget.removeNamed', { name })} aria-label={t('pages.widget.removeNamed', { name })}>
              <X size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * How far a widget that fits its content moves when it is `spare` columns
 * narrower than stored: it keeps the side it is aligned to (the end by default).
 */
function fitShift(widget: WidgetInstance, spare: number): number {
  const align = widget.settings.align;
  return align === 'start' ? 0 : align === 'center' ? Math.floor(spare / 2) : spare;
}

/**
 * Searching: the widgets whose content matches the query (all words, case,
 * accents and one typo forgiven, see src/lib/search/match.ts), or null when
 * nothing is searched. The header widgets always stay. Widgets update their
 * content (data arriving), so the result follows it.
 */
function useSearchHits(root: React.RefObject<HTMLDivElement | null>, query: string, enabled: boolean, widgets: WidgetInstance[]): Set<string> | null {
  const nameOf = useWidgetName();
  const terms = useMemo(() => searchTerms(query), [query]);
  const [hits, setHits] = useState<Set<string> | null>(null);
  const active = enabled && terms.length > 0;
  const names = useMemo(() => new Map(widgets.map(widget => [widget.id, [
    nameOf(widget),
    typeof widget.settings.customTitle === 'string' ? widget.settings.customTitle : '',
  ]])), [nameOf, widgets]);
  const typeOf = useMemo(() => new Map(widgets.map(widget => [widget.id, widget.type])), [widgets]);
  useEffect(() => {
    const element = root.current;
    if (!active || !element) { setHits(null); return; }
    let timer = 0;
    const compute = () => {
      const next = new Set<string>();
      element.querySelectorAll<HTMLElement>('.nd-page-widget[data-widget-id]').forEach(node => {
        const id = node.dataset.widgetId;
        if (!id) return;
        const type = typeOf.get(id);
        if (type && HEADER_WIDGET_TYPES.has(type)) { next.add(id); return; }
        if (textMatches(terms, prepareSearchText(widgetSearchText(node, names.get(id) ?? [])))) next.add(id);
      });
      setHits(current => current && current.size === next.size && [...next].every(id => current.has(id)) ? current : next);
    };
    compute();
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(compute, 250);
    });
    observer.observe(element, { subtree: true, childList: true, characterData: true });
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [active, names, root, terms, typeOf]);
  return active ? hits : null;
}

/**
 * Search results on the grid: the matching widgets keep their columns and
 * move up into the room left by the others, in reading order; the others are
 * parked below, out of sight and one row tall (they stay mounted so their
 * content is still searched).
 */
function packSearchResults<T extends GridPlacement & { id: string }>(widgets: T[], hits: Set<string>): T[] {
  const placed: T[] = [];
  const result = new Map<string, T>();
  for (const widget of [...widgets].filter(candidate => hits.has(candidate.id)).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const above = placed.filter(other => other.x < widget.x + widget.w && widget.x < other.x + other.w);
    const y = above.length ? Math.max(...above.map(other => other.y + other.h)) : 0;
    const next = y === widget.y ? widget : { ...widget, y };
    placed.push(next);
    result.set(widget.id, next);
  }
  let parked = placed.reduce((bottom, widget) => Math.max(bottom, widget.y + widget.h), 0) + 1;
  for (const widget of widgets) {
    if (result.has(widget.id)) continue;
    // One row each: hidden, they must not leave a tall empty page behind.
    result.set(widget.id, { ...widget, x: 0, y: parked, h: 1 });
    parked += 1;
  }
  return widgets.map(widget => result.get(widget.id)!);
}
