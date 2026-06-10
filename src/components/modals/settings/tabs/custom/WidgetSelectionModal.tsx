import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { CustomTabWidgetInfo } from '@/lib/types';
import { WIDGET_REGISTRY } from '@/lib/widgetRegistry';

interface WidgetSelectionModalProps {
  onClose: () => void;
  onSelect: (widget: CustomTabWidgetInfo) => void;
}

export function WidgetSelectionModal({ onClose, onSelect }: WidgetSelectionModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const availableWidgets = [
    ...WIDGET_REGISTRY.map(w => ({
      id: w.id,
      name: w.name,
      icon: <div style={{ fontSize: '24px', lineHeight: 1 }}>{w.icon}</div>,
      desc: w.description
    })),
    { id: 'spacer', name: 'Espace Vide', icon: <div style={{width: 24, height: 24, border: '2px dashed var(--nd-accent)', borderRadius: 4}} />, desc: 'Espace vide ajustable.' }
  ];

  if (!mounted) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="nd-settings-card" style={{ position: 'relative', width: '100%', maxWidth: '500px', maxHeight: '90vh', background: 'var(--nd-bg)', borderRadius: '12px', border: '1px solid var(--nd-card-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--nd-card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Ajouter un widget</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--nd-text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px', overflowY: 'auto' }}>
          {availableWidgets.map(w => (
            <button
              key={w.id}
              onClick={() => onSelect({ type: w.id })}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                padding: '20px 12px', background: 'var(--nd-bg-alt)', border: '1px solid var(--nd-card-border)',
                borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--nd-accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--nd-card-border)'}
            >
              <div style={{ color: 'var(--nd-accent)' }}>{w.icon}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{w.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>{w.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
