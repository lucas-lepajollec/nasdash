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
import { Plus, Settings2, X } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { applyPlacements, pushOverlaps, reflowHeights, removeWidget, settleBelow, snapWidth, widgetsInReadingOrder, widthFormats } from '@/lib/pages/operations';
import { GRID_COLUMNS, GRID_ROW_PX, type Page, type WidgetInstance } from '@/lib/pages/types';
import { moveService, readServiceDropTarget } from '@/lib/serviceMoves';
import type { Service } from '@/lib/types';
import { canViewWidget, getWidgetCatalogEntry } from '@/lib/widgets/catalog';
import { usePages } from '@/providers/PagesProvider';
import ServiceItem from '../tabs/home/ServiceItem';
import { DockerWorkspaceProvider } from '../widgets/docker/DockerWorkspace';
import { WidgetActionsSlotContext } from '../widgets/WidgetHeaderActions';
import { Emoji } from '../shared/Emoji';
import { PageWidgetContent } from './PageWidgetContent';
import { useCalme } from '@/widgets/calme';

/**
 * A page is one free grid (GridStack). In edit mode a widget is dragged from
 * anywhere and stays where it is dropped. Its width is changed from its sides
 * or bottom corners and jumps between the formats of its type (`grid.sizes`),
 * so a widget is never shown at a width its content does not support; its
 * height always follows its content (no inner scrollbar).
 * Heights are measured continuously and the layout is reflowed around them
 * while keeping the stored vertical gaps (`reflowHeights`), so titles shown in
 * edit mode push widgets down and leaving edit mode brings them back. Below
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
  const { getPage, editing, applyToPage } = usePages();
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
    <DockerWorkspaceProvider enabled={isVisible && hasDocker}>
      <DndContext sensors={sensors} collisionDetection={innerCollision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setInnerDrag(null)}>
        <div className={`nd-page ${editMode ? 'nd-page--editing' : ''}`} data-page-id={page.id}>
          {shown.length === 0 && (
            <div className="nd-page-empty">
              <p>{t('pages.empty.title')}</p>
              {editMode ? (
                <button type="button" className="nd-btn nd-btn-accent" onClick={() => props.onOpenLibrary({ pageId: page.id })}>
                  <Plus size={14} /> {t('pages.column.addWidget')}
                </button>
              ) : user?.role === 'admin' && <p className="nd-page-empty-hint">{t('pages.empty.hint')}</p>}
            </div>
          )}
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
  const [narrow, setNarrow] = useState(false);
  const narrowRef = useRef(false);
  const [columnPx, setColumnPx] = useState(0);
  // The grid is shown once the page is visible and its widgets are measured
  // and placed: no flash of unplaced widgets, no animation for that placement.
  const [revealed, setRevealed] = useState(false);
  const [gesture, setGesture] = useState(false);
  // Width and minimum height being chosen from a resize handle (not committed yet).
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [heightsAt, setHeightsAt] = useState(0);
  // Measured content heights, in rows.
  const [heights, setHeights] = useState<Record<string, number>>({});
  const heightsRef = useRef(heights);
  useEffect(() => { heightsRef.current = heights; }, [heights]);
  const editRef = useRef(edit);
  useEffect(() => { editRef.current = edit; }, [edit]);

  // Create the grid once; items are rendered by React and registered below.
  useEffect(() => {
    let disposed = false;
    let pressCleanup: (() => void) | undefined;
    void import('gridstack').then(({ GridStack: Grid }) => {
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
      const commit = () => {
        stopFollowing();
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
          const gridBox = root.current?.getBoundingClientRect();
          const moved = release && placements.find(placement => placement.id === release.id);
          if (moved && gridBox?.width) {
            placements = placements.map(placement => {
              const start = placement.id !== moved.id ? before.get(placement.id) : undefined;
              return start ? { ...placement, ...start } : placement;
            });
            const column = gridBox.width / GRID_COLUMNS;
            const x = Math.min(GRID_COLUMNS - moved.w, Math.max(0, Math.round(release.left / column)));
            const y = Math.max(0, Math.round(release.top / GRID_ROW_PX));
            placements = pushOverlaps(settleBelow(placements.map(placement => placement.id === moved.id ? { ...placement, x, y } : placement), moved.id), moved.id);
          }
          editRef.current(current => applyPlacements(current, placements));
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

  const measure = useCallback((id: string, px: number) => {
    // A hidden page measures 0; narrow screens have other widths: keep the desktop heights.
    if (px < 1 || narrowRef.current) return;
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
    const base = resize ? widgets.map(widget => widget.id === resize.id ? { ...widget, x: resize.x, w: resize.w } : widget) : widgets;
    const flowed = reflowHeights(base, heights);
    return resize ? pushOverlaps(flowed, resize.id) : flowed;
  }, [heights, resize, widgets]);
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
        editRef.current(page => applyPlacements(page, placements));
      }));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }, [formatsOf]);

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
  useEffect(() => {
    if (revealed || !ready || !isVisible) return;
    const measured = widgets.every(widget => heights[widget.id] !== undefined);
    const since = Date.now() - heightsAt;
    const delay = measured ? Math.max(0, SETTLE_MS - since) : SETTLE_MAX_MS;
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
      narrowRef.current = width < EDITABLE_MIN_WIDTH;
      setNarrow(narrowRef.current);
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

  // One column on narrow screens: reading order, heights follow the content.
  const readingOrder = useMemo(() => new Map(widgetsInReadingOrder({ widgets }).map((widget, index) => [widget.id, index])), [widgets]);

  return (
    <>
      {editMode && narrow && <p className="nd-page-narrow-note">{t('pages.editor.narrow')}</p>}
      <div ref={root} className={`grid-stack nd-page-grid ${editable ? 'nd-page-grid--editing' : ''} ${narrow ? 'nd-page-grid--narrow' : ''} ${revealed ? 'nd-animate-in' : 'nd-page-grid--placing'} ${resize ? 'nd-page-grid--resizing' : ''}`}>
        {widgets.map(widget => (
          <div
            key={widget.id}
            className={`grid-stack-item ${resize?.id === widget.id ? 'nd-page-item--resizing' : ''}`}
            gs-id={widget.id}
            gs-x={widget.x}
            gs-y={widget.y}
            gs-w={widget.w}
            gs-h={widget.h}
            data-widget-type={widget.type}
            style={{ order: readingOrder.get(widget.id) }}
          >
            <div className="grid-stack-item-content">
              <WidgetFrame
                {...props}
                page={page}
                widget={widget}
                editMode={editable}
                edit={edit}
                onMeasure={measure}
                onResizeStart={(edge, event) => startResize(widget, edge, event)}
                canResizeWidth={formatsOf(widget).length > 1}
              />
            </div>
          </div>
        ))}
      </div>
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
/** …or at most this long after the page became visible. */
const SETTLE_MAX_MS = 300;

/** Widgets without a title of their own get one in edit mode, like the others. */
const UNTITLED_TYPES = new Set([
  'docker-summary', 'docker-container-list', 'docker-explorer', 'network-tools', 'network-topology', 'spacer',
]);
/** Widgets that have their own title in the Calme style. */
const CALME_TITLED_TYPES = new Set(['docker-summary']);

interface WidgetFrameProps extends PageViewProps {
  page: Page;
  widget: WidgetInstance;
  editMode: boolean;
  edit: (operation: (page: Page) => Page) => void;
  onMeasure: (widgetId: string, px: number) => void;
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
function WidgetFrame({ page, widget, editMode, edit, onMeasure, onResizeStart, canResizeWidth, ...props }: WidgetFrameProps) {
  const { t } = useI18n();
  const { updateWidgetSettings } = usePages();
  const { setSettingsModal } = useConfig();
  const widgetName = useWidgetName();
  const calme = useCalme();
  const ref = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLSpanElement | null>(null);
  const actions = useRef<HTMLDivElement>(null);
  const [actionsWidth, setActionsWidth] = useState(0);
  const entry = getWidgetCatalogEntry(widget.type);
  const name = widgetName(widget);

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

  // Categories are configured from their own edit button (in the group).
  const configure = widget.type !== 'service-category' && entry?.settingsTab
    ? () => setSettingsModal({ open: true, targetTab: entry.settingsTab })
    : undefined;
  return (
    <div
      ref={ref}
      className={`nd-page-widget ${editMode ? 'nd-page-widget--editing' : ''}`}
      data-widget-id={widget.id}
      style={editMode ? { '--nd-page-actions-width': `${actionsWidth}px` } as React.CSSProperties : undefined}
    >
      {editMode && UNTITLED_TYPES.has(widget.type) && !(calme && CALME_TITLED_TYPES.has(widget.type)) && (
        <div className="nd-page-widget-edit-title nd-section-title">
          <Emoji emoji={entry?.icon ?? '🧩'} /> {name}
        </div>
      )}
      <WidgetActionsSlotContext.Provider value={editMode ? slot : null}>
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
          <button type="button" className="nd-action-icon danger" onClick={() => edit(current => removeWidget(current, widget.id))} title={t('pages.widget.removeNamed', { name })} aria-label={t('pages.widget.removeNamed', { name })}>
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
