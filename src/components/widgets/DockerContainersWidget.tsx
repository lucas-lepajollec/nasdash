'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import useSWR from 'swr';
import { useConfig } from '@/hooks/useConfig';
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, Check, CheckCircle2, XCircle, AlertCircle, Play, Square, RefreshCw, Pencil } from 'lucide-react';
import { useWidgetSize } from './WidgetContainer';
import { Emoji } from '../shared/Emoji';
import { dockerJsonFetcher, getDockerErrorPresentation } from '@/lib/dockerErrorContract';
import { useI18n } from '@/i18n/I18nProvider';

function getPaddedList(list: any[], targetMultiple: number) {
  if (list.length === 0) return [];
  let k = 1;
  while ((list.length * k) % targetMultiple !== 0 && k < 12) k++;
  const result = [];
  for (let i = 0; i < k; i++) {
    result.push(...list);
  }
  return result;
}

export default function DockerContainersWidget({ editMode, widgetInstanceId, widgetProps, onUpdateProps, isVisible = true }: { editMode?: boolean, widgetInstanceId?: string, widgetProps?: any, onUpdateProps?: (p: any) => void, isVisible?: boolean }) {
  const { t } = useI18n();
  const { config, showSecretSections } = useConfig();
  const { size: widgetSize } = useWidgetSize();
  const hosts = config?.dockerHosts || [];

  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isEditDropdownOpen, setIsEditDropdownOpen] = useState(false);
  const editDropdownRef = useRef<HTMLDivElement>(null);
  const [actionRunning, setActionRunning] = useState<Record<string, boolean>>({});
  const [isHovered, setIsHovered] = useState(false);

  const allowActions = config?.settings?.allowDockerActions ?? true;

  // Set default host ID when hosts load
  useEffect(() => {
    if (hosts.length > 0 && !selectedHostId) {
      setSelectedHostId(hosts[0].id);
    }
  }, [hosts, selectedHostId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (editDropdownRef.current && !editDropdownRef.current.contains(e.target as Node)) {
        setIsEditDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch containers list for the selected host
  const { data: containers, error, isLoading, mutate } = useSWR(
    isVisible && selectedHostId ? `/api/docker/${selectedHostId}/containers?all=true` : null,
    dockerJsonFetcher,
    { refreshInterval: 5000 }
  );

  const currentHost = hosts.find(h => h.id === selectedHostId);
  const hideTitles = (config?.settings?.hideWidgetTitles ?? false) && !editMode;
  const errorPresentation = getDockerErrorPresentation(error);

  // Handle toggling container start/stop
  const handleToggleContainer = async (containerId: string, currentState: string) => {
    if (editMode) return;
    setActionRunning(prev => ({ ...prev, [containerId]: true }));
    try {
      const action = currentState === 'running' ? 'stop' : 'start';
      const res = await fetch(`/api/docker/${selectedHostId}/containers/${containerId}?action=${action}`, { method: 'POST' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          alert(t("Action refusée. Session administrateur requise (veuillez vous connecter via le bouton Connexion en haut)."));
          return;
        }
        const data = await res.json();
        throw new Error(data.error || 'Action échouée');
      }
      await mutate();
    } catch (e) {
      console.error('Failed to change container state:', e);
    } finally {
      setActionRunning(prev => ({ ...prev, [containerId]: false }));
    }
  };

  // Pagination calculation
  const containerList = useMemo(() => {
    const rawList = Array.isArray(containers) ? containers : [];
    if (showSecretSections || !config?.categories) return rawList;

    const secretServiceNames = new Set<string>();
    config.categories.forEach(cat => {
      if (cat.isSecret) {
        cat.services.forEach(svc => {
          secretServiceNames.add(svc.name.toLowerCase().trim());
        });
      }
    });

    return rawList.filter((c: any) => {
      const isSecretContainer = (c.names || []).some((n: string) => {
        const name = n.replace(/^\//, '').toLowerCase().trim();
        return secretServiceNames.has(name);
      }) || secretServiceNames.has((c.names?.[0] || '').replace(/^\//, '').toLowerCase().trim());

      return !isSecretContainer;
    });
  }, [containers, config?.categories, showSecretSections]);

  if (hosts.length === 0) {
    return (
      <div className="nd-sidebar-card nd-animate-in" style={{ padding: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--nd-text-muted)', margin: 0 }}>
          {t("Aucun hôte Docker configuré.")}
        </p>
      </div>
    );
  }
  
  // Default to 6 items per page (even number for grids)
  let ITEMS_PER_PAGE = 6;

  const isGridInWideLayout = widgetSize === 'wide' && containerList.length > 5;
  if (isGridInWideLayout) {
    ITEMS_PER_PAGE = 10;
  }

  // Override from instance props if available
  let autoScroll = false;
  if (widgetProps?.autoScroll !== undefined) {
    autoScroll = widgetProps.autoScroll;
  }
  if (widgetProps?.itemsPerPage) {
    ITEMS_PER_PAGE = widgetProps.itemsPerPage === 'all' ? 9999 : parseInt(widgetProps.itemsPerPage, 10);
  }

  const totalPages = Math.max(1, Math.ceil(containerList.length / ITEMS_PER_PAGE));
  const effectiveAutoScroll = autoScroll && containerList.length > ITEMS_PER_PAGE;
  
  let scrollMultiple = 1;
  if (widgetSize === 'medium') scrollMultiple = 2;
  else if (widgetSize === 'wide') scrollMultiple = 12;

  const paddedList = effectiveAutoScroll ? getPaddedList(containerList, scrollMultiple) : containerList;

  // Safe page index guard
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const paginatedContainers = containerList.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Status icon mapper
  const renderStatusIcon = (state: string) => {
    switch (state) {
      case 'running':
        return (
          <CheckCircle2 
            size={14} 
            style={{ 
              color: 'var(--nd-green, #10b981)',
              filter: 'drop-shadow(0 0 2px rgba(16, 185, 129, 0.4))'
            }} 
          />
        );
      case 'exited':
      case 'dead':
        return (
          <XCircle 
            size={14} 
            style={{ 
              color: 'var(--nd-red, #ef4444)',
              filter: 'drop-shadow(0 0 2px rgba(239, 68, 68, 0.4))'
            }} 
          />
        );
      default:
        return (
          <AlertCircle 
            size={14} 
            style={{ 
              color: 'var(--nd-yellow, #f59e0b)',
              filter: 'drop-shadow(0 0 2px rgba(245, 158, 11, 0.4))'
            }} 
          />
        );
    }
  };

  // Container item renderer (for Narrow and Medium layouts)
  const renderContainerItem = (c: any, itemKey?: string) => {
    const containerName = c.names?.[0]?.replace(/^\//, '') || c.id.substring(0, 12);
    const isRunning = c.state === 'running';
    const isLoadingAction = !!actionRunning[c.id];

    return (
      <div
        key={itemKey || c.id}
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid var(--nd-card-border)',
          borderRadius: 'var(--nd-card-radius)',
          transition: 'all 0.2s',
          gap: '4px 8px'
        }}
        className="nd-weather-card-hover"
      >
        {/* Left side: status icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: '60px', flex: '1 1 auto' }}>
          <div style={{ display: 'flex', flexShrink: 0 }}>
            {renderStatusIcon(c.state)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span 
              style={{ 
                fontSize: '0.72rem', 
                fontWeight: 600, 
                color: 'var(--nd-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={containerName}
            >
              {containerName}
            </span>
            <span style={{ fontSize: '0.58rem', color: 'var(--nd-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.image.split('@')[0]}
            </span>
          </div>
        </div>

        {/* Right side: status duration + control action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: allowActions ? 8 : 12, flexShrink: 0 }}>
          <span style={{ fontSize: allowActions ? '0.62rem' : '0.68rem', color: allowActions ? 'var(--nd-text-muted)' : 'var(--nd-text-dimmed)', whiteSpace: 'nowrap', fontWeight: allowActions ? 'normal' : 500 }}>
            {c.status}
          </span>
          {allowActions && !editMode && (
            <button 
              onClick={() => handleToggleContainer(c.id, c.state)}
              disabled={isLoadingAction}
              style={{
                background: 'none',
                border: 'none',
                color: isRunning ? 'var(--nd-red)' : 'var(--nd-green)',
                cursor: isLoadingAction ? 'not-allowed' : 'pointer',
                opacity: isLoadingAction ? 0.4 : 0.7,
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center'
              }}
              title={isRunning ? t("Arrêter") : t("Démarrer")}
            >
              {isLoadingAction ? (
                <Loader2 size={12} className="nd-spin" />
              ) : isRunning ? (
                <Square size={10} fill="var(--nd-red)" />
              ) : (
                <Play size={10} fill="var(--nd-green)" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  // Controls Row: Host Selector on the left, Pagination on the right
  const renderControlsRow = () => {
    const showPagination = !error && containerList.length > ITEMS_PER_PAGE && !effectiveAutoScroll;
    const activeHost = hosts.find(h => h.id === selectedHostId) || hosts[0];

    if (!activeHost) return null;

    return (
      <div 
        style={{ 
          display: 'flex', 
          flexWrap: 'wrap-reverse',
          alignItems: 'center', 
          justifyContent: 'space-between', 
          width: '100%', 
          gap: '4px 8px',
          padding: '0 2px',
          marginBottom: 4
        }}
      >
        {/* Host Selector */}
        <div ref={dropdownRef} style={{ position: 'relative', flex: '1 1 auto', minWidth: 0 }}>
          {hosts.length > 1 ? (
            <>
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: isDropdownOpen ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid',
                  borderColor: isDropdownOpen ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                  borderRadius: '12px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: 'var(--nd-text)',
                  userSelect: 'none',
                  transition: 'all 0.2s',
                  width: '100%',
                  height: '26px',
                  boxSizing: 'border-box'
                }}
              >
                <span>{activeHost.icon}</span>
                <span style={{ flex: 1 }}>{activeHost.name}</span>
                <ChevronDown size={11} style={{ 
                  opacity: 0.6, 
                  marginLeft: 'auto',
                  flexShrink: 0,
                  transform: isDropdownOpen ? 'rotate(180deg)' : 'none', 
                  transition: 'transform 0.2s' 
                }} />
              </div>

              {isDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  background: 'var(--nd-bg-surface, #1e1e2e)',
                  border: '1px solid var(--nd-card-border)',
                  borderRadius: 'var(--nd-card-radius, 8px)',
                  boxShadow: 'var(--nd-dropdown-shadow, 0 4px 12px rgba(0,0,0,0.3))',
                  zIndex: 100,
                  minWidth: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '4px 0',
                  overflow: 'hidden',
                }}>
                  {hosts.map((h) => (
                    <div
                      key={h.id}
                      onClick={() => {
                        setSelectedHostId(h.id);
                        setCurrentPage(1);
                        setIsDropdownOpen(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: '0.68rem',
                        color: selectedHostId === h.id ? 'var(--nd-text)' : 'var(--nd-text-muted)',
                        background: selectedHostId === h.id ? 'rgba(128, 128, 128, 0.08)' : 'transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{h.icon}</span>
                        <span>{h.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.68rem',
              color: 'var(--nd-text-muted)',
              padding: '4px 0',
              fontWeight: 500
            }}>
              <span><Emoji emoji={activeHost.icon} /></span>
              <span>{t("Hôte :")} {activeHost.name}</span>
            </div>
          )}
        </div>

        {/* Pagination Pill */}
        {showPagination && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--nd-card-border)',
              borderRadius: '12px',
              padding: '0 6px',
              height: '26px',
              boxSizing: 'border-box',
              userSelect: 'none'
            }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={safePage === 1}
                style={{
                  background: 'none',
                  border: 'none',
                  color: safePage === 1 ? 'var(--nd-text-dimmed)' : 'var(--nd-text)',
                  cursor: safePage === 1 ? 'not-allowed' : 'pointer',
                  opacity: safePage === 1 ? 0.3 : 0.8,
                  padding: 1,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <ChevronLeft size={12} />
              </button>
              
              <span style={{ fontSize: '0.58rem', color: 'var(--nd-text-muted)', minWidth: 24, textAlign: 'center', fontWeight: 500 }}>
                {safePage}/{totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={safePage === totalPages}
                style={{
                  background: 'none',
                  border: 'none',
                  color: safePage === totalPages ? 'var(--nd-text-dimmed)' : 'var(--nd-text)',
                  cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: safePage === totalPages ? 0.3 : 0.8,
                  padding: 1,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const minHeight = 180;

  // ==================== MAIN RENDER ====================
  return (
    <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {effectiveAutoScroll && (
        <style>{`
          @keyframes nd-docker-scroll-narrow {
            0% { transform: translateY(0); }
            100% { transform: translateY(calc(-50% - 3px)); }
          }
          @keyframes nd-docker-scroll-grid {
            0% { transform: translateY(0); }
            100% { transform: translateY(calc(-50% - 4px)); }
          }
        `}</style>
      )}

      {/* Header */}
      {!hideTitles && (
        <div className="nd-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '1rem', lineHeight: 1, display: 'flex', alignItems: 'center' }}><Emoji emoji="🐳" /></span>
            <span>{t("Conteneurs Docker")}</span>
          </div>
          
          {editMode && widgetInstanceId && onUpdateProps && (
            <div ref={editDropdownRef} style={{ position: 'relative' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsEditDropdownOpen(!isEditDropdownOpen); }}
                className="nd-action-icon accent"
                title={t("Modifier la pagination de ce widget")}
              >
                <Pencil size={13} />
              </button>
              
              {isEditDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  background: 'var(--nd-bg-surface, #1e1e2e)',
                  border: '1px solid var(--nd-card-border)',
                  borderRadius: 'var(--nd-card-radius, 8px)',
                  boxShadow: 'var(--nd-dropdown-shadow, 0 4px 12px rgba(0,0,0,0.3))',
                  zIndex: 200,
                  minWidth: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '4px 0',
                  textTransform: 'none',
                  letterSpacing: 'normal'
                }}>
                  <div style={{ padding: '6px 12px', fontSize: '0.65rem', color: 'var(--nd-text-dimmed)', fontWeight: 600, borderBottom: '1px solid var(--nd-card-border)', marginBottom: 4 }}>
                    {t("ÉLÉMENTS PAR PAGE")}
                  </div>
                  {[
                    { label: t("Par défaut"), value: null },
                    { label: t("Tout afficher"), value: 'all' },
                    { label: t("4 par page"), value: 4 },
                    { label: t("6 par page"), value: 6 },
                    { label: t("8 par page"), value: 8 },
                    { label: t("12 par page"), value: 12 },
                    { label: t("16 par page"), value: 16 }
                  ].map(opt => (
                    <div
                      key={String(opt.value)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateProps({ itemsPerPage: opt.value });
                        setIsEditDropdownOpen(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: widgetProps?.itemsPerPage === opt.value || (!widgetProps?.itemsPerPage && opt.value === null) ? 'var(--nd-accent)' : 'var(--nd-text)',
                        background: widgetProps?.itemsPerPage === opt.value || (!widgetProps?.itemsPerPage && opt.value === null) ? 'rgba(var(--nd-accent-rgb, 128,128,128), 0.1)' : 'transparent',
                        fontWeight: 500
                      }}
                      className="nd-weather-card-hover"
                    >
                      {opt.label}
                      {(widgetProps?.itemsPerPage === opt.value || (!widgetProps?.itemsPerPage && opt.value === null)) && <Check size={12} />}
                    </div>
                  ))}

                  <div style={{ padding: '6px 12px', fontSize: '0.65rem', color: 'var(--nd-text-dimmed)', fontWeight: 600, borderBottom: '1px solid var(--nd-card-border)', marginTop: 4, marginBottom: 4 }}>
                    {t("DÉFILEMENT")}
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateProps({ autoScroll: !(widgetProps?.autoScroll ?? false) });
                      setIsEditDropdownOpen(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '0.72rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      color: widgetProps?.autoScroll ? 'var(--nd-accent)' : 'var(--nd-text)',
                      background: widgetProps?.autoScroll ? 'rgba(var(--nd-accent-rgb, 128,128,128), 0.1)' : 'transparent',
                      fontWeight: 500
                    }}
                    className="nd-weather-card-hover"
                  >
                    {t("Défilement automatique")}
                    {widgetProps?.autoScroll && <Check size={12} />}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Controls Selector */}
      {renderControlsRow()}

      {/* Loading state & Error state */}
      {isLoading && containerList.length === 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: minHeight }}>
          <Loader2 size={16} className="nd-spin" style={{ color: 'var(--nd-text-dimmed)' }} />
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '24px 8px', height: minHeight, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <AlertCircle size={20} style={{ color: errorPresentation.tone === 'warning' ? 'var(--nd-orange)' : 'var(--nd-red)', marginBottom: 6 }} />
          <div style={{ fontSize: '0.75rem', color: errorPresentation.tone === 'warning' ? 'var(--nd-orange)' : 'var(--nd-red)', fontWeight: 600 }}>{errorPresentation.title}</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--nd-text-dimmed)', marginTop: 2 }}>{errorPresentation.hint}</div>
        </div>
      )}

      {!isLoading && !error && containerList.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 8px', fontSize: '0.7rem', color: 'var(--nd-text-muted)', height: minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {t("Aucun conteneur trouvé sur cet hôte.")}
        </div>
      )}

      {/* WIDE Layout: Full Tabular Grid View or Card Grid */}
      {widgetSize === 'wide' && !error && containerList.length > 0 && (
        <div style={{ width: '100%' }}>
          {!isGridInWideLayout ? (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--nd-border)', color: 'var(--nd-text-muted)' }}>
                <th style={{ padding: '8px 10px', fontWeight: 600 }}>Nom</th>
                <th style={{ padding: '8px 10px', fontWeight: 600 }}>Image</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: allowActions ? 'left' : 'right' }}>Statut</th>
                {allowActions && <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedContainers.map((c: any) => {
                const containerName = c.names?.[0]?.replace(/^\//, '') || c.id.substring(0, 12);
                const isRunning = c.state === 'running';
                const isLoadingAction = !!actionRunning[c.id];
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', verticalAlign: 'middle' }} className="nd-weather-card-hover-table">
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {renderStatusIcon(c.state)}
                        <span>{containerName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--nd-text-muted)', fontSize: '0.65rem' }}>
                      {c.image.split('@')[0]}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--nd-text-muted)', textAlign: allowActions ? 'left' : 'right' }}>
                      {c.status}
                    </td>
                    {allowActions && (
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        {!editMode && (
                        <button 
                          onClick={() => handleToggleContainer(c.id, c.state)}
                          disabled={isLoadingAction}
                          style={{
                            background: isRunning ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                            border: `1px solid ${isRunning ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                            color: isRunning ? 'var(--nd-red)' : 'var(--nd-green)',
                            borderRadius: '6px',
                            cursor: isLoadingAction ? 'not-allowed' : 'pointer',
                            padding: '4px 10px',
                            fontSize: '0.62rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {isLoadingAction ? (
                            <Loader2 size={11} className="nd-spin" />
                          ) : isRunning ? (
                            <>
                              <Square size={9} fill="var(--nd-red)" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Play size={9} fill="var(--nd-green)" />
                              <span>Start</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          ) : (
            effectiveAutoScroll ? (
              <div 
                style={{ overflow: 'hidden', height: Math.ceil(ITEMS_PER_PAGE / 3) * 48 - 8, position: 'relative' }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', 
                  gap: 8, 
                  willChange: 'transform',
                  animation: `nd-docker-scroll-grid ${paddedList.length * 1}s linear infinite`,
                  animationPlayState: isHovered ? 'paused' : 'running'
                }}>
                  {paddedList.map((c: any, idx: number) => renderContainerItem(c, `first-${c.id}-${idx}`))}
                  {paddedList.map((c: any, idx: number) => renderContainerItem(c, `clone-${c.id}-${idx}`))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                {paginatedContainers.map((c: any) => renderContainerItem(c))}
              </div>
            )
          )}
        </div>
      )}

      {/* MEDIUM Layout: 2-Column Grid */}
      {widgetSize === 'medium' && !error && containerList.length > 0 && (
        effectiveAutoScroll ? (
          <div 
            style={{ overflow: 'hidden', height: Math.ceil(ITEMS_PER_PAGE / 2) * 48 - 8, position: 'relative' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: 8, 
              willChange: 'transform',
              animation: `nd-docker-scroll-grid ${paddedList.length * 1.5}s linear infinite`,
              animationPlayState: isHovered ? 'paused' : 'running'
            }}>
              {paddedList.map((c: any, idx: number) => renderContainerItem(c, `first-${c.id}-${idx}`))}
              {paddedList.map((c: any, idx: number) => renderContainerItem(c, `clone-${c.id}-${idx}`))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {paginatedContainers.map((c: any) => renderContainerItem(c))}
          </div>
        )
      )}

      {/* NARROW Layout: Vertical list */}
      {widgetSize === 'narrow' && !error && containerList.length > 0 && (
        effectiveAutoScroll ? (
          <div 
            style={{ overflow: 'hidden', height: ITEMS_PER_PAGE * 46 - 6, position: 'relative' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 6, 
              willChange: 'transform',
              animation: `nd-docker-scroll-narrow ${paddedList.length * 2.5}s linear infinite`,
              animationPlayState: isHovered ? 'paused' : 'running'
            }}>
              {paddedList.map((c: any, idx: number) => renderContainerItem(c, `first-${c.id}-${idx}`))}
              {paddedList.map((c: any, idx: number) => renderContainerItem(c, `clone-${c.id}-${idx}`))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-start' }}>
            {paginatedContainers.map((c: any) => renderContainerItem(c))}
          </div>
        )
      )}
    </div>
  );
}
