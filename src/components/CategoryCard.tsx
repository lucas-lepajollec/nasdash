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
  onDeleteCategory: (id: string, name: string) => void;
  onAddService: (categoryId: string) => void;
}

export default function CategoryCard({
  category, editMode, searchQuery,
  onEditCategory, onDeleteCategory, onAddService,
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

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'pan-y',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="nd-action-icon success" onClick={() => onAddService(category.id)} title="Ajouter un service">
              <Plus size={13} />
            </button>
            <button className="nd-action-icon accent" onClick={() => onEditCategory(category)} title="Modifier la catégorie">
              <Pencil size={13} />
            </button>
            <button className="nd-action-icon danger" onClick={() => onDeleteCategory(category.id, category.title)} title="Supprimer la catégorie">
              <Trash2 size={13} />
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
