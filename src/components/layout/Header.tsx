'use client';

import { useState } from 'react';
import { Search, Pencil, Sun, Moon, Plus, X, Shield, Eye, EyeOff, Menu } from 'lucide-react';
import { TabId } from '@/hooks/useTabs';

interface HeaderProps {
  title: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  editMode: boolean;
  onToggleEdit: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onAddCategory: () => void;
  onAddSlot?: () => Promise<void> | void;
  secretMode: boolean;
  onToggleSecret?: () => void;
  activeTab?: TabId;
}

export default function Header({
  title,
  searchQuery,
  onSearchChange,
  editMode,
  onToggleEdit,
  isDark,
  onToggleTheme,
  onAddCategory,
  onAddSlot,
  secretMode,
  onToggleSecret,
  activeTab,
}: HeaderProps) {
  const isHome = !activeTab || activeTab === 'dashboard';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <>
      <header className="nd-header">
        {/* Brand — terminal style */}
        <div className="nd-brand pl-2 md:pl-0">
          <span className="nd-brand-dot" />
          <strong>{title}</strong>
        </div>

        {/* Search */}
        <div className="nd-search">
          <Search size={13} className="nd-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher..."
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nd-text-dimmed)',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Actions Desktop */}
        <div className="nd-header-actions nd-desktop-actions pr-2 md:pr-0">
          {editMode && isHome && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="nd-btn" onClick={onAddSlot} title="Ajouter un emplacement">
                <Plus size={12} />
                Emplacement
              </button>
              <button className="nd-btn" onClick={onAddCategory}>
                <Plus size={12} />
                Catégorie
              </button>
              <div style={{ width: 1, height: 16, background: 'var(--nd-border)', margin: '0 4px', alignSelf: 'center' }} />
            </div>
          )}
          <button
            className={`nd-btn ${!secretMode ? 'nd-btn-active' : ''}`}
            onClick={onToggleSecret}
            title={secretMode ? 'Masquer les informations sensibles' : 'Afficher les informations sensibles'}
          >
            {secretMode ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            className={`nd-btn ${editMode ? 'nd-btn-active' : ''}`}
            onClick={onToggleEdit}
            title={editMode ? 'Quitter le mode édition' : 'Mode édition'}
          >
            <Pencil size={14} />
          </button>
          <button className="nd-btn" onClick={onToggleTheme} title="Changer le thème">
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>

        {/* Actions Mobile (Burger) */}
        <div className="nd-header-actions nd-mobile-actions pr-2">
          <button className={`nd-btn ${mobileMenuOpen ? 'nd-btn-active' : ''}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <Menu size={16} />
          </button>
        </div>
      </header>

      {/* Mobile Menu & Edit Row Content */}
      {((editMode && isHome) || mobileMenuOpen) && (
        <div className="nd-mobile-actions" style={{
          flexDirection: 'column',
          gap: 12,
          padding: '0 20px 12px 20px',
          marginTop: '-4px',
          animation: 'nd-fade-in 0.2s',
          width: '100%'
        }}>
          {/* Top Row: Burger menu items */}
          {mobileMenuOpen && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className={`nd-btn ${!secretMode ? 'nd-btn-active' : ''}`} onClick={onToggleSecret}>
                {secretMode ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button className={`nd-btn ${editMode ? 'nd-btn-active' : ''}`} onClick={onToggleEdit}>
                <Pencil size={14} />
              </button>
              <button className="nd-btn" onClick={onToggleTheme}>
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
          )}

          {/* Bottom Row: Add buttons */}
          {editMode && isHome && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="nd-btn" onClick={onAddSlot} title="Ajouter un emplacement">
                <Plus size={12} />
                Emplacement
              </button>
              <button className="nd-btn" onClick={onAddCategory}>
                <Plus size={12} />
                Catégorie
              </button>
            </div>
          )}
        </div>
      )}

    </>
  );
}
