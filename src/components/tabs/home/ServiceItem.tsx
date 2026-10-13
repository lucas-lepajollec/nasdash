'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowUpRight, Globe, GripVertical, CheckCircle2, XCircle } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Service } from '@/lib/types';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';

const actionLabel = (translatedAction: string, name: string) => `${translatedAction} ${name}`;

interface ServiceItemProps {
  service: Service;
  categoryId?: string;
  /** Distinguishes drag targets when one category is displayed by several widgets. */
  dndScope?: string;
  editMode?: boolean;
  showSensitive?: boolean;
  layout?: 'standard' | 'compact' | 'bento' | 'grid' | 'bento-logo-large' | 'bento-logo-medium' | 'bento-logo-small';
  index?: number;
  total?: number;
}

/** The host of an address, or the address itself when it cannot be parsed. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export default function ServiceItem({ service, categoryId, dndScope, editMode, showSensitive = false, layout = 'standard', index, total }: ServiceItemProps) {
  const { t } = useI18n();
  const [imgError, setImgError] = useState(false);
  const [secondaryIconFailed, setSecondaryIconFailed] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const tooltipRef = useRef<HTMLAnchorElement>(null);
  // The second way in (another address or a Tailscale link), offered on hover.
  const secondaryUrl = service.secondaryUrl || service.tailscaleUrl;
  const secondaryIcon = service.secondaryLogo || (service.tailscaleUrl && !service.secondaryUrl ? '/api/logos/logo-tailscale.png' : service.logo);
  const { config, pingResults } = useConfig();
  const demoMode = config?.demoMode === true;
  const canOpenSecondary = Boolean(secondaryUrl) && !editMode && !demoMode;

  const pingIndicatorMode = config?.settings?.pingIndicatorMode || 'all';
  const showUrl = layout !== 'compact' && layout !== 'grid' && layout !== 'bento' && !layout?.startsWith('bento-logo');
  const showPingText = showUrl && config?.settings?.showPingDetails;
  const secondaryStatus = secondaryUrl ? pingResults[secondaryUrl] : undefined;

  // A mouse click can keep focus on the link after returning from another tab.
  // Close the bubble on departure; only a fresh hover or keyboard focus opens it.
  useEffect(() => {
    if (!secondaryOpen) return;
    const close = () => setSecondaryOpen(false);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') close();
    };
    window.addEventListener('blur', close);
    window.addEventListener('pagehide', close);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', close);
      window.removeEventListener('pagehide', close);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [secondaryOpen]);

  useEffect(() => {
    if (!secondaryOpen) return;
    const align = () => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      tooltip.style.left = '50%';
      const rect = tooltip.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const shift = rect.left < 8 ? 8 - rect.left : rect.right > width - 8 ? width - 8 - rect.right : 0;
      tooltip.style.left = `calc(50% + ${shift}px)`;
    };
    align();
    window.addEventListener('resize', align);
    return () => window.removeEventListener('resize', align);
  }, [secondaryOpen]);

  const pingText = (status: typeof secondaryStatus) => status
    ? `${status.status === 'online' ? (status.selfSigned ? t('ping.selfSigned') : 'OK') : t(status.statusText)} - ${status.latency}ms`
    : t('Chargement…');

  const [delayedStatus, setDelayedStatus] = useState<{ status: string; statusText: string; latency: number; selfSigned?: boolean } | null>(null);

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
    id: `drag-srv-${dndScope ? `${dndScope}-` : ''}${service.id}`,
    data: { type: 'service', service, categoryId },
    disabled: !editMode || !categoryId,
  });

  const { setNodeRef: setDroppable, isOver } = useDroppable({
    id: `drop-srv-${dndScope ? `${dndScope}-` : ''}${service.id}`,
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
  const statusColor = delayedStatus?.status === 'online' ? 'var(--nd-green)' : (delayedStatus?.status === 'offline' ? 'var(--nd-red)' : 'var(--nd-text-dimmed)');

  // Opaque: with background blur the card colour is translucent, and a
  // translucent mark would show the blurred wallpaper through it.
  const markColor = 'rgb(var(--nd-card-bg-rgb, 22, 27, 34))';

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
          <CheckCircle2 size={statusIconSize} color={markColor} fill={statusColor} style={{ borderRadius: '50%', opacity: 0.45 }} />
        ) : delayedStatus?.status === 'offline' ? (
          <XCircle size={statusIconSize} color={markColor} fill={statusColor} style={{ borderRadius: '50%', opacity: 0.6 }} />
        ) : (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nd-text-dimmed)', opacity: 0.3 }} />
        )}
      </div>
    );
  };


  return (
    <div ref={setNodeRef} data-service-id={service.id} data-secondary-open={secondaryOpen} className={`nd-service nd-service--${activeLayout}`}
      onPointerEnter={event => { if (canOpenSecondary && event.pointerType !== 'touch') setSecondaryOpen(true); }}
      onPointerMove={event => { if (canOpenSecondary && event.pointerType !== 'touch') setSecondaryOpen(true); }}
      onPointerLeave={event => { if (!event.currentTarget.querySelector(':focus-visible')) setSecondaryOpen(false); }}
      onFocusCapture={event => { if (canOpenSecondary && event.target.matches(':focus-visible')) setSecondaryOpen(true); }}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSecondaryOpen(false); }}
      onKeyDown={event => { if (event.key === 'Escape') setSecondaryOpen(false); }}
      style={{
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
          setSecondaryOpen(false);
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
              {showPingText ? (
                <span className="nd-service-url">
                  {pingText(delayedStatus ?? undefined)}
                </span>
              ) : (
                <span className="nd-service-url">
                  {showSensitive ? hostOf(service.localUrl) : '•••'}
                </span>
              )}
            </div>
          ) : (
            <span className="nd-service-name">{service.name}</span>
          )
        )}
      </a>

      {renderStatusIndicator()}

      {secondaryUrl && !editMode && !demoMode && (
        <div className="nd-service-tooltip-wrapper">
          <a ref={tooltipRef} href={secondaryUrl} target="_blank" rel="noopener noreferrer" className="nd-service-tooltip" onClick={() => setSecondaryOpen(false)}>
            <span className="nd-service-tooltip-icon">
              {secondaryIcon && !secondaryIconFailed
                ? <img src={secondaryIcon} alt="" onError={() => setSecondaryIconFailed(true)} />
                : <Globe size={13} />}
            </span>
            <span className="nd-service-tooltip-text">
              <span className="nd-service-tooltip-label">{t('services.secondary.open')}</span>
              <span className="nd-service-tooltip-host">{config?.settings?.showPingDetails ? pingText(secondaryStatus) : (showSensitive ? hostOf(secondaryUrl) : '•••')}</span>
            </span>
            <ArrowUpRight size={12} className="nd-service-tooltip-arrow" aria-hidden="true" />
          </a>
        </div>
      )}

      {editMode && (
        <div className="nd-service-drag-handle" {...attributes} {...listeners} aria-label={actionLabel(t('Déplacer'), service.name)} style={{ cursor: 'grab', marginLeft: 'auto', paddingLeft: 8 }}>
          <GripVertical size={12} />
        </div>
      )}
    </div>
  );
}
