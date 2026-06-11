'use client';

import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useConfig } from '@/hooks/useConfig';
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, Check, CheckCircle2, XCircle, AlertCircle, Play, Square, RefreshCw } from 'lucide-react';
import { useWidgetSize } from './WidgetContainer';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed');
  return r.json();
});

export default function DockerContainersWidget({ editMode }: { editMode?: boolean }) {
  const { config } = useConfig();
  const { size: widgetSize } = useWidgetSize();
  const hosts = config?.dockerHosts || [];

  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isScrollPaused, setIsScrollPaused] = useState(false);
  const [actionRunning, setActionRunning] = useState<Record<string, boolean>>({});

  const widgetStyle = config?.settings?.dockerContainersStyle || 'standard';
  const autoScroll = config?.settings?.dockerContainersAutoScroll ?? false;

  let ITEMS_PER_PAGE = 5;
  if (widgetStyle === 'extended') ITEMS_PER_PAGE = 8;
  else if (widgetStyle === 'minimalist') ITEMS_PER_PAGE = 3;

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch containers list for the selected host
  const { data: containers, error, isLoading, mutate } = useSWR(
    selectedHostId ? `/api/docker/${selectedHostId}/containers?all=true` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const currentHost = hosts.find(h => h.id === selectedHostId);
  const hideTitles = (config?.settings?.hideWidgetTitles ?? false) && !editMode;

  // Handle toggling container start/stop
  const handleToggleContainer = async (containerId: string, currentState: string) => {
    if (editMode) return;
    setActionRunning(prev => ({ ...prev, [containerId]: true }));
    try {
      const action = currentState === 'running' ? 'stop' : 'start';
      await fetch(`/api/docker/${selectedHostId}/containers/${containerId}?action=${action}`, { method: 'POST' });
      await mutate(); // Refresh list immediately
    } catch (e) {
      console.error('Failed to change container state:', e);
    } finally {
      setActionRunning(prev => ({ ...prev, [containerId]: false }));
    }
  };

  // CSS animation duration for auto-scroll (calculated based on container count)
  const scrollItemCount = Array.isArray(containers) ? containers.length : 0;
  // ~4 seconds per item for a slow, smooth scroll
  const scrollDuration = Math.max(20, scrollItemCount * 4);

  if (hosts.length === 0) {
    return (
      <div className="nd-sidebar-card nd-animate-in" style={{ padding: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--nd-text-muted)', margin: 0 }}>
          Aucun hôte Docker configuré.
        </p>
      </div>
    );
  }

  // Pagination calculation
  const containerList = Array.isArray(containers) ? containers : [];
  const totalPages = Math.max(1, Math.ceil(containerList.length / ITEMS_PER_PAGE));
  
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: '0.62rem', color: 'var(--nd-text-muted)', whiteSpace: 'nowrap' }}>
            {c.status}
          </span>
          {!editMode && (
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
              title={isRunning ? 'Arrêter' : 'Démarrer'}
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
    const showPagination = !error && containerList.length > ITEMS_PER_PAGE && !autoScroll;
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
              <span>{activeHost.icon}</span>
              <span>Hôte : {activeHost.name}</span>
            </div>
          )}
        </div>

        {/* Pagination Pill */}
        {showPagination && (
          <div style={{
            marginLeft: 'auto',
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
        )}
      </div>
    );
  };

  const minHeight = widgetStyle === 'minimalist' ? 110 : widgetStyle === 'extended' ? 290 : 180;
  const showAutoScroll = autoScroll && containerList.length > ITEMS_PER_PAGE;

  // ==================== MAIN RENDER ====================
  return (
    <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {showAutoScroll && (
        <style>{`
          @keyframes nd-docker-scroll {
            0% { transform: translateY(0); }
            100% { transform: translateY(-50%); }
          }
        `}</style>
      )}

      {/* Header */}
      {!hideTitles && (
        <div className="nd-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>🐳</span>
          <span>Conteneurs Docker</span>
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
          <AlertCircle size={20} style={{ color: 'var(--nd-red)', marginBottom: 6 }} />
          <div style={{ fontSize: '0.75rem', color: 'var(--nd-red)', fontWeight: 600 }}>Hôte injoignable</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--nd-text-dimmed)', marginTop: 2 }}>Vérifiez la connexion TCP de l'hôte</div>
        </div>
      )}

      {!isLoading && !error && containerList.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 8px', fontSize: '0.7rem', color: 'var(--nd-text-muted)', height: minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Aucun conteneur trouvé sur cet hôte.
        </div>
      )}

      {/* WIDE Layout: Full Tabular Grid View */}
      {widgetSize === 'wide' && !error && containerList.length > 0 && (
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--nd-border)', color: 'var(--nd-text-muted)' }}>
                <th style={{ padding: '8px 10px', fontWeight: 600 }}>Nom</th>
                <th style={{ padding: '8px 10px', fontWeight: 600 }}>Image</th>
                <th style={{ padding: '8px 10px', fontWeight: 600 }}>Statut</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
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
                    <td style={{ padding: '8px 10px', color: 'var(--nd-text-muted)' }}>
                      {c.status}
                    </td>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MEDIUM Layout: 2-Column Grid */}
      {widgetSize === 'medium' && !error && containerList.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {paginatedContainers.map((c: any) => renderContainerItem(c))}
        </div>
      )}

      {/* NARROW Layout: Vertical list / Auto Scroll */}
      {widgetSize === 'narrow' && !error && containerList.length > 0 && (
        <>
          {showAutoScroll ? (
            <div 
              onMouseEnter={() => setIsScrollPaused(true)}
              onMouseLeave={() => setIsScrollPaused(false)}
              style={{ 
                overflow: 'hidden', 
                height: `${ITEMS_PER_PAGE * 42}px`,
              }}
            >
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 6,
                animation: `nd-docker-scroll ${scrollDuration}s linear infinite`,
                animationPlayState: isScrollPaused ? 'paused' : 'running',
                willChange: 'transform',
              }}>
                {containerList.map((c: any, idx: number) => renderContainerItem(c, `first-${c.id}-${idx}`))}
                {containerList.map((c: any, idx: number) => renderContainerItem(c, `clone-${c.id}-${idx}`))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight, justifyContent: 'flex-start' }}>
              {paginatedContainers.map((c: any) => renderContainerItem(c))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
