'use client';

import { useState } from 'react';
import { Search, Pencil, Settings, Plus, X, Shield, Eye, EyeOff, Menu } from 'lucide-react';
import { TabId, TabDef } from '@/hooks/useTabs';

interface HeaderProps {
  title: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  editMode: boolean;
  onToggleEdit: () => void;
  onOpenSettings: () => void;
  onAddCategory: () => void;
  onAddSlot?: () => Promise<void> | void;
  secretMode: boolean;
  onToggleSecret?: () => void;
  activeTab?: TabId;
  tabs?: TabDef[];
  onSwitchTab?: (id: TabId) => void;
  onOpenTabManager?: () => void;
}

export default function Header({
  title,
  searchQuery,
  onSearchChange,
  editMode,
  onToggleEdit,
  onOpenSettings,
  onAddCategory,
  onAddSlot,
  secretMode,
  onToggleSecret,
  activeTab,
  tabs,
  onSwitchTab,
  onOpenTabManager,
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
          <button className="nd-btn" onClick={onOpenSettings} title="Paramètres globaux">
            <Settings size={14} />
          </button>
        </div>

        {/* Actions Mobile (Burger) */}
        <div className="nd-header-actions nd-mobile-actions pr-2">
          <button className={`nd-btn ${mobileMenuOpen ? 'nd-btn-active' : ''}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <Menu size={16} />
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="nd-mobile-menu-overlay"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 100,
            animation: 'nd-fade-in 0.2s',
          }}
        >
          <div
            className="nd-mobile-menu-content"
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 16, right: 16, left: 16,
              background: 'var(--nd-card-bg)',
              border: '1px solid var(--nd-card-border)',
              borderRadius: 'var(--nd-card-radius)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Menu</h3>
              <button className="nd-btn" onClick={() => setMobileMenuOpen(false)} style={{ padding: 8 }}>
                <X size={16} />
              </button>
            </div>

            {/* Tabs List */}
            {tabs && tabs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tabs.map(tab => {
                  const isActive = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      className={`nd-btn ${isActive ? 'nd-btn-active' : ''}`}
                      onClick={() => {
                        onSwitchTab?.(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      style={{ justifyContent: 'flex-start', padding: '12px 16px', width: '100%', border: isActive ? '1px solid var(--nd-accent)' : '1px solid transparent' }}
                    >
                      <span className="nd-dock-item-icon" style={{ marginRight: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: isActive ? 'var(--nd-accent)' : 'inherit', fontSize: '18px' }}>{tab.icon}</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>{tab.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ height: 1, background: 'var(--nd-border)', margin: '4px 0' }} />

            {/* Global Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 10 }}>
              <button className={`nd-btn ${!secretMode ? 'nd-btn-active' : ''}`} onClick={onToggleSecret} style={{ flexDirection: 'column', height: 'auto', padding: '16px 8px', gap: 8 }}>
                {secretMode ? <Eye size={20} /> : <EyeOff size={20} />}
                <span style={{ fontSize: '0.8rem' }}>{secretMode ? 'Cacher' : 'Visible'}</span>
              </button>
              <button className={`nd-btn ${editMode ? 'nd-btn-active' : ''}`} onClick={onToggleEdit} style={{ flexDirection: 'column', height: 'auto', padding: '16px 8px', gap: 8 }}>
                <Pencil size={20} />
                <span style={{ fontSize: '0.8rem' }}>Éditer</span>
              </button>
              <button className="nd-btn" onClick={() => { onOpenSettings(); setMobileMenuOpen(false); }} style={{ flexDirection: 'column', height: 'auto', padding: '16px 8px', gap: 8 }}>
                <Settings size={20} />
                <span style={{ fontSize: '0.8rem' }}>Paramètres</span>
              </button>
            </div>

            {/* Edit Mode Controls */}
            {editMode && (
              <>
                <div style={{ height: 1, background: 'var(--nd-border)', margin: '4px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {onOpenTabManager && (
                    <button className="nd-btn" onClick={() => { onOpenTabManager(); setMobileMenuOpen(false); }} style={{ width: '100%', padding: '12px', justifyContent: 'center' }}>
                      <Settings size={16} style={{ marginRight: 8 }} />
                      Gérer les onglets
                    </button>
                  )}
                  {isHome && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button className="nd-btn" onClick={() => { onAddSlot?.(); setMobileMenuOpen(false); }} style={{ justifyContent: 'center' }}>
                        <Plus size={14} style={{ marginRight: 6 }} /> Emplacement
                      </button>
                      <button className="nd-btn" onClick={() => { onAddCategory(); setMobileMenuOpen(false); }} style={{ justifyContent: 'center' }}>
                        <Plus size={14} style={{ marginRight: 6 }} /> Catégorie
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </>
  );
}
