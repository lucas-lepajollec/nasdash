'use client';

import React from 'react';
import { Eye, EyeOff, GripHorizontal, RotateCcw } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useI18n } from '@/i18n/I18nProvider';
import { getWidgetCatalogEntry } from '@/lib/widgets/catalog';
import { isHiddenOnMobile, mobileOrder, moveOnMobile, resetMobileLayout, setHiddenOnMobile } from '@/lib/pages/operations';
import type { Page, WidgetInstance } from '@/lib/pages/types';
import { HEADER_WIDGET_TYPES } from '@/lib/pages/header';
import { CalmeInfo } from '@/components/modals/settings/shared/CalmeControls';
import { Emoji } from '@/components/shared/Emoji';

/**
 * Edit mode on phones and tablets: the widgets of the page as a list, in
 * their phone order, like a phone's own reorder lists: each one moves with
 * the handle on its right (dragged, or Space then the arrow keys), and its
 * eye hides it on phones and tablets. The desktop layout is never touched.
 */
export function MobileOrderEditor({ page, edit, nameOf }: {
  page: Page;
  edit: (operation: (page: Page) => Page) => void;
  nameOf: (widget: WidgetInstance) => string;
}) {
  const { t } = useI18n();
  // The header widgets are not part of the phone order: the phone header replaces them.
  const all = mobileOrder({ ...page, widgets: page.widgets.filter(widget => !widget.hidden) });
  const widgets = all.filter(widget => !HEADER_WIDGET_TYPES.has(widget.type));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Positions in this list, turned into positions in the whole phone order.
  const move = (id: string, index: number) => {
    const target = widgets[Math.max(0, Math.min(widgets.length - 1, index))];
    const position = target ? all.findIndex(widget => widget.id === target.id) : index;
    edit(current => moveOnMobile(current, id, position));
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const index = widgets.findIndex(widget => widget.id === over.id);
    if (index >= 0) move(String(active.id), index);
  };
  const customised = !!page.mobile?.order?.length || !!page.mobile?.hidden?.length;

  return (
    <section className="nd-mobile-order" aria-label={t('pages.mobile.title')}>
      <div className="nd-mobile-order-head">
        <span className="nd-mobile-order-title">{t('pages.mobile.title')}<CalmeInfo text={t('pages.mobile.hint')} /></span>
        {customised && (
          <button type="button" className="ndc-text-button" onClick={() => edit(resetMobileLayout)}>
            <RotateCcw size={12} /> {t('pages.mobile.reset')}
          </button>
        )}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={widgets.map(widget => widget.id)} strategy={verticalListSortingStrategy}>
          <ol className="nd-mobile-order-list">
            {widgets.map((widget, index) => (
              <Row
                key={widget.id}
                widget={widget}
                name={nameOf(widget)}
                position={index + 1}
                hidden={isHiddenOnMobile(page, widget.id)}
                onToggle={() => edit(current => setHiddenOnMobile(current, widget.id, !isHiddenOnMobile(current, widget.id)))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function Row({ widget, name, position, hidden, onToggle }: {
  widget: WidgetInstance;
  name: string;
  position: number;
  hidden: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const entry = getWidgetCatalogEntry(widget.type);
  const label = (action: string) => [t(action), name].join(' · ');
  return (
    <li
      ref={setNodeRef}
      className={`nd-mobile-order-row ${hidden ? 'is-hidden' : ''} ${isDragging ? 'is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={t('pages.mobile.position', { position, name })}
    >
      <span className="nd-mobile-order-icon" aria-hidden="true"><Emoji emoji={entry?.icon ?? '🧩'} /></span>
      <span className="nd-mobile-order-name">
        <span title={name}>{name}</span>
        {hidden && <span className="nd-mobile-order-state">{t('pages.mobile.hidden')}</span>}
      </span>
      <button type="button" className={`nd-mobile-order-eye ${hidden ? 'is-off' : ''}`} onClick={onToggle} aria-pressed={hidden} aria-label={label(hidden ? 'pages.mobile.show' : 'pages.mobile.hide')} title={t(hidden ? 'pages.mobile.show' : 'pages.mobile.hide')}>
        {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
      <button type="button" className="nd-mobile-order-handle" {...attributes} {...listeners} aria-label={label('pages.mobile.drag')}>
        <GripHorizontal size={18} />
      </button>
    </li>
  );
}
