'use client';

import React from 'react';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useI18n } from '@/i18n/I18nProvider';

const Enabled = React.createContext(false);

/**
 * Rows or tiles of a content widget put in order by drag and drop, in edit
 * mode (like services in a category). Its own scope: an item never leaves
 * its widget. `onMove` gets the dragged id and the one it was dropped on.
 */
export function SortableList({ ids, enabled, layout = 'list', onMove, children }: {
  ids: string[]; enabled: boolean; layout?: 'list' | 'grid'; onMove: (active: string, over: string) => void; children: React.ReactNode;
}) {
  const { t } = useI18n();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} accessibility={{ screenReaderInstructions: { draggable: t('widgets.list.dragInstructions') } }}
      onDragEnd={({ active, over }) => { if (enabled && over && active.id !== over.id) onMove(String(active.id), String(over.id)); }}>
      <SortableContext items={ids} strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy} disabled={!enabled}>
        <Enabled.Provider value={enabled}>{children}</Enabled.Provider>
      </SortableContext>
    </DndContext>
  );
}

/** One item of a `SortableList`: the whole block is the handle while editing. */
export function SortableItem({ id, className, title, children }: { id: string; className: string; title?: string; children: React.ReactNode }) {
  const enabled = React.useContext(Enabled);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !enabled });
  const disabled = !enabled;
  return (
    <div ref={setNodeRef} className={`${className} ${disabled ? '' : 'is-sortable'} ${isDragging ? 'is-dragging' : ''}`} title={title}
      style={{ transform: CSS.Translate.toString(transform), transition }} {...(disabled ? {} : { ...attributes, ...listeners })}>
      {children}
    </div>
  );
}

/** `list` with `id` moved to where `over` was. */
export function moveById<T>(list: readonly T[], idOf: (item: T) => string, id: string, over: string): T[] {
  const from = list.findIndex(item => idOf(item) === id), to = list.findIndex(item => idOf(item) === over);
  if (from < 0 || to < 0 || from === to) return [...list];
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
