'use client';

import React from 'react';
import { Pencil, Trash2, Plus, GripVertical } from 'lucide-react';
import { Category, Service } from '@/lib/types';
import ServiceItem from './ServiceItem';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useConfig } from '@/hooks/useConfig';
import { Emoji } from '../../shared/Emoji';
import { useI18n } from '@/i18n/I18nProvider';

interface CategoryCardProps {
  category: Category;
  editMode: boolean;
  searchQuery: string;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (id: string, name: string) => void;
  onAddService: (categoryId: string) => void;
  showSensitive?: boolean;
}

export default function CategoryCard({
  category, editMode, searchQuery,
  onEditCategory, onDeleteCategory, onAddService, showSensitive,
}: CategoryCardProps) {
  const { t } = useI18n();
  const { config } = useConfig();
  const hideCategoryTitles = config?.settings?.hideCategoryTitles ?? false;
  const categoryTitlePosition = config?.settings?.categoryTitlePosition || 'inside';

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
  };

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'pan-y',
  };

  const filteredServices = searchQuery
    ? category.services.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : category.services;

  if (searchQuery && filteredServices.length === 0) return null;

  const showDropGap = editMode && (category.layout !== 'bento' && category.layout !== 'grid' && !category.layout?.startsWith('bento-logo'));

  const showTitle = !hideCategoryTitles || editMode;

  const titleElement = showTitle && (
    <div className={categoryTitlePosition === 'above' ? 'nd-category-title-above' : 'nd-category-title'}>
      {editMode && (
        <button {...attributes} {...listeners} style={{ cursor: 'grab', background: 'none', border: 'none', color: 'var(--nd-text-dimmed)', padding: 2 }}>
          <GripVertical size={13} />
        </button>
      )}
      <span className="nd-category-emoji"><Emoji emoji={category.emoji} /></span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(category.title)}</span>
      {editMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button className="nd-action-icon success" onClick={() => onAddService(category.id)} title={t("Ajouter un service")}>
            <Plus size={13} />
          </button>
          <button className="nd-action-icon accent" onClick={() => onEditCategory(category)} title={t("Modifier la catégorie")}>
            <Pencil size={13} />
          </button>
          <button className="nd-action-icon danger" onClick={() => onDeleteCategory(category.id, category.title)} title={t("Supprimer la catégorie")}>
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div ref={setNodeRef} style={{ ...style, position: 'relative' }} className="nd-animate-in">
      {categoryTitlePosition === 'above' && titleElement}
      <div className="nd-card" style={{ position: 'relative' }}>
        {categoryTitlePosition === 'inside' && titleElement}
      <div 
        ref={setDroppable} 
        className={`nd-services-grid nd-services-grid--${category.layout || 'standard'}`} 
        style={{
          minHeight: filteredServices.length === 0 ? 40 : undefined,
          ...(isCategoryOver ? { background: 'var(--nd-accent-glow)', borderRadius: 12, outline: '2px dashed var(--nd-accent)' } : {})
        }}
      >
        {filteredServices.map((service, index) => {
          const isGrid = category.layout === 'bento' || category.layout === 'grid' || category.layout?.startsWith('bento-logo');
          
          return (
            <div key={service.id} style={{ position: 'relative' }}>
              {isGrid && editMode && <DropGap categoryId={category.id} index={index} isVertical />}
              {!isGrid && showDropGap && <DropGap categoryId={category.id} index={index} />}
              <ServiceItem
                service={service}
                categoryId={category.id}
                editMode={editMode}
                showSensitive={showSensitive}
                layout={category.layout}
                index={index}
                total={filteredServices.length}
              />
              {isGrid && editMode && index === filteredServices.length - 1 && (
                <DropGap categoryId={category.id} index={index + 1} isVertical isLast />
              )}
            </div>
          );
        })}
        {showDropGap && filteredServices.length > 0 && <DropGap categoryId={category.id} index={filteredServices.length} />}
        {filteredServices.length === 0 && !searchQuery && (
          <div style={{ gridColumn: '1 / -1', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: '0.7rem', textAlign: 'center', padding: '12px 0', color: 'var(--nd-text-dimmed)' }}>{t("Aucun service")}</p>
          </div>
        )}
      </div>
    </div>
  </div>
);
}

const DropGap = ({ categoryId, index, isVertical, isLast }: { categoryId: string, index: number, isVertical?: boolean, isLast?: boolean }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-gap-${categoryId}-${index}`,
    data: { type: 'service-gap', categoryId, index },
  });

  if (isVertical) {
    return (
      <div ref={setNodeRef} style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [isLast ? 'right' : 'left']: -10,
        width: 20,
        zIndex: isOver ? 10 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {isOver && <div style={{ width: 2, height: '100%', background: 'var(--nd-accent)', borderRadius: 2 }} />}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={{
      height: 12,
      marginTop: -6,
      marginBottom: -6,
      position: 'relative',
      zIndex: isOver ? 10 : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gridColumn: '1 / -1' // In case it's a CSS grid
    }}>
      {isOver && <div style={{ height: 2, width: '100%', background: 'var(--nd-accent)', borderRadius: 2 }} />}
    </div>
  );
};
