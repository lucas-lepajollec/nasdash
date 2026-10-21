'use client';

import React, { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, pointerWithin, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragMoveEvent } from '@dnd-kit/core';
import type { BookmarkItem } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { descendantsOf, dropItem, type DropPosition } from './tree';

/**
 * Drag and drop of bookmarks, like services between categories: grab a
 * link or a folder and drop it before or after another (it joins that
 * one's folder), or on the middle of a folder to put it inside. Path
 * segments ("Bookmarks › Dev") take items out to that folder. Its own
 * scope: a bookmark never lands in another widget.
 */

type Target = { id: string | undefined; position: DropPosition } | null;
type Axis = 'vertical' | 'horizontal';
const DragState = createContext<{ active: string | null; target: Target; enabled: boolean }>({ active: null, target: null, enabled: false });

/** Where on a row the pointer is: edges = next to it, middle of a folder = inside. */
function positionOf(pointer: number, start: number, size: number, folder: boolean): DropPosition {
  const ratio = (pointer - start) / Math.max(1, size);
  if (folder) return ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';
  return ratio < 0.5 ? 'before' : 'after';
}

export function BookmarkDragScope({ items, enabled, onChange, overlay, children }: {
  items: BookmarkItem[];
  enabled: boolean;
  onChange: (next: BookmarkItem[]) => void;
  /** What follows the pointer while dragging. */
  overlay: (item: BookmarkItem) => React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [active, setActive] = useState<string | null>(null);
  const [target, setTarget] = useState<Target>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  if (!enabled) return <DragState.Provider value={{ active: null, target: null, enabled: false }}>{children}</DragState.Provider>;

  const track = ({ active: dragged, over }: DragMoveEvent) => {
    const data = over?.data.current as { id?: string; folder?: boolean; axis?: Axis; zone?: boolean } | undefined;
    const rect = dragged.rect.current.translated;
    if (!over || !data || !rect) { setTarget(null); return; }
    if (data.zone) { setTarget({ id: data.id, position: 'inside' }); return; }
    const id = data.id!;
    // Never onto itself, nor (for a folder) anywhere inside it.
    if (id === dragged.id || descendantsOf(items, String(dragged.id)).has(id)) { setTarget(null); return; }
    const horizontal = data.axis === 'horizontal';
    const pointer = horizontal ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
    setTarget({ id, position: positionOf(pointer, horizontal ? over.rect.left : over.rect.top, horizontal ? over.rect.width : over.rect.height, !!data.folder) });
  };
  const dragged = items.find(item => item.id === active);
  return (
    <DragState.Provider value={{ active, target, enabled: true }}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        accessibility={{ screenReaderInstructions: { draggable: t('widgets.bookmarks.dragInstructions') } }}
        onDragStart={({ active: start }) => setActive(String(start.id))}
        onDragMove={track}
        onDragOver={track}
        onDragCancel={() => { setActive(null); setTarget(null); }}
        onDragEnd={({ active: end }) => {
          if (target) {
            const next = dropItem(items, String(end.id), target.id, target.position);
            if (next.some((item, index) => item !== items[index]) || next.length !== items.length) onChange(next);
          }
          setActive(null); setTarget(null);
        }}
      >
        {children}
        {/* In the page body: inside the widget (a transformed block) the preview would drift off screen and stretch the page. */}
        {typeof document !== 'undefined' && createPortal(
          <DragOverlay dropAnimation={null} zIndex={1000}>{dragged ? <div className="ndw-bookmark-overlay">{overlay(dragged)}</div> : null}</DragOverlay>,
          document.body,
        )}
      </DndContext>
    </DragState.Provider>
  );
}

/** A draggable, droppable bookmark row or tile; `dropClass` shows where it would land. */
export function useBookmarkDrag(item: BookmarkItem, axis: Axis = 'vertical') {
  const { active, target, enabled } = useContext(DragState);
  const drag = useDraggable({ id: item.id, disabled: !enabled });
  const drop = useDroppable({ id: `drop-${item.id}`, data: { id: item.id, folder: item.kind === 'folder', axis }, disabled: !enabled });
  const attach = (node: HTMLElement | null) => { drag.setNodeRef(node); drop.setNodeRef(node); };
  const here = target?.id === item.id ? target.position : null;
  const dropClass = [enabled ? 'is-draggable' : '', active === item.id ? 'is-dragged' : '', here ? `is-drop-${here}` : ''].filter(Boolean).join(' ');
  return { attach, handle: enabled ? { ...drag.attributes, ...drag.listeners } : {}, dropClass, enabled };
}

/** A place that takes dropped bookmarks into a folder (`undefined`: the top level). */
export function useBookmarkZone(folderId: string | undefined, key: string) {
  const { target, enabled } = useContext(DragState);
  const drop = useDroppable({ id: `zone-${key}`, data: { id: folderId, zone: true }, disabled: !enabled });
  return { attach: drop.setNodeRef, over: enabled && drop.isOver && target?.id === folderId && target?.position === 'inside' };
}

/** Whether bookmarks can be dragged here (edit mode, library settings). */
export function useBookmarkDragEnabled(): boolean {
  return useContext(DragState).enabled;
}

export type BookmarkDragProps = { attach?: (node: HTMLElement | null) => void; handle: Record<string, unknown>; dropClass: string; enabled: boolean };
/** Outside edit mode: no drag hooks at all, so a large library stays light. */
export const NO_DRAG: BookmarkDragProps = { handle: {}, dropClass: '', enabled: false };

/** Gives `render` the drag props of `item`; only mounted while dragging is possible. */
export function WithBookmarkDrag({ item, axis, render }: { item: BookmarkItem; axis?: Axis; render: (drag: BookmarkDragProps) => React.ReactNode }) {
  const { attach, handle, dropClass, enabled } = useBookmarkDrag(item, axis);
  return <>{render({ attach, handle, dropClass, enabled })}</>;
}
