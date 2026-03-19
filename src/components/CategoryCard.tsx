'use client';

import { Pencil, Trash2, Plus, GripVertical } from 'lucide-react';
import { Category, Service } from '@/lib/types';
import ServiceItem from './ServiceItem';
import { useDraggable, useDroppable } from '@dnd-kit/core';

interface CategoryCardProps {
  category: Category;
  editMode: boolean;
  searchQuery: string;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
  onEditService: (service: Service) => void;
  onDeleteService: (serviceId: string, categoryId: string) => void;
  onAddService: (categoryId: string) => void;
}

export default function CategoryCard({
  category, editMode, searchQuery,
  onEditCategory, onDeleteCategory, onEditService, onDeleteService, onAddService,
}: CategoryCardProps) {
  const { attributes, listeners, setNodeRef: setDraggable, isDragging } = useDraggable({
    id: `drag-cat-${category.id}`, disabled: !editMode, data: { type: 'category', category }
  });

  const { setNodeRef: setDroppable, isOver: isCategoryOver } = useDroppable({
    id: `drop-cat-srvs-${category.id}`,
    data: { type: 'category-empty-drop', categoryId: category.id },
    disabled: !editMode
  });

  const setNodeRef = (node: HTMLElement | null) => {
    setDraggable(node);
    setDroppable(node);
  };

  const style = {
    opacity: isDragging ? 0.3 : 1,
  };

  const filteredServices = searchQuery
    ? category.services.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : category.services;

  if (searchQuery && filteredServices.length === 0) return null;

  return (
    <div ref={setNodeRef} style={{ ...style, position: 'relative' }} className="nd-card nd-animate-in">
      <div className="nd-category-title">
        {editMode && (
          <button {...attributes} {...listeners} style={{ cursor: 'grab', background: 'none', border: 'none', color: 'var(--nd-text-dimmed)', padding: 2 }}>
            <GripVertical size={13} />
          </button>
        )}
        <span className="nd-category-emoji">{category.emoji}</span>
        <span style={{ flex: 1 }}>{category.title}</span>
        {editMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button className="nd-edit-btn" onClick={() => onAddService(category.id)} style={{ color: 'var(--nd-green)' }} title="Ajouter un service">
              <Plus size={12} />
            </button>
            <button className="nd-edit-btn" onClick={() => onEditCategory(category)} style={{ color: 'var(--nd-accent)' }}>
              <Pencil size={11} />
            </button>
            <button className="nd-edit-btn nd-edit-btn-danger" onClick={() => onDeleteCategory(category.id)} style={{ color: 'var(--nd-red)' }}>
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>
      <div ref={setDroppable} className="nd-services-grid" style={{
        ...(isCategoryOver ? { background: 'var(--nd-accent-glow)', borderRadius: 12, minHeight: 40, outline: '2px dashed var(--nd-accent)' } : {})
      }}>
        {filteredServices.map(service => (
          <ServiceItem
            key={service.id}
            service={service}
            onEdit={editMode ? () => onEditService(service) : undefined}
            onDelete={editMode ? () => onDeleteService(service.id, category.id) : undefined}
            categoryId={category.id}
            editMode={editMode}
          />
        ))}</div>
      {filteredServices.length === 0 && !searchQuery && (
        <p style={{ fontSize: '0.7rem', textAlign: 'center', padding: '12px 0', color: 'var(--nd-text-dimmed)' }}>Aucun service</p>
      )}
    </div>
  );
}
