'use client';

import type { ReactNode } from 'react';
import { DndContext, closestCenter, pointerWithin, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type CollisionDetection, type KeyboardCoordinateGetter, type UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { useFitGrid } from '@/components/widgets/content/kit';

interface MetricItem { id: string; label: string; content: ReactNode }

// A full-width bar/chart can be dropped onto a much narrower ring group.
// Use the pointer target rather than the dragged block's distant centre.
const groupCollision: CollisionDetection = args => {
  const targets = pointerWithin({ ...args, pointerCoordinates: args.pointerCoordinates ?? { x: args.collisionRect.left + 1, y: args.collisionRect.top + 1 } });
  return targets.length ? targets : closestCenter(args);
};

/** Named groups move one slot at a time regardless of their different sizes. */
const groupKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const direction = event.code === 'ArrowUp' || event.code === 'ArrowLeft' ? -1 : event.code === 'ArrowDown' || event.code === 'ArrowRight' ? 1 : 0;
  if (!direction || !context.active) return;
  event.preventDefault();
  const items = context.active.data.current?.sortable?.items as UniqueIdentifier[] | undefined;
  if (!items) return;
  const index = items.indexOf(context.over?.id ?? context.active.id) + direction;
  const rect = context.droppableRects.get(items[index]);
  if (rect) return { x: rect.left, y: rect.top };
};

/** Own DnD scope: a reading moves inside this widget, never into another widget. */
export function SortableMetrics({ items, className, enabled, onMove, kind = 'metric' }: {
  items: MetricItem[];
  className: string;
  enabled: boolean;
  onMove: (active: string, over: string) => void;
  kind?: 'metric' | 'group';
}) {
  const { t } = useI18n();
  const fit = useFitGrid<HTMLDivElement>();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: kind === 'group' ? groupKeyboardCoordinates : sortableKeyboardCoordinates }),
  );
  if (!enabled || items.length < 2) return <div ref={fit} className={className}>{items.map(item => <div className="ndc-m-sortable" data-metric-entry={item.id} key={item.id}>{item.content}</div>)}</div>;
  const position = (id: string | number, target = id) => {
    const index = items.findIndex(item => item.id === target);
    return t('devices.look.metricPosition', { name: items.find(item => item.id === id)?.label ?? '', position: index + 1, total: items.length });
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kind === 'group' ? groupCollision : closestCenter}
      accessibility={{
        screenReaderInstructions: { draggable: t(kind === 'group' ? 'devices.look.groupDragInstructions' : 'devices.look.metricDragInstructions') },
        announcements: {
          onDragStart: ({ active }) => position(active.id),
          onDragOver: ({ active, over }) => position(active.id, over?.id ?? active.id),
          onDragEnd: ({ active, over }) => position(active.id, over?.id ?? active.id),
          onDragCancel: () => t(kind === 'group' ? 'devices.look.groupDragCancelled' : 'devices.look.metricDragCancelled'),
        },
      }}
      onDragEnd={({ active, over }) => { if (over) onMove(String(active.id), String(over.id)); }}
    >
      <SortableContext items={items.map(item => item.id)} strategy={rectSortingStrategy}>
        <div ref={fit} className={className}>{items.map(item => <SortableMetric key={item.id} item={item} kind={kind} />)}</div>
      </SortableContext>
    </DndContext>
  );
}

function SortableMetric({ item, kind }: { item: MetricItem; kind: 'metric' | 'group' }) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const label = t(kind === 'group' ? 'devices.look.moveGroup' : 'devices.look.moveMetric', { name: item.label });
  return (
    <div ref={setNodeRef} className={`ndc-m-sortable is-editable ${kind === 'group' ? 'is-group' : ''} ${isDragging ? 'is-dragging' : ''}`} data-metric-entry={item.id} style={{ transform: CSS.Transform.toString(kind === 'group' && transform ? { ...transform, scaleX: 1, scaleY: 1 } : transform), transition }}>
      <button ref={setActivatorNodeRef} type="button" className={kind === 'group' ? 'ndc-group-drag' : 'ndc-m-drag'} {...attributes} {...listeners} aria-label={label} title={label}><GripVertical size={13} />{kind === 'group' && <span>{item.label}</span>}</button>
      {item.content}
    </div>
  );
}
