'use client';

import { useState, useEffect } from 'react';
import { Category } from '@/lib/types';
import { X, Trash2 } from 'lucide-react';

interface CategoryFormModalProps {
  category?: Category;
  onClose: () => void;
  onSave: (data: { title: string; emoji: string; isSecret: boolean }) => void;
  onDelete?: (id: string) => void;
  secretMode: boolean;
}

const EMOJI_CATEGORIES: Record<string, string[]> = {
  'Tech': ['🤖', '🖥️', '💻', '⌨️', '🖱️', '📱', '⌚', '🔋', '🔌', '💾'],
  'Cloud': ['☁️', '🌍', '🌐', '📡', '🛰️', '🔗', '🔒', '🔑', '🔐', '🛡️'],
  'Médias': ['🎬', '🎮', '🎵', '🎧', '📺', '🎸', '🎹', '🎤', '🎭', '🎪'],
  'Fichiers': ['📁', '📂', '📄', '📊', '📈', '📉', '🗂️', '🗃️', '💿', '📀'],
  'Outils': ['🔧', '🛠️', '⚙️', '🔨', '🧰', '🔩', '⚡', '💡', '🔬', '🔭'],
  'Dev': ['🐳', '🐙', '🦀', '🦊', '🐘', '🐍', '☕', '📦', '🚀', '🧪'],
  'Maison': ['🏠', '🏡', '🏢', '🏭', '🏗️', '📶', '📟', '📠', '🖨️', '📷'],
  'Divers': ['💼', '📋', '📌', '📍', '🏷️', '🔖', '🎯', '✨', '⭐', '🔔']
};

export default function CategoryFormModal({ category, onClose, onSave, onDelete, secretMode }: CategoryFormModalProps) {
  const [title, setTitle] = useState(category?.title || '');
  const [emoji, setEmoji] = useState(category?.emoji || '📁');
  const [isSecret, setIsSecret] = useState(category?.isSecret || false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tech');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSave({ title, emoji, isSecret });
  };

  return (
    <div className="nd-modal-overlay" onClick={onClose}>
      <div className="nd-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700 }}>{category ? 'Modifier' : 'Ajouter'} une catégorie</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nd-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="nd-label">Nom</label>
            <input className="nd-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Médias" />
          </div>

          <div>
            <label className="nd-label">Emoji</label>
            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {Object.keys(EMOJI_CATEGORIES).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    fontSize: '0.65rem',
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    background: selectedCategory === cat ? 'var(--nd-accent)' : 'var(--nd-bg-alt)',
                    color: selectedCategory === cat ? 'var(--nd-bg)' : 'var(--nd-text-muted)',
                    fontWeight: selectedCategory === cat ? 600 : 400,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
            {/* Emoji grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {EMOJI_CATEGORIES[selectedCategory].map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  style={{
                    width: 32, height: 32, borderRadius: 6, fontSize: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', border: 'none',
                    background: emoji === e ? 'var(--nd-accent-glow)' : 'transparent',
                    outline: emoji === e ? '2px solid var(--nd-accent)' : 'none',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Secret checkbox — ONLY visible when secret mode is active */}
          {secretMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
              <input
                type="checkbox"
                id="secret-check"
                checked={isSecret}
                onChange={(e) => setIsSecret(e.target.checked)}
                style={{ accentColor: 'var(--nd-red)' }}
              />
              <label htmlFor="secret-check" style={{ fontSize: '0.75rem', color: 'var(--nd-red)', fontWeight: 600 }}>
                🔒 Section Secrète
              </label>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          {category && onDelete ? (
            <button className="nd-btn" onClick={() => onDelete(category.id)} style={{ color: 'var(--nd-red)' }}>
              <Trash2 size={12} /> Supprimer
            </button>
          ) : <div />}
          <button className="nd-btn nd-btn-accent" onClick={handleSubmit}>
            {category ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}
