'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Globe, Pencil, Trash2, GripVertical, CheckCircle2, XCircle } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Service } from '@/lib/types';
import { useConfig } from '@/hooks/useConfig';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface ServiceItemProps {
  service: Service;
  categoryId?: string;
  editMode?: boolean;
  showSensitive?: boolean;
  layout?: 'standard' | 'compact' | 'bento' | 'grid' | 'bento-logo-large' | 'bento-logo-medium' | 'bento-logo-small';
}

export default function ServiceItem({ service, categoryId, editMode, showSensitive = false, layout = 'standard' }: ServiceItemProps) {
  const [imgError, setImgError] = useState(false);
  const { config } = useConfig();

  const pingIndicatorMode = config?.settings?.pingIndicatorMode || 'all';
  const showUrl = layout !== 'compact' && layout !== 'grid' && layout !== 'bento' && !layout?.startsWith('bento-logo');
  const showPingText = showUrl && config?.settings?.showPingDetails;
  
  const [shouldFetch, setShouldFetch] = useState(false);
  
  useEffect(() => {
    // Stagger ping requests to avoid hitting the browser's 6-connection limit per origin
    const delay = 500 + Math.random() * 3000;
    const timer = setTimeout(() => setShouldFetch(true), delay);
    return () => clearTimeout(timer);
  }, []);

  const shouldPing = service.localUrl && !editMode && (pingIndicatorMode !== 'none' || showPingText);
  const pingUrl = shouldPing && shouldFetch ? `/api/ping?url=${encodeURIComponent(service.localUrl)}` : null;

  const { data: pingStatus } = useSWR(pingUrl, fetcher, { 
    refreshInterval: 30000, 
    revalidateOnFocus: false 
  });

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
  const statusIconSize = activeLayout === 'compact' ? 16 : 20;
  const statusColor = pingStatus?.status === 'online' ? 'var(--nd-green)' : (pingStatus?.status === 'offline' ? 'var(--nd-red)' : 'var(--nd-text-dimmed)');

  const renderStatusIndicator = () => {
    if (!service.localUrl || editMode) return null;
    if (pingIndicatorMode === 'none') return null;
    
    // Pour bento/logo, une pastille simple en haut à droite
    if (activeLayout === 'bento' || isLogoOnly) {
      if (pingIndicatorMode === 'standard_only') return null;
      return (
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: statusColor,
          opacity: pingStatus?.status === 'online' ? 0.45 : (pingStatus?.status === 'offline' ? 0.6 : 0.3),
          zIndex: 5
        }} />
      );
    }

    // Pour standard et compact, l'icône de succès ronde ou croix rouge tout à droite
    return (
      <div style={{ marginLeft: 'auto', paddingLeft: 8, display: 'flex', alignItems: 'center' }}>
        {pingStatus?.status === 'online' ? (
          <CheckCircle2 size={statusIconSize} color="var(--nd-card-bg)" fill={statusColor} style={{ borderRadius: '50%', opacity: 0.45 }} />
        ) : pingStatus?.status === 'offline' ? (
          <XCircle size={statusIconSize} color="var(--nd-card-bg)" fill={statusColor} style={{ borderRadius: '50%', opacity: 0.6 }} />
        ) : (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, opacity: 0.3 }} />
        )}
      </div>
    );
  };


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
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: activeLayout === 'compact' ? 8 : 10 }}
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
              {showPingText && pingStatus ? (
                <span className="nd-service-url">
                  {pingStatus.status === 'online' ? 'OK' : pingStatus.statusText} - {pingStatus.latency}ms
                </span>
              ) : (
                <span className="nd-service-url">
                  {!showSensitive ? '•••' : (() => {
                    try {
                      return new URL(service.localUrl).host;
                    } catch (e) {
                      return service.localUrl;
                    }
                  })()}
                </span>
              )}
            </div>
          ) : (
            <span className="nd-service-name">{service.name}</span>
          )
        )}
      </a>

      {renderStatusIndicator()}

      {(service.secondaryUrl || service.tailscaleUrl) && !editMode && (
        <div className="nd-service-tooltip-wrapper">
          <a href={service.secondaryUrl || service.tailscaleUrl} target="_blank" rel="noopener noreferrer" className="nd-service-tooltip" title="Lien Secondaire">
            <div className="nd-service-tooltip-icon">
              {service.secondaryLogo ? (
                <img src={service.secondaryLogo} alt="Lien secondaire" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling && ((e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block'); }} />
              ) : (
                <img src={service.logo || "/api/logos/logo-tailscale.png"} alt="Lien alternatif" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling && ((e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block'); }} />
              )}
              <Globe size={14} style={{ display: 'none' }} />
            </div>
            <span className="nd-service-tooltip-text">Ouvrir le lien secondaire</span>
          </a>
        </div>
      )}

      {editMode && (
        <div className="nd-service-drag-handle" {...attributes} {...listeners} style={{ cursor: 'grab', marginLeft: 'auto', paddingLeft: 8 }}>
          <GripVertical size={12} />
        </div>
      )}
    </div>
  );
}
