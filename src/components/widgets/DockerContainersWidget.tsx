'use client';

import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useConfig } from '@/hooks/useConfig';
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, Check, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed');
  return r.json();
});

export default function DockerContainersWidget({ editMode }: { editMode?: boolean }) {
  const { config } = useConfig();
  const hosts = config?.dockerHosts || [];

  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isScrollPaused, setIsScrollPaused] = useState(false);

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
  const { data: containers, error, isLoading } = useSWR(
    selectedHostId ? `/api/docker/${selectedHostId}/containers?all=true` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const currentHost = hosts.find(h => h.id === selectedHostId);
  const hideTitles = (config?.settings?.hideWidgetTitles ?? false) && !editMode;

  // Handle host change
  const handleHostChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedHostId(e.target.value);
    setCurrentPage(1); // Reset to first page
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

  // Container item renderer
  const renderContainerItem = (c: any, itemKey?: string) => {
    const containerName = c.names?.[0]?.replace(/^\//, '') || c.id.substring(0, 12);
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
      >
        {/* Left side: status icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: '60px', flex: '1 1 auto' }}>
          <div style={{ display: 'flex', flexShrink: 0 }}>
            {renderStatusIcon(c.state)}
          </div>
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
        </div>

        {/* Right side: status duration */}
        <div 
          style={{ 
            fontSize: '0.62rem', 
            color: 'var(--nd-text-muted)', 
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          {c.status}
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
        {/* Host Selector — stays left normally, wraps below at full width when compact */}
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.borderColor = 'var(--nd-accent)';
                }}
                onMouseLeave={(e) => {
                  if (!isDropdownOpen) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'var(--nd-card-border)';
                  }
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

              {/* Premium custom dropdown menu */}
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
                      onMouseEnter={(e) => {
                        if (selectedHostId !== h.id) {
                          e.currentTarget.style.background = 'rgba(128, 128, 128, 0.05)';
                          e.currentTarget.style.color = 'var(--nd-text)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedHostId !== h.id) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--nd-text-muted)';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{h.icon}</span>
                        <span>{h.name}</span>
                      </div>
                      {selectedHostId === h.id && <Check size={11} color="var(--nd-accent)" />}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            // Static styled label if only 1 host
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

        {/* Pagination Pill — stays right, floats above host when wrapped */}
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

  return (
    <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      
      {/* CSS keyframes for auto-scroll — injected once, GPU-accelerated, zero JS overhead */}
      {showAutoScroll && (
        <style>{`
          @keyframes nd-docker-scroll {
            0% { transform: translateY(0); }
            100% { transform: translateY(-50%); }
          }
        `}</style>
      )}

      {/* Title Header (Standard behavior, stays clean on top) */}
      {!hideTitles && (
        <div className="nd-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>🐳</span>
          <span>Conteneurs Docker</span>
        </div>
      )}

      {/* Controls Row (Separate from title, containing selector and pagination) */}
      {renderControlsRow()}

      {/* Containers List */}
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
            {/* Duplicate for seamless loop */}
            {containerList.map((c: any, idx: number) => renderContainerItem(c, `clone-${c.id}-${idx}`))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight, justifyContent: containerList.length === 0 ? 'center' : 'flex-start' }}>
          {isLoading && containerList.length === 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <Loader2 size={16} className="nd-spin" style={{ color: 'var(--nd-text-dimmed)' }} />
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <AlertCircle size={16} style={{ color: 'var(--nd-red)', marginBottom: 6 }} />
              <div style={{ fontSize: '0.7rem', color: 'var(--nd-red)', fontWeight: 600 }}>Hôte injoignable</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--nd-text-dimmed)', marginTop: 2 }}>Vérifiez l'API Docker TCP</div>
            </div>
          )}

          {!isLoading && !error && containerList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 8px', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
              Aucun conteneur trouvé.
            </div>
          )}

          {!error && paginatedContainers.map((c: any) => renderContainerItem(c))}
        </div>
      )}

    </div>
  );
}
