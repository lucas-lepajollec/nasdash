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
}: HeaderProps) {
  return (
    <>
      <header className="nd-header">
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
            placeholder="Rechercher un service…"
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {editMode && (
            <>
              <button className="nd-btn" onClick={onAddSlot} title="Ajouter un emplacement vide">
                <Plus size={12} />
                Emplacement
              </button>
              <button className="nd-btn nd-btn-accent" onClick={onAddCategory}>
                <Plus size={12} />
                Catégorie
              </button>
            </>
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
