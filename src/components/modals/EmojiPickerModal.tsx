'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Ban } from 'lucide-react';
import { EMOJI_CATEGORIES } from '@/lib/constants';

interface EmojiPickerModalProps {
  initialEmoji?: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  title?: string;
  allowNone?: boolean;
}

export default function EmojiPickerModal({ 
  initialEmoji, 
  onSelect, 
  onClose, 
  title = "Choisir une icône",
  allowNone = true
}: EmojiPickerModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(Object.keys(EMOJI_CATEGORIES)[0]);
  const [emoji, setEmoji] = useState(initialEmoji || '');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSelect = (e: string) => {
    setEmoji(e);
    onSelect(e);
    onClose();
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ zIndex: 10000 }}>
      <div className="nd-modal" onClick={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nd-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {allowNone && (
            <button 
              onClick={() => handleSelect('')}
              className="nd-btn" 
              style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: emoji === '' ? 'var(--nd-accent-glow)' : 'var(--nd-bg-alt)' }}
            >
              <Ban size={16} /> Aucun
            </button>
          )}

          <div>
            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
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
                  onClick={() => handleSelect(e)}
                  style={{
                    width: 36, height: 36, borderRadius: 'var(--nd-card-radius)', fontSize: '1.2rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', border: 'none',
                    background: emoji === e ? 'var(--nd-accent-glow)' : 'var(--nd-bg-alt)',
                    outline: emoji === e ? '2px solid var(--nd-accent)' : 'none',
                    transition: 'all 0.1s ease-in-out'
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
