'use client';

import React from 'react';
import { ArrowDown, ArrowUp, ChevronsUp, Eye, EyeOff, GripVertical, RotateCcw } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useI18n } from '@/i18n/I18nProvider';
import { getWidgetCatalogEntry } from '@/lib/widgets/catalog';
import { isHiddenOnMobile, mobileOrder, moveOnMobile, resetMobileLayout, setHiddenOnMobile } from '@/lib/pages/operations';
import type { Page, WidgetInstance } from '@/lib/pages/types';
import { CalmeInfo } from '@/components/modals/settings/shared/CalmeControls';
import { Emoji } from '@/components/shared/Emoji';

/**
 * Edit mode on phones and tablets: the widgets of the page as a list, in
 * their phone order. Each one moves with its handle (dragged within the
 * list) or its arrows, and can be hidden on phones and tablets. The desktop
 * layout is never touched.
 */
export function MobileOrderEditor({ page, edit, nameOf }: {
  page: Page;
  edit: (operation: (page: Page) => Page) => void;
  nameOf: (widget: WidgetInstance) => string;
}) {
  const { t } = useI18n();
  const widgets = mobileOrder({ ...page, widgets: page.widgets.filter(widget => !widget.hidden) });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const move = (id: string, index: number) => edit(current => moveOnMobile(current, id, index));
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
                first={index === 0}
                last={index === widgets.length - 1}
                hidden={isHiddenOnMobile(page, widget.id)}
                onUp={() => move(widget.id, index - 1)}
                onDown={() => move(widget.id, index + 1)}
                onTop={() => move(widget.id, 0)}
                onToggle={() => edit(current => setHiddenOnMobile(current, widget.id, !isHiddenOnMobile(current, widget.id)))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function Row({ widget, name, position, first, last, hidden, onUp, onDown, onTop, onToggle }: {
  widget: WidgetInstance;
  name: string;
  position: number;
  first: boolean;
  last: boolean;
  hidden: boolean;
  onUp: () => void;
  onDown: () => void;
  onTop: () => void;
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
      <button type="button" className="nd-mobile-order-handle" {...attributes} {...listeners} aria-label={label('pages.mobile.drag')}>
        <GripVertical size={15} />
      </button>
      <span className="nd-mobile-order-icon" aria-hidden="true"><Emoji emoji={entry?.icon ?? '🧩'} /></span>
      <span className="nd-mobile-order-name">
        <span title={name}>{name}</span>
        {hidden && <span className="nd-mobile-order-state">{t('pages.mobile.hidden')}</span>}
      </span>
      <span className="nd-mobile-order-actions">
        {!first && <button type="button" className="ndc-icon-button" onClick={onTop} aria-label={label('pages.mobile.top')} title={t('pages.mobile.top')}><ChevronsUp size={15} /></button>}
        <button type="button" className="ndc-icon-button" onClick={onUp} disabled={first} aria-label={label('pages.mobile.up')}><ArrowUp size={15} /></button>
        <button type="button" className="ndc-icon-button" onClick={onDown} disabled={last} aria-label={label('pages.mobile.down')}><ArrowDown size={15} /></button>
        <button type="button" className="ndc-icon-button" onClick={onToggle} aria-pressed={hidden} aria-label={label(hidden ? 'pages.mobile.show' : 'pages.mobile.hide')} title={t(hidden ? 'pages.mobile.show' : 'pages.mobile.hide')}>
          {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </span>
    </li>
  );
}
