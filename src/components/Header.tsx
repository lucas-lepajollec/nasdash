'use client';

import { Search, Pencil, Sun, Moon, Plus, X, Shield } from 'lucide-react';

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
  activeExtension?: string;
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
  activeExtension,
}: HeaderProps) {
  const isDashboard = !activeExtension || activeExtension === 'dashboard';
  return (
    <>
      <header className={`nd-header ${editMode && isDashboard ? 'nd-header--editing' : ''}`}>
        {/* Brand — terminal style */}
        <div className="nd-brand">
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

        {/* Actions */}
        <div className="nd-header-actions">
          {editMode && isDashboard && (
            <div className="nd-header-edit-row">
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
          <button
            className={`nd-btn ${editMode ? 'nd-btn-active' : ''}`}
            onClick={onToggleEdit}
            title={editMode ? 'Quitter le mode édition' : 'Mode édition'}
          >
            <Pencil size={14} />
          </button>
          <button className="nd-btn" onClick={onToggleTheme}>
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      {/* Secret mode banner */}
      {secretMode && (
        <div className="nd-secret-banner">
          <Shield size={13} />
          Mode Secret Activé
        </div>
      )}
    </>
  );
}
