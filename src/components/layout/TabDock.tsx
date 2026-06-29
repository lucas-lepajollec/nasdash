'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TabDef, TabId } from '@/hooks/useTabs';
import { ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Eye, EyeOff, Settings } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { Emoji } from '../shared/Emoji';

interface TabDockProps {
  tabs: TabDef[];
  activeTab: TabId;
  onSwitch: (id: TabId) => void;
  position?: 'left' | 'right';
  editMode?: boolean;
  onTogglePosition?: () => void;
  hiddenIds?: string[];
  onOpenManager?: () => void;
}

export default function TabDock({ 
  tabs, 
  activeTab, 
  onSwitch, 
  position = 'left', 
  editMode, 
  onTogglePosition,
  hiddenIds = [],
  onOpenManager
}: TabDockProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { config } = useConfig();

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
          const resolvedIcon = config?.settings?.tabIcons?.[ext.id] || ext.icon;
          
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
                <span className="nd-dock-item-icon"><Emoji emoji={resolvedIcon} /></span>
                <span className="nd-dock-item-label">{ext.name}</span>
                {isActive && <span className="nd-dock-item-indicator" />}
              </button>

              {/* Edit Mode Controls removed, handled by TabManagerModal */}
            </div>
          );
        })}
      </div>

      {editMode && mobileOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', paddingBottom: 4, marginTop: 8 }}>
          <button 
            className="nd-btn" 
            onClick={() => setMobileOpen(false)}
            title="Fermer le dock"
            style={{ padding: '6px', width: 32, height: 32, borderRadius: 'var(--nd-card-radius)', justifyContent: 'center' }}
          >
            {position === 'left' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      )}
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
