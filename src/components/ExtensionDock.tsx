'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExtensionDef, ExtensionId } from '@/hooks/useExtension';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface ExtensionDockProps {
  extensions: ExtensionDef[];
  activeExtension: ExtensionId;
  onSwitch: (id: ExtensionId) => void;
  position?: 'left' | 'right';
  editMode?: boolean;
  onTogglePosition?: () => void;
}

export default function ExtensionDock({ extensions, activeExtension, onSwitch, position = 'left', editMode, onTogglePosition }: ExtensionDockProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ---- Desktop dock (rendered inline, no portal needed) ----
  const dockContent = (
    <nav
      className={`nd-dock nd-dock--${position} ${mobileOpen ? 'nd-dock--open' : ''}`}
      role="tablist"
      aria-label="Extensions"
    >
      <div className="nd-dock-items">
        {extensions.map((ext) => {
          const isActive = ext.id === activeExtension;
          return (
            <button
              key={ext.id}
              role="tab"
              aria-selected={isActive}
              aria-label={ext.name}
              className={`nd-dock-item ${isActive ? 'nd-dock-item--active' : ''}`}
              onClick={() => {
                onSwitch(ext.id);
                setMobileOpen(false);
              }}
              title={ext.name}
            >
              <span className="nd-dock-item-icon">{ext.icon}</span>
              <span className="nd-dock-item-label">{ext.name}</span>
              {isActive && <span className="nd-dock-item-indicator" />}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
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
        <div className="nd-dock-brand">
          <span>N</span>
        </div>
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
