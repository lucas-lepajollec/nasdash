'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Ban, Search } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { EMOJI_CATEGORIES } from '@/lib/constants';
import { Emoji, EMOJI_TO_LUCIDE, normalizeEmoji } from '../shared/Emoji';
import { useConfig } from '@/hooks/useConfig';

interface EmojiPickerModalProps {
  initialEmoji?: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  title?: string;
  allowNone?: boolean;
}

const ALL_EMOJIS = Object.keys(EMOJI_TO_LUCIDE);
const ALL_LUCIDE_ICONS = Object.values(EMOJI_TO_LUCIDE);

export default function EmojiPickerModal({ 
  initialEmoji, 
  onSelect, 
  onClose, 
  title,
  allowNone = true
}: EmojiPickerModalProps) {
  const { config } = useConfig();
  const emojiTheme = config?.settings?.emojiTheme || 'native';
  const isLucideActive = emojiTheme === 'lucide';
  
  const modalTitle = title || (isLucideActive ? "Choisir une icône" : "Choisir un émoji");
  
  const [searchQuery, setSearchQuery] = useState('');
  const [emoji, setEmoji] = useState(initialEmoji || '');

  // Filter Emojis semantically
  const filteredEmojis = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return ALL_EMOJIS;

    return ALL_EMOJIS.filter(e => {
      // 1. Direct char match
      if (e.includes(q)) return true;
      // 2. Semantic Lucide map name match
      const mapped = EMOJI_TO_LUCIDE[normalizeEmoji(e)];
      if (mapped && mapped.toLowerCase().includes(q)) return true;
      // 3. Category match
      for (const [cat, list] of Object.entries(EMOJI_CATEGORIES)) {
        if (cat.toLowerCase().includes(q) && list.includes(e)) return true;
      }
      return false;
    });
  }, [searchQuery]);

  // Filter Lucide icons
  const filteredLucideIcons = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return ALL_LUCIDE_ICONS;
    
    return ALL_LUCIDE_ICONS.filter(name => name.toLowerCase().includes(q));
  }, [searchQuery]);

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
      <div className="nd-modal" onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0, color: 'var(--nd-text)' }}>{modalTitle}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nd-text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Unified Search Input */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--nd-text-muted)' }} />
          <input
            type="text"
            placeholder={isLucideActive ? "Rechercher une icône (ex: server, cloud, home...)" : "Rechercher un émoji (ex: maison, dev, café...)"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: 36,
              paddingLeft: 32,
              paddingRight: 10,
              borderRadius: 10,
              border: '1px solid var(--nd-card-border)',
              background: 'var(--nd-subcard-bg)',
              color: 'var(--nd-text)',
              fontSize: '0.8rem',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            className="nd-input-focus"
            autoFocus
          />
        </div>

        {/* Scrollable grid area */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
          {allowNone && !searchQuery && (
            <button 
              onClick={() => handleSelect('')}
              className="nd-btn" 
              style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: emoji === '' ? 'var(--nd-accent-glow)' : 'var(--nd-subcard-bg)', border: '1px solid var(--nd-card-border)', borderRadius: '8px', fontSize: '0.8rem', flexShrink: 0 }}
            >
              <Ban size={14} /> Aucun
            </button>
          )}

          {/* Emojis View */}
          {!isLucideActive && filteredEmojis.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                🎨 Emojis disponibles ({filteredEmojis.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))', gap: 6 }}>
                {filteredEmojis.map((e) => {
                  const isSelected = emoji === e;
                  return (
                    <button
                      key={e}
                      onClick={() => handleSelect(e)}
                      style={{
                        width: 36, height: 36, borderRadius: '8px', fontSize: '1.2rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', border: '1px solid var(--nd-card-border)',
                        background: isSelected ? 'var(--nd-accent-glow)' : 'var(--nd-subcard-bg)',
                        outline: isSelected ? '1px solid var(--nd-accent)' : 'none',
                        transition: 'all 0.1s ease-in-out'
                      }}
                    >
                      <Emoji emoji={e} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lucide Icons View */}
          {isLucideActive && filteredLucideIcons.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                ✨ Icônes Vectorielles (Lucide) ({filteredLucideIcons.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))', gap: 6 }}>
                {filteredLucideIcons.map((name) => {
                  const iconKey = `lucide:${name}`;
                  const isSelected = emoji === iconKey;
                  const IconComp = (LucideIcons as any)[name];

                  if (!IconComp) return null;

                  return (
                    <button
                      key={name}
                      onClick={() => handleSelect(iconKey)}
                      title={name}
                      style={{
                        width: 36, height: 36, borderRadius: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', border: '1px solid var(--nd-card-border)',
                        background: isSelected ? 'var(--nd-accent-glow)' : 'var(--nd-subcard-bg)',
                        outline: isSelected ? '1px solid var(--nd-accent)' : 'none',
                        color: isSelected ? 'var(--nd-accent)' : 'var(--nd-text-muted)',
                        transition: 'all 0.1s ease-in-out'
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.color = 'var(--nd-text)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.color = 'var(--nd-text-muted)'; }}
                    >
                      <IconComp size={18} strokeWidth={2} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {((!isLucideActive && filteredEmojis.length === 0) || (isLucideActive && filteredLucideIcons.length === 0)) && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--nd-text-muted)', fontSize: '0.78rem' }}>
              Aucun élément ne correspond à votre recherche "{searchQuery}"
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
