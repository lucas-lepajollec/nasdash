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
}

export default function ServiceItem({ service, categoryId, editMode, showSensitive = false }: ServiceItemProps) {
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

  return (
    <div ref={setNodeRef} className="nd-service" style={{ 
      position: 'relative', 
      opacity: isDragging ? 0.3 : 1,
      outline: isOver ? '2px solid var(--nd-accent)' : undefined,
    }}>
      <a
        href={service.localUrl || service.tailscaleUrl || '#'}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit', touchAction: 'pan-y' }}
        onClick={(e) => {
          if (editMode) {
            e.preventDefault();
          }
        }}
      >
        <div className="nd-service-icon">
          {logoContent}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
          <span className="nd-service-name">{service.name}</span>
          {service.localUrl && <span className="nd-service-url">{!showSensitive ? '***' : new URL(service.localUrl).host}</span>}
        </div>
      </a>

      {service.tailscaleUrl && !editMode && (
        <a href={service.tailscaleUrl} target="_blank" rel="noopener noreferrer" className="nd-vpn-btn" title="VPN Tailscale" style={{ padding: 4 }}>
          <img src="/api/logos/logo-tailscale.png" alt="Tailscale" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling && ((e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block'); }} />
          <Globe size={12} style={{ display: 'none' }} />
        </a>
      )}

      {editMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <div {...attributes} {...listeners} style={{ cursor: 'grab', padding: 4, opacity: 0.5, display: 'flex', alignItems: 'center' }}>
            <GripVertical size={14} />
          </div>
        </div>
      )}
    </div>
  );
}
