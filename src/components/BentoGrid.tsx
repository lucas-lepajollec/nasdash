'use client';

import React, { useState, useEffect } from 'react';
import { Category, Service } from '@/lib/types';
import CategoryCard from './CategoryCard';
import ServiceItem from './ServiceItem';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { Trash2 } from 'lucide-react';

export interface BentoGridProps {
  categories: Category[];
  totalSlots: number;
  editMode: boolean;
  searchQuery: string;
  showSecret: boolean;
  onReorder: (newCategories: Category[]) => void;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
  onEditService: (service: Service) => void;
  onDeleteService: (serviceId: string, categoryId: string) => void;
  onAddService: (categoryId: string) => void;
  onDeleteSlot: (slotId: number) => void;
}

const DroppableSlot = ({ slotId, category, editMode, children, onDeleteSlot }: any) => {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slotId}`, data: { type: 'category-slot', slotId } });
  if (!editMode && !category) return null;
  if (editMode && !category) {
    return (
      <div ref={setNodeRef} style={{ height: 60, position: 'relative', border: isOver ? '2px dashed var(--nd-accent)' : '2px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nd-text-dimmed)', fontSize: '0.75rem', fontWeight: 600, background: isOver ? 'var(--nd-accent-glow)' : 'transparent', transition: 'all 0.2s', margin: '0' }}>
        <span>Emplacement vide</span>
        <button 
          className="nd-edit-btn nd-edit-btn-danger" 
          onClick={(e) => { e.stopPropagation(); onDeleteSlot(slotId); }} 
          style={{ position: 'absolute', right: 16, color: 'var(--nd-red)' }}>
          <Trash2 size={11} />
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

export default function BentoGrid({
  categories,
  totalSlots,
  editMode,
  searchQuery,
  showSecret,
  onReorder,
  onEditCategory,
  onDeleteCategory,
  onEditService,
  onDeleteService,
  onAddService,
  onDeleteSlot,
}: BentoGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const visible = categories.filter(c => showSecret || !c.isSecret);

  const [activeCat, setActiveCat] = useState<Category | null>(null);
  const [activeService, setActiveService] = useState<Service | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'category') {
      setActiveCat(event.active.data.current?.category as Category);
    } else if (event.active.data.current?.type === 'service') {
      setActiveService(event.active.data.current?.service as Service);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCat(null);
    setActiveService(null);
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type;
    const targetType = over.data.current?.type;

    if (activeType === 'category') {
      if (targetType !== 'category-slot') return;
      const activeData = active.data.current?.category as Category;
      const targetSlotId = over.data.current?.slotId as number;

      if (!activeData || activeData.order === targetSlotId) return;

      const targetCat = categories.find(c => c.order === targetSlotId);

      const newCategories = categories.map(c => {
        if (c.id === activeData.id) return { ...c, order: targetSlotId };
        if (targetCat && c.id === targetCat.id) return { ...c, order: activeData.order };
        return c;
      });

      newCategories.sort((a,b) => a.order - b.order);
      onReorder(newCategories);
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
        
        const [movedSrv] = fromCat.services.splice(oldIndex, 1);
        
        if (fromCatId === toCatId) {
          fromCat.services.splice(newIndex, 0, movedSrv);
        } else {
          toCat.services.splice(newIndex, 0, movedSrv);
        }
        
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

  const [colCount, setColCount] = useState(3);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 960) setColCount(1);
      else if (window.innerWidth <= 1400) setColCount(2);
      else setColCount(3);
    };
    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ensure grid stretches if a visible category has an order higher than totalSlots
  const actualSlotsCount = Math.max(
    totalSlots,
    ...visible.map(c => (typeof c.order === 'number' ? c.order + 1 : 0)),
    0
  );

  const slots = Array.from({ length: actualSlotsCount }, (_, i) => ({
    id: i,
    category: visible.find(c => c.order === i)
  }));

  const columns: typeof slots[] = Array.from({ length: colCount }, () => []);
  slots.forEach((slot, i) => columns[i % colCount].push(slot));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {columns.map((col, ci) => (
            <div key={ci} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              {col.map((slot) => (
                <DroppableSlot key={slot.id} slotId={slot.id} category={slot.category} editMode={editMode} onDeleteSlot={onDeleteSlot}>
                  {slot.category && (
                    <CategoryCard
                      category={slot.category}
                      editMode={editMode}
                      searchQuery={searchQuery}
                      onEditCategory={onEditCategory}
                      onDeleteCategory={onDeleteCategory}
                      onEditService={onEditService}
                      onDeleteService={onDeleteService}
                      onAddService={onAddService}
                    />
                  )}
                </DroppableSlot>
              ))}
            </div>
          ))}
        </div>
      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
        {activeCat ? (
          <div style={{ transform: 'scale(1.02)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', borderRadius: 'var(--nd-card-radius)', opacity: 0.9 }}>
            <CategoryCard
              category={activeCat}
              editMode={editMode}
              searchQuery={searchQuery}
              onEditCategory={onEditCategory}
              onDeleteCategory={onDeleteCategory}
              onEditService={onEditService}
              onDeleteService={onDeleteService}
              onAddService={onAddService}
            />
          </div>
        ) : null}
        {activeService ? (
          <div style={{ transform: 'scale(1.02)', boxShadow: '0 10px 20px rgba(0,0,0,0.2)', opacity: 0.9 }}>
            <ServiceItem service={activeService} editMode={true} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
