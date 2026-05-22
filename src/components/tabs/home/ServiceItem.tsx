'use client';

import { useState } from 'react';
import { Globe, Pencil, Trash2, GripVertical } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Service } from '@/lib/types';

interface ServiceItemProps {
  service: Service;
  categoryId?: string;
  editMode?: boolean;
  showSensitive?: boolean;
  layout?: 'standard' | 'compact' | 'bento' | 'grid' | 'bento-logo-large' | 'bento-logo-medium' | 'bento-logo-small';
}

export default function ServiceItem({ service, categoryId, editMode, showSensitive = false, layout = 'standard' }: ServiceItemProps) {
  const [imgError, setImgError] = useState(false);

  const { attributes, listeners, setNodeRef: setDraggable, isDragging } = useDraggable({
    id: `drag-srv-${service.id}`,
    data: { type: 'service', service, categoryId },
    disabled: !editMode || !categoryId,
  });

  const { setNodeRef: setDroppable, isOver } = useDroppable({
    id: `drop-srv-${service.id}`,
    data: { type: 'service-drop', serviceId: service.id, categoryId },
    disabled: !editMode || !categoryId,
  });

  const setNodeRef = (node: HTMLElement | null) => {
    setDraggable(node);
    setDroppable(node);
  };

  const logoContent = service.logo && !imgError ? (
    <img
      src={service.logo}
      alt={service.name}
      onError={() => setImgError(true)}
    />
  ) : (
    <span className="nd-service-icon-fallback">{service.name.charAt(0).toUpperCase()}</span>
  );

  const activeLayout = layout === 'grid' ? 'bento' : layout;
  const isLogoOnly = activeLayout?.startsWith('bento-logo');
  const showUrl = activeLayout !== 'compact' && activeLayout !== 'bento' && !isLogoOnly;

  return (
    <div ref={setNodeRef} className={`nd-service nd-service--${activeLayout}`} style={{ 
      position: 'relative', 
      opacity: isDragging ? 0.3 : 1,
      outline: isOver ? '2px solid var(--nd-accent)' : undefined,
    }}>
      <a
        href={service.localUrl || service.secondaryUrl || service.tailscaleUrl || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="nd-service-link"
        onClick={(e) => {
          if (editMode) {
            e.preventDefault();
          }
        }}
      >
        <div className="nd-service-icon">
          {logoContent}
        </div>
        
        {!isLogoOnly && (
          showUrl && service.localUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
              <span className="nd-service-name">{service.name}</span>
              <span className="nd-service-url">
                {!showSensitive ? '***' : (() => {
                  try {
                    return new URL(service.localUrl).host;
                  } catch (e) {
                    return service.localUrl;
                  }
                })()}
              </span>
            </div>
          ) : (
            <span className="nd-service-name">{service.name}</span>
          )
        )}
      </a>

      {(service.secondaryUrl || service.tailscaleUrl) && !editMode && activeLayout !== 'bento' && !isLogoOnly && (
        <a href={service.secondaryUrl || service.tailscaleUrl} target="_blank" rel="noopener noreferrer" className="nd-vpn-btn" title="Lien Secondaire" style={{ padding: 4 }}>
          {service.secondaryLogo ? (
            <img src={service.secondaryLogo} alt="Lien secondaire" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling && ((e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block'); }} />
          ) : (
            <img src="/api/logos/logo-tailscale.png" alt="Tailscale" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling && ((e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block'); }} />
          )}
          <Globe size={12} style={{ display: 'none' }} />
        </a>
      )}

      {editMode && (
        <div className="nd-service-drag-handle" {...attributes} {...listeners} style={{ cursor: 'grab' }}>
          <GripVertical size={12} />
        </div>
      )}
    </div>
  );
}
