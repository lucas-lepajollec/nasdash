'use client';

import { useState, useEffect } from 'react';
import { Globe, Pencil, Trash2, GripVertical, CheckCircle2, XCircle } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Service } from '@/lib/types';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';

interface ServiceItemProps {
  service: Service;
  categoryId?: string;
  editMode?: boolean;
  showSensitive?: boolean;
  layout?: 'standard' | 'compact' | 'bento' | 'grid' | 'bento-logo-large' | 'bento-logo-medium' | 'bento-logo-small';
  index?: number;
  total?: number;
}

export default function ServiceItem({ service, categoryId, editMode, showSensitive = false, layout = 'standard', index, total }: ServiceItemProps) {
  const { t } = useI18n();
  const [imgError, setImgError] = useState(false);
  const { config, pingResults } = useConfig();
  const demoMode = config?.demoMode === true;

  const pingIndicatorMode = config?.settings?.pingIndicatorMode || 'all';
  const showUrl = layout !== 'compact' && layout !== 'grid' && layout !== 'bento' && !layout?.startsWith('bento-logo');
  const showPingText = showUrl && config?.settings?.showPingDetails;

  const [delayedStatus, setDelayedStatus] = useState<{ status: string; statusText: string; latency: number } | null>(null);

  useEffect(() => {
    const rawStatus = service.localUrl ? pingResults[service.localUrl] : null;
    if (!rawStatus) {
      setDelayedStatus(null);
      return;
    }

    // Hash stable de l'id du service pour échelonner l'affichage (cascade de 0ms à 500ms)
    let hash = 0;
    const str = service.id || '';
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const delay = Math.abs(hash % 11) * 45;

    const timer = setTimeout(() => {
      setDelayedStatus(rawStatus);
    }, delay);

    return () => clearTimeout(timer);
  }, [pingResults, service.id, service.localUrl]);

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
  const isBento = activeLayout === 'bento' || isLogoOnly;
  const statusIconSize = activeLayout === 'compact' ? 16 : 20;
  const statusColor = delayedStatus?.status === 'online' ? 'var(--nd-green)' : (delayedStatus?.status === 'offline' ? 'var(--nd-red)' : 'var(--nd-text-dimmed)');

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
          opacity: delayedStatus ? (delayedStatus.status === 'online' ? 0.45 : 0.6) : 0,
          transform: delayedStatus ? 'scale(1)' : 'scale(0)',
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: 5
        }} />
      );
    }

    // Pour standard et compact, l'icône de succès ronde ou croix rouge tout à droite
    return (
      <div style={{ 
        marginLeft: 'auto', 
        paddingLeft: 8, 
        display: 'flex', 
        alignItems: 'center',
        transform: delayedStatus ? 'scale(1)' : 'scale(0.8)',
        opacity: delayedStatus ? 1 : 0.3,
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        {delayedStatus?.status === 'online' ? (
          <CheckCircle2 size={statusIconSize} color="var(--nd-card-bg)" fill={statusColor} style={{ borderRadius: '50%', opacity: 0.45 }} />
        ) : delayedStatus?.status === 'offline' ? (
          <XCircle size={statusIconSize} color="var(--nd-card-bg)" fill={statusColor} style={{ borderRadius: '50%', opacity: 0.6 }} />
        ) : (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nd-text-dimmed)', opacity: 0.3 }} />
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
          if (editMode || demoMode) {
            e.preventDefault();
          }
        }}
        title={demoMode ? t("Lien simulé dans la démonstration publique") : undefined}
      >
        <div className="nd-service-icon">
          {logoContent}
        </div>
        
        {!isLogoOnly && (
          showUrl && service.localUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
              <span className="nd-service-name">{service.name}</span>
              {showPingText && delayedStatus ? (
                <span className="nd-service-url">
                  {delayedStatus.status === 'online' ? 'OK' : t(delayedStatus.statusText)} - {delayedStatus.latency}ms
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

      {(service.secondaryUrl || service.tailscaleUrl) && !editMode && !demoMode && (
        <div className="nd-service-tooltip-wrapper">
          <a href={service.secondaryUrl || service.tailscaleUrl} target="_blank" rel="noopener noreferrer" className="nd-service-tooltip" title={t("Lien Secondaire")}>
            <div className="nd-service-tooltip-icon">
              {service.secondaryLogo ? (
                <img src={service.secondaryLogo} alt={t("Lien secondaire")} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling && ((e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block'); }} />
              ) : (
                <img src={service.logo || "/api/logos/logo-tailscale.png"} alt={t("Lien alternatif")} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling && ((e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block'); }} />
              )}
              <Globe size={14} style={{ display: 'none' }} />
            </div>
            <span className="nd-service-tooltip-text">{t("Ouvrir le lien secondaire")}</span>
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
