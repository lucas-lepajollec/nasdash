import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { CustomTabWidgetInfo } from '@/lib/types';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';
import { useConfig } from '@/hooks/useConfig';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';

interface WidgetSelectionModalProps {
  onClose: () => void;
  onSelect: (widget: CustomTabWidgetInfo) => void;
}

export function WidgetSelectionModal({ onClose, onSelect }: WidgetSelectionModalProps) {
  const [activeFilter, setActiveFilter] = useState('all');
  const { config } = useConfig();
  const dialogRef = useDialogAccessibility(onClose);

  const availableWidgets = [
    ...WIDGET_REGISTRY.filter(w => {
      const keys = getWidgetConfigKeys(w.id);
      const isGloballyHidden = (config?.settings as any)?.[keys.hide] ?? w.defaultHidden;
      return !isGloballyHidden;
    }).map(w => ({
      id: w.id,
      name: w.name,
      icon: w.icon,
      desc: w.description,
      category: w.category === 'Raccourci' ? 'Système' : w.category,
      color: w.color,
      bg: w.bg
    })),
    { 
      id: 'spacer', 
      name: 'Espace Vide', 
      icon: '⏹️', 
      desc: 'Ajoute un espace vertical réglable pour aérer la mise en page.', 
      category: 'Gadget', 
      color: 'var(--nd-accent)', 
      bg: 'var(--nd-accent-glow)' 
    }
  ];

  const filteredWidgets = activeFilter === 'all' 
    ? availableWidgets 
    : availableWidgets.filter(w => w.category === activeFilter);

  const categories = [
    { id: 'all', label: 'Tous', count: availableWidgets.length },
    { id: 'Système', label: 'Système', count: availableWidgets.filter(w => w.category === 'Système').length },
    { id: 'Réseau', label: 'Réseau', count: availableWidgets.filter(w => w.category === 'Réseau').length },
    { id: 'Gadget', label: 'Gadgets & Espace', count: availableWidgets.filter(w => w.category === 'Gadget').length },
  ];

  return createPortal(
    <div 
      className="nd-modal-overlay" 
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ zIndex: 9999999 }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .nd-wlib-card {
          transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s, transform 0.2s;
        }
        .nd-wlib-card:hover {
          transform: translateY(-2px);
          background-color: rgba(255, 255, 255, 0.025) !important;
        }
        .nd-wlib-card:active {
          transform: scale(0.98) !important;
        }
        .nd-wlib-filters::-webkit-scrollbar {
          display: none;
        }
      `}} />

      {/* Modal — uses same nd-modal base + nd-animate-in */}
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Bibliothèque de widgets"
        tabIndex={-1}
        className="nd-modal nd-animate-in" 
        onClick={e => e.stopPropagation()}
        style={{ 
          maxWidth: '560px', 
          maxHeight: '85svh',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '16px 20px', 
          borderBottom: '1px solid var(--nd-card-border)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexShrink: 0
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, letterSpacing: -0.2, color: 'var(--nd-text)' }}>
              Bibliothèque de Widgets
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.65rem', color: 'var(--nd-text-muted)' }}>
              Choisissez le widget à rajouter.
            </p>
          </div>
          <button 
            aria-label="Fermer"
            onClick={onClose} 
            style={{ 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid var(--nd-card-border)', 
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--nd-text-muted)', 
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--nd-text)';
              e.currentTarget.style.borderColor = 'var(--nd-card-hover-border)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--nd-text-muted)';
              e.currentTarget.style.borderColor = 'var(--nd-card-border)';
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div 
          className="nd-wlib-filters"
          style={{ 
            display: 'flex', 
            gap: '6px', 
            padding: '10px 20px', 
            background: 'rgba(0,0,0,0.12)', 
            borderBottom: '1px solid var(--nd-card-border)',
            flexShrink: 0,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none'
          }}
        >
          {categories.map(cat => {
            const isSelected = activeFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveFilter(cat.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--nd-accent-dim)' : 'transparent',
                  background: isSelected ? 'var(--nd-accent-glow)' : 'transparent',
                  color: isSelected ? 'var(--nd-accent)' : 'var(--nd-text-muted)',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    e.currentTarget.style.color = 'var(--nd-text)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    e.currentTarget.style.color = 'var(--nd-text-muted)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {cat.label}
                <span 
                  style={{ 
                    fontSize: '0.58rem', 
                    background: isSelected ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255,255,255,0.05)', 
                    color: isSelected ? 'var(--nd-accent)' : 'var(--nd-text-dimmed)',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    fontWeight: 700
                  }}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Widgets List — scrollable */}
        <div 
          style={{ 
            padding: '16px', 
            display: 'flex',
            flexDirection: 'column',
            gap: '10px', 
            overflowY: 'auto',
            flex: 1
          }}
        >
          {filteredWidgets.map(w => {
            const isSpacer = w.id === 'spacer';
            return (
              <div
                key={w.id}
                onClick={() => onSelect({ type: w.id })}
                role="button"
                tabIndex={0}
                className="nd-wlib-card"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelect({ type: w.id });
                  }
                }}
                style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '14px',
                  padding: '14px 14px 14px 18px', 
                  background: 'rgba(255,255,255,0.01)', 
                  border: '1px solid var(--nd-card-border)',
                  borderRadius: '10px', 
                  cursor: 'pointer',
                  textAlign: 'left',
                  outline: 'none',
                  position: 'relative',
                  overflow: 'hidden',
                  userSelect: 'none',
                  flexShrink: 0
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = w.color;
                  e.currentTarget.style.boxShadow = `0 4px 14px -4px ${w.bg}, 0 0 8px -2px ${w.bg}`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--nd-card-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Accent Bar */}
                <div 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '3px',
                    height: '100%',
                    background: w.color,
                    opacity: 0.35
                  }}
                />

                {/* Icon */}
                <div 
                  style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '10px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: w.bg,
                    border: '1px solid rgba(255,255,255,0.03)',
                    color: w.color,
                    fontSize: '1.15rem',
                    flexShrink: 0
                  }}
                >
                  {isSpacer ? (
                    <div style={{ width: 16, height: 16, border: '2px dashed var(--nd-accent)', borderRadius: 3, opacity: 0.8 }} />
                  ) : (
                    w.icon
                  )}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--nd-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.name}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--nd-text-muted)', lineHeight: 1.4, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {w.desc}
                  </div>
                </div>

                {/* Category Badge */}
                <span 
                  style={{ 
                    flexShrink: 0,
                    fontSize: '0.52rem', 
                    textTransform: 'uppercase', 
                    letterSpacing: 0.4, 
                    color: w.color, 
                    background: w.bg, 
                    padding: '3px 7px', 
                    borderRadius: '4px', 
                    fontWeight: 700
                  }}
                >
                  {isSpacer ? 'Layout' : w.category}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
