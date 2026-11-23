'use client';

import React, { useContext } from 'react';
import { Pencil, Trash2, Plus, GripVertical } from 'lucide-react';
import { Category } from '@/lib/types';
import ServiceItem from './ServiceItem';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useConfig } from '@/hooks/useConfig';
import { Emoji } from '../../shared/Emoji';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetHeaderActions } from '../../widgets/WidgetHeaderActions';
import { stableColumns } from '../../widgets/content/kit';
import { useMobileLayout } from '../../layout/MobilePager';
import { WidgetTitleContext, WidgetTitleVisibility } from '@/widgets/calme';
import { prepareSearchText, searchTerms, textMatches } from '@/lib/search/match';

/** Tile grids (with names, or logos only): smallest tile and gap, in px, for steady columns. */
const TILE_GRIDS: Record<string, { min: number; gap: number }> = { bento: { min: 92, gap: 6 }, 'bento-logo-large': { min: 104, gap: 8 }, 'bento-logo-medium': { min: 88, gap: 6 }, 'bento-logo-small': { min: 62, gap: 4 } };
/** Phones and tablets: logos are square tiles across the line, about 3, 4 and 5 to a phone's line by size. */
const PHONE_LOGO_MIN: Record<string, number> = { 'bento-logo-large': 96, 'bento-logo-medium': 72, 'bento-logo-small': 56 };

interface CategoryCardProps {
  category: Category;
  editMode: boolean;
  searchQuery: string;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (id: string, name: string) => void;
  onAddService: (categoryId: string) => void;
  showSensitive?: boolean;
  /** Rendered as a page widget: the page owns the outer drag handle. */
  embedded?: boolean;
  /** Distinguishes drag targets when one category is displayed by several widgets. */
  dndScope?: string;
}

export default function CategoryCard({
  category, editMode, searchQuery,
  onEditCategory, onDeleteCategory, onAddService, showSensitive, embedded = false, dndScope,
}: CategoryCardProps) {
  const { t } = useI18n();
  const { config } = useConfig();
  const hideCategoryTitles = config?.settings?.hideCategoryTitles ?? false;
  const titleChoice = useContext(WidgetTitleContext)?.visible;
  // The title sits above the card unless the user chose a position.
  const categoryTitlePosition = config?.settings?.categoryTitlePosition || 'above';

  const { attributes, listeners, setNodeRef: setDraggable, isDragging } = useDraggable({
    id: `drag-cat-${dndScope ?? category.id}`, disabled: !editMode || embedded, data: { type: 'category', category }
  });

  const { setNodeRef: setDroppable, isOver: isCategoryOver } = useDroppable({
    id: `drop-cat-srvs-${dndScope ?? category.id}`,
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

  const tileGrid = TILE_GRIDS[category.layout || ''];
  const mobileLayout = useMobileLayout();
  const tileMin = (mobileLayout && PHONE_LOGO_MIN[category.layout || '']) || tileGrid?.min || 0;
  const gridNode = React.useRef<HTMLElement | null>(null);
  const [gridWidth, setGridWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const element = gridNode.current;
    if (!element || !tileGrid) return;
    setGridWidth(element.clientWidth);
    const observer = new ResizeObserver(entries => setGridWidth(Math.round(entries[0]?.contentRect.width ?? 0)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [tileGrid]);
  // Searching: the services whose name (or address, when shown) matches, or
  // the whole category when its own name does (src/lib/search/match.ts).
  const terms = searchTerms(searchQuery ?? '');
  const categoryHit = terms.length > 0 && textMatches(terms, prepareSearchText(t(category.title)));
  const filteredServices = terms.length && !categoryHit
    ? category.services.filter(service => textMatches(terms, prepareSearchText([service.name, ...(showSensitive ? [service.localUrl, service.secondaryUrl ?? ''] : [])].join(' '))))
    : category.services;

  if (searchQuery && filteredServices.length === 0) return null;

  const showDropGap = editMode && (category.layout !== 'bento' && category.layout !== 'grid' && !category.layout?.startsWith('bento-logo'));

  // This category view's own choice wins over the general setting. Titles are
  // always shown while editing; the page reflows when they hide again.
  const titleShown = titleChoice ?? !hideCategoryTitles;
  const showTitle = titleShown || editMode;

  // On a page, these buttons join the widget's controls in its top-right corner.
  const editActions = editMode && (
    <WidgetHeaderActions>
      <button className="nd-action-icon success" onClick={() => onAddService(category.id)} title={t("Ajouter un service")}>
        <Plus size={13} />
      </button>
      <button className="nd-action-icon accent" onClick={() => onEditCategory(category)} title={t("Modifier la catégorie")}>
        <Pencil size={13} />
      </button>
      {!embedded && (
        <button className="nd-action-icon danger" onClick={() => onDeleteCategory(category.id, category.title)} title={t("Supprimer la catégorie")}>
          <Trash2 size={13} />
        </button>
      )}
    </WidgetHeaderActions>
  );

  const titleElement = showTitle && (
    <div className={`${categoryTitlePosition === 'above' ? 'nd-category-title-above' : 'nd-category-title'} ${titleShown ? '' : 'is-hidden-title'}`}>
      {editMode && !embedded && (
        <button {...attributes} {...listeners} style={{ cursor: 'grab', background: 'none', border: 'none', color: 'var(--nd-text-dimmed)', padding: 2 }}>
          <GripVertical size={13} />
        </button>
      )}
      <span className="nd-category-emoji"><Emoji emoji={category.emoji} /></span>
      <span style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(category.title)}</span>
      {editMode && <WidgetTitleVisibility shown={titleShown} />}
      {editActions && <div className="nd-category-edit-actions">{editActions}</div>}
    </div>
  );

  return (
    <div ref={setNodeRef} style={{ ...style, position: 'relative' }} className="nd-animate-in">
      {categoryTitlePosition === 'above' && titleElement}
      <div className="nd-card" style={{ position: 'relative' }}>
        {categoryTitlePosition === 'inside' && titleElement}
      <div 
        ref={node => { setDroppable(node); gridNode.current = node; }} 
        data-service={embedded ? 'category-content' : undefined}
        className={`nd-services-grid nd-services-grid--${category.layout || 'standard'}`} 
        style={{
          minHeight: filteredServices.length === 0 ? 40 : undefined,
          // Tiles fill the line, then keep their size as the widget widens (no breathing, no drifting apart);
          // on phones and tablets a short line spans the whole width too.
          ...(tileGrid && gridWidth && filteredServices.length ? { gridTemplateColumns: stableColumns(gridWidth, filteredServices.length, tileMin, Math.round(tileMin * 1.2), tileGrid.gap, mobileLayout) } : {}),
          ...(isCategoryOver ? { background: 'var(--nd-accent-glow)', borderRadius: 12, outline: '2px dashed var(--nd-accent)' } : {})
        }}
      >
        {filteredServices.map((service, index) => {
          const isGrid = category.layout === 'bento' || category.layout === 'grid' || category.layout?.startsWith('bento-logo');
          
          return (
            <div key={service.id} style={{ position: 'relative' }}>
              {isGrid && editMode && <DropGap categoryId={category.id} scope={dndScope} index={index} isVertical />}
              {!isGrid && showDropGap && <DropGap categoryId={category.id} scope={dndScope} index={index} />}
              <ServiceItem
                service={service}
                categoryId={category.id}
                dndScope={dndScope}
                editMode={editMode}
                showSensitive={showSensitive}
                layout={category.layout}
                index={index}
                total={filteredServices.length}
              />
              {isGrid && editMode && index === filteredServices.length - 1 && (
                <DropGap categoryId={category.id} scope={dndScope} index={index + 1} isVertical isLast />
              )}
              {showDropGap && index === filteredServices.length - 1 && (
                <DropGap categoryId={category.id} scope={dndScope} index={index + 1} isLast />
              )}
            </div>
          );
        })}
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

const DropGap = ({ categoryId, scope, index, isVertical, isLast }: { categoryId: string, scope?: string, index: number, isVertical?: boolean, isLast?: boolean }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-gap-${scope ?? categoryId}-${index}`,
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

  // Takes no room: the drop area straddles the edge between two services.
  return (
    <div ref={setNodeRef} style={{
      position: 'absolute',
      left: 0,
      right: 0,
      [isLast ? 'bottom' : 'top']: -6,
      height: 12,
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
