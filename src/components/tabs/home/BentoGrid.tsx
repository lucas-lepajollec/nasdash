'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Category, Service, CustomTabWidgetInfo } from '@/lib/types';
import { GripHorizontal, Trash2 } from 'lucide-react';
import CategoryCard from './CategoryCard';
import ServiceItem from './ServiceItem';
import HomeWidgetRenderer from './HomeWidgetRenderer';
import ConfirmModal from '../../modals/ConfirmModal';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';

export interface BentoGridProps {
  categories: Category[];
  homeWidgets?: (CustomTabWidgetInfo & { id: string, order: number })[];
  totalSlots: number;
  editMode: boolean;
  searchQuery: string;
  showSecretSections: boolean;
  showSensitive: boolean;
  onReorder: (newCategories: Category[]) => void;
  onReorderWidgets?: (newWidgets: (CustomTabWidgetInfo & { id: string, order: number })[]) => void;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
  onDeleteWidget?: (id: string) => void;
  onUpdateWidgetHeight?: (id: string, height: number) => void;
  onAddService: (categoryId: string) => void;
  onDeleteSlot: (slotId: number) => void;
}

const BentoGridWithDnd = ({ categories, homeWidgets = [], totalSlots, editMode, searchQuery, showSecretSections, showSensitive, onReorder, onReorderWidgets, onEditCategory, onDeleteCategory, onDeleteWidget, onUpdateWidgetHeight, onAddService, onDeleteSlot }: BentoGridProps) => {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const visibleCategories = categories.filter(c => showSecretSections || !c.isSecret);

  type GridItemType = { isCategory: boolean; data: any; order: number };
  const gridItems: GridItemType[] = [
    ...visibleCategories.map(c => ({ isCategory: true, data: c, order: c.order })),
    ...homeWidgets.map(w => ({ isCategory: false, data: w, order: w.order }))
  ];
  gridItems.sort((a, b) => a.order - b.order);

  const [activeItem, setActiveItem] = useState<GridItemType | null>(null);
  const [activeService, setActiveService] = useState<Service | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: 'category' | 'slot' | 'widget', id: string, name?: string } | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'category' || event.active.data.current?.type === 'widget') {
      setActiveItem({ 
        isCategory: event.active.data.current?.type === 'category', 
        data: event.active.data.current?.type === 'category' ? event.active.data.current?.category : event.active.data.current?.widget, 
        order: (event.active.data.current?.type === 'category' ? event.active.data.current?.category?.order : event.active.data.current?.widget?.order) || 0
      });
    } else if (event.active.data.current?.type === 'service') {
      setActiveService(event.active.data.current?.service as Service);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    setActiveService(null);
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type;
    const targetType = over.data.current?.type;

    if (activeType === 'category' || activeType === 'widget') {
      const isCategory = activeType === 'category';
      const activeData = isCategory ? active.data.current?.category : active.data.current?.widget;
      let targetSlotId: number | undefined = undefined;

      if (targetType === 'category-slot') {
        targetSlotId = over.data.current?.slotId as number;
      } else if (over.data.current?.categoryId || over.data.current?.widgetId) {
        // Find parent order if dropped inside an inner droppable
        const targetId = over.data.current?.categoryId || over.data.current?.widgetId;
        const targetItem = gridItems.find(i => i.data.id === targetId);
        if (targetItem) targetSlotId = targetItem.order;
      }

      if (targetSlotId === undefined || !activeData || activeData.order === targetSlotId) return;

      const targetItem = gridItems.find(i => i.order === targetSlotId);

      // We need to update either categories or homeWidgets based on what was dragged.
      // Also, we must swap their orders.
      if (isCategory) {
        const newCategories = categories.map(c => {
          if (c.id === activeData.id) return { ...c, order: targetSlotId };
          if (targetItem?.isCategory && c.id === targetItem.data.id) return { ...c, order: activeData.order };
          return c;
        });
        
        if (targetItem && !targetItem.isCategory && onReorderWidgets) {
          // Cross-swap: target was a widget
          const newWidgets = homeWidgets.map(w => {
            if (w.id === targetItem.data.id) return { ...w, order: activeData.order };
            return w;
          });
          onReorderWidgets(newWidgets);
        }
        
        newCategories.sort((a, b) => a.order - b.order);
        onReorder(newCategories);
      } else {
        if (onReorderWidgets) {
          const newWidgets = homeWidgets.map(w => {
            if (w.id === activeData.id) return { ...w, order: targetSlotId };
            if (targetItem && !targetItem.isCategory && w.id === targetItem.data.id) return { ...w, order: activeData.order };
            return w;
          });

          if (targetItem?.isCategory) {
            // Cross-swap: target was a category
            const newCategories = categories.map(c => {
              if (c.id === targetItem.data.id) return { ...c, order: activeData.order };
              return c;
            });
            newCategories.sort((a, b) => a.order - b.order);
            onReorder(newCategories);
          }

          newWidgets.sort((a, b) => a.order - b.order);
          onReorderWidgets(newWidgets);
        }
      }
      return;
    }

    if (activeType === 'service') {
      const srv = active.data.current?.service as Service;
      const fromCatId = active.data.current?.categoryId as string;

      let newCategories = JSON.parse(JSON.stringify(categories)) as Category[];

      if (targetType === 'service-drop') {
        const targetSrvId = over.data.current?.serviceId;
        const toCatId = over.data.current?.categoryId;

        const fromCat = newCategories.find(c => c.id === fromCatId)!;
        const toCat = newCategories.find(c => c.id === toCatId)!;

        const oldIndex = fromCat.services.findIndex(s => s.id === srv.id);
        const newIndex = toCat.services.findIndex(s => s.id === targetSrvId);

        if (fromCatId === toCatId) {
          // Swap in same category
          const temp = fromCat.services[oldIndex];
          fromCat.services[oldIndex] = fromCat.services[newIndex];
          fromCat.services[newIndex] = temp;
        } else {
          // Swap across categories
          const temp = fromCat.services[oldIndex];
          fromCat.services[oldIndex] = toCat.services[newIndex];
          toCat.services[newIndex] = temp;
        }

      } else if (targetType === 'service-gap') {
        const toCatId = over.data.current?.categoryId;
        const targetIndex = over.data.current?.index;

        const fromCat = newCategories.find(c => c.id === fromCatId)!;
        const toCat = newCategories.find(c => c.id === toCatId)!;

        const oldIndex = fromCat.services.findIndex(s => s.id === srv.id);
        const [movedSrv] = fromCat.services.splice(oldIndex, 1);

        let insertIndex = targetIndex;
        if (fromCatId === toCatId && oldIndex < targetIndex) {
          insertIndex -= 1;
        }

        toCat.services.splice(insertIndex, 0, movedSrv);

      } else if (targetType === 'category-empty-drop') {
        const toCatId = over.data.current?.categoryId;
        if (fromCatId === toCatId) return; // Dropped on self

        const fromCat = newCategories.find(c => c.id === fromCatId)!;
        const toCat = newCategories.find(c => c.id === toCatId)!;
        const fromSrvIndex = fromCat.services.findIndex(s => s.id === srv.id);

        const [movedSrv] = fromCat.services.splice(fromSrvIndex, 1);
        toCat.services.push(movedSrv);
      }
      onReorder(newCategories);
    }
  };

  const [colCount, setColCount] = useState(4);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width <= 600) setColCount(1);
        else if (width <= 900) setColCount(2);
        else if (width <= 1200) setColCount(3);
        else if (width <= 1500) setColCount(4);
        else if (width <= 1800) setColCount(5);
        else setColCount(6);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Ensure grid stretches if an item has an order higher than totalSlots
  const actualSlotsCount = Math.max(
    totalSlots,
    ...gridItems.map(i => (typeof i.order === 'number' ? i.order + 1 : 0)),
    0
  );

  const slots = Array.from({ length: actualSlotsCount }, (_, i) => ({
    id: i,
    item: gridItems.find(item => item.order === i)
  }));

  const columns: typeof slots[] = Array.from({ length: colCount }, () => []);
  slots.forEach((slot, i) => columns[i % colCount].push(slot));

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div ref={containerRef} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {columns.map((col, ci) => (
          <div key={ci} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {col.map((slot) => (
              <DroppableSlot key={slot.id} slotId={slot.id} item={slot.item} editMode={editMode} onDeleteSlot={(id: number) => setDeleteItem({ type: 'slot', id: id.toString() })}>
                {slot.item && (
                  slot.item.isCategory ? (
                    <CategoryCard
                      category={slot.item.data}
                      editMode={editMode}
                      searchQuery={searchQuery}
                      onEditCategory={onEditCategory}
                      onDeleteCategory={(id, name) => setDeleteItem({ type: 'category', id, name })}
                      onAddService={onAddService}
                      showSensitive={showSensitive}
                    />
                  ) : (
                    <DraggableWidgetWrapper 
                      widget={slot.item.data} 
                      editMode={editMode} 
                      onDelete={() => setDeleteItem({ type: 'widget', id: slot.item!.data.id })}
                    >
                      <HomeWidgetRenderer 
                        widget={slot.item.data} 
                        editMode={editMode} 
                        showSensitive={showSensitive}
                        onDelete={(id) => setDeleteItem({ type: 'widget', id })} 
                        onUpdateHeight={onUpdateWidgetHeight} 
                      />
                    </DraggableWidgetWrapper>
                  )
                )}
              </DroppableSlot>
            ))}
          </div>
        ))}
      </div>
      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
        {activeItem?.isCategory ? (
          <div style={{ transform: 'scale(1.02)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', borderRadius: 'var(--nd-card-radius)', opacity: 0.9 }}>
            <CategoryCard
              category={activeItem.data}
              editMode={editMode}
              searchQuery={searchQuery}
              onEditCategory={onEditCategory}
              onDeleteCategory={onDeleteCategory}
              onAddService={onAddService}
              showSensitive={showSensitive}
            />
          </div>
        ) : activeItem && !activeItem.isCategory ? (
          <div style={{ transform: 'scale(1.02)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', borderRadius: 'var(--nd-card-radius)', opacity: 0.9 }}>
            <HomeWidgetRenderer widget={activeItem.data} editMode={editMode} onDelete={() => {}} />
          </div>
        ) : null}
        {activeService ? (
          <div style={{ transform: 'scale(1.02)', boxShadow: '0 10px 20px rgba(0,0,0,0.2)', opacity: 0.9 }}>
            <ServiceItem service={activeService} editMode={true} showSensitive={showSensitive} />
          </div>
        ) : null}
      </DragOverlay>

      {editMode && <ConfirmModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => {
          if (!deleteItem) return;
          if (deleteItem.type === 'category') onDeleteCategory(deleteItem.id);
          if (deleteItem.type === 'slot') onDeleteSlot(parseInt(deleteItem.id));
          if (deleteItem.type === 'widget' && onDeleteWidget) onDeleteWidget(deleteItem.id);
          setDeleteItem(null);
        }}
        title={
          deleteItem?.type === 'category' ? 'Supprimer la catégorie ?' :
          deleteItem?.type === 'widget' ? 'Supprimer ce widget ?' :
          'Supprimer l\'emplacement ?'
        }
        description={
          deleteItem?.type === 'category' ? `Voulez-vous vraiment supprimer "${deleteItem.name}" et tous ses services de votre tableau de bord ?` :
          deleteItem?.type === 'widget' ? `Voulez-vous vraiment supprimer ce widget de votre tableau de bord ?` :
          'Voulez-vous vraiment supprimer cet emplacement vide de la grille et décaler le reste des éléments ?'
        }
      />}
    </DndContext>
  );
};

const DroppableSlot = ({ slotId, item, editMode, children, onDeleteSlot }: any) => {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slotId}`, data: { type: 'category-slot', slotId } });
  if (!editMode && !item) return null;
  if (editMode && !item) {
    return (
      <div ref={setNodeRef} style={{ height: 60, position: 'relative', border: isOver ? '2px dashed var(--nd-accent)' : '2px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nd-text-dimmed)', fontSize: '0.75rem', fontWeight: 600, background: isOver ? 'var(--nd-accent-glow)' : 'transparent', transition: 'all 0.2s', margin: '0' }}>
        <span>Emplacement vide</span>
        <button
          className="nd-action-icon danger"
          onClick={(e) => { e.stopPropagation(); onDeleteSlot(slotId); }}
          style={{ position: 'absolute', right: 16 }}>
          <Trash2 size={13} />
        </button>
      </div>
    );
  }
  return (
    <div ref={setNodeRef} style={{ position: 'relative', width: '100%', ...(isOver ? { outline: '2px dashed var(--nd-accent)', outlineOffset: 4, borderRadius: 'var(--nd-card-radius)' } : {}) }}>
      {children}
    </div>
  );
};

import { useDraggable } from '@dnd-kit/core';

const DraggableWidgetWrapper = ({ widget, editMode, onDelete, children }: { widget: any, editMode: boolean, onDelete: () => void, children: React.ReactNode }) => {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `widget-${widget.id}`,
    data: { type: 'widget', widget, widgetId: widget.id },
    disabled: !editMode
  });

  return (
    <div 
      ref={setNodeRef} 
      style={{ 
        opacity: isDragging ? 0.4 : 1, 
        width: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {editMode && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '6px 10px', 
          background: 'var(--nd-card-bg)',
          border: '1px solid var(--nd-card-border)',
          borderRadius: 'var(--nd-card-radius)',
          marginBottom: 8
        }}>
          <button 
            {...listeners} 
            {...attributes} 
            style={{ cursor: 'grab', background: 'none', border: 'none', color: 'var(--nd-text-dimmed)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Déplacer"
          >
            <GripHorizontal size={14} />
          </button>
          <button
            className="nd-action-icon danger"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Supprimer le widget"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
      <div style={{ width: '100%' }}>
        {children}
      </div>
    </div>
  );
};

export default function BentoGrid(props: BentoGridProps) {
  return <BentoGridWithDnd {...props} />;
}
