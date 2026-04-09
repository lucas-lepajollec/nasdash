'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TabDef, TabId } from '@/hooks/useTabs';
import { ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';

interface TabDockProps {
  tabs: TabDef[];
  activeTab: TabId;
  onSwitch: (id: TabId) => void;
  position?: 'left' | 'right';
  editMode?: boolean;
  onTogglePosition?: () => void;
  hiddenIds?: string[];
  onToggleHidden?: (id: TabId) => void;
  onMove?: (id: TabId, direction: 'up' | 'down') => void;
}

export default function TabDock({ 
  tabs, 
  activeTab, 
  onSwitch, 
  position = 'left', 
  editMode, 
  onTogglePosition,
  hiddenIds = [],
  onToggleHidden,
  onMove
}: TabDockProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Filter out hidden tabs unless in edit mode
  const visibleTabs = editMode 
    ? tabs 
    : tabs.filter(ext => !hiddenIds.includes(ext.id));

  // ---- Desktop dock (rendered inline, no portal needed) ----
  const dockContent = (
    <nav
      className={`nd-dock nd-dock--${position} ${mobileOpen ? 'nd-dock--open' : ''} ${editMode ? 'nd-dock--editing' : ''}`}
      role="tablist"
      aria-label="Tabs"
    >
      <div className="nd-dock-items">
        {visibleTabs.map((ext, index) => {
          const isActive = ext.id === activeTab;
          const isHidden = hiddenIds.includes(ext.id);
          
          return (
            <div key={ext.id} className="nd-dock-item-wrapper">
              <button
                role="tab"
                aria-selected={isActive}
                aria-label={ext.name}
                className={`nd-dock-item ${isActive ? 'nd-dock-item--active' : ''} ${isHidden ? 'nd-dock-item--hidden' : ''}`}
                onClick={() => {
                  onSwitch(ext.id);
                  setMobileOpen(false);
                }}
                disabled={isHidden && !editMode}
                title={ext.name}
              >
                <span className="nd-dock-item-icon">{ext.icon}</span>
                <span className="nd-dock-item-label">{ext.name}</span>
                {isActive && <span className="nd-dock-item-indicator" />}
              </button>

              {/* Edit Mode Controls */}
              {editMode && (
                <div className="nd-dock-edit-controls animate-in fade-in slide-in-from-left-2">
                  {onToggleHidden && (
                    <button 
                      onClick={() => onToggleHidden(ext.id)} 
                      className="nd-dock-edit-btn"
                      title={isHidden ? "Afficher" : "Masquer"}
                    >
                      {isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                  )}
                  {onMove && index > 0 && (
                    <button onClick={() => onMove(ext.id, 'up')} className="nd-dock-edit-btn" title="Monter">
                      <ArrowUp size={12} />
                    </button>
                  )}
                  {onMove && index < visibleTabs.length - 1 && (
                    <button onClick={() => onMove(ext.id, 'down')} className="nd-dock-edit-btn" title="Descendre">
                      <ArrowDown size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', paddingBottom: 10, marginTop: editMode ? 20 : 0 }}>
        {editMode && mobileOpen && (
          <button 
            className="nd-btn" 
            onClick={() => setMobileOpen(false)}
            title="Fermer le dock"
            style={{ padding: '6px', width: 32, height: 32, borderRadius: '50%', justifyContent: 'center' }}
          >
            {position === 'left' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        {editMode && onTogglePosition && (
          <button 
            className="nd-btn" 
            onClick={onTogglePosition}
            title={position === 'left' ? 'Déplacer à droite' : 'Déplacer à gauche'}
            style={{ padding: '6px', width: 32, height: 32, borderRadius: '50%', justifyContent: 'center' }}
          >
            {position === 'left' ? '→' : '←'}
          </button>
        )}
      </div>
    </nav>
  );

  // ---- Mobile elements: single portal with strict DOM order ----
  // Overlay FIRST, then button, then dock — later = on top
  const mobilePortal = mounted ? createPortal(
    <div className="nd-dock-portal">
      {/* 1. Overlay — lowest layer */}
      {mobileOpen && (
        <div 
          className="nd-dock-overlay" 
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 2. Toggle button — above overlay */}
      <button 
        className={`nd-dock-mobile-btn ${mobileOpen ? 'nd-dock-mobile-btn--open' : ''} nd-dock-mobile-btn--${position}`}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      >
        {position === 'left' ? 
          (mobileOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />) : 
          (mobileOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />)
        }
      </button>

      {/* 3. Dock — topmost layer */}
      {dockContent}
    </div>,
    document.body
  ) : null;

  return <>{mobilePortal}</>;
}
