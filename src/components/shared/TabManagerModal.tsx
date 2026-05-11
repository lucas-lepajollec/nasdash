'use client';

import React, { useEffect } from 'react';
import { X, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import { TabDef, TabId } from '@/hooks/useTabs';

interface TabManagerModalProps {
  tabs: TabDef[];
  hiddenIds: string[];
  onToggleHidden: (id: TabId) => void;
  onMove: (id: TabId, direction: 'up' | 'down') => void;
  onClose: () => void;
}

export default function TabManagerModal({
  tabs,
  hiddenIds,
  onToggleHidden,
  onMove,
  onClose,
}: TabManagerModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nd-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Gérer les onglets</h2>
          <button className="nd-btn" onClick={onClose} style={{ padding: 8 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tabs.map((ext, index) => {
            const isHidden = hiddenIds.includes(ext.id);
            return (
              <div 
                key={ext.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--nd-card-bg)',
                  border: '1px solid var(--nd-card-border)',
                  borderRadius: 'var(--nd-card-radius)',
                  opacity: isHidden ? 0.6 : 1
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="nd-dock-item-icon" style={{ fontSize: '18px', color: 'var(--nd-accent)' }}>{ext.icon}</span>
                  <span style={{ fontWeight: 500 }}>{ext.name}</span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button 
                    className={`nd-btn ${isHidden ? 'nd-btn-active' : ''}`}
                    onClick={() => onToggleHidden(ext.id)}
                    title={isHidden ? 'Afficher' : 'Masquer'}
                    style={{ padding: 6 }}
                  >
                    {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <div style={{ width: 1, height: 16, background: 'var(--nd-border)', margin: '0 4px' }} />
                  <button 
                    className="nd-btn" 
                    onClick={() => onMove(ext.id, 'up')}
                    disabled={index === 0}
                    style={{ padding: 6, opacity: index === 0 ? 0.3 : 1 }}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button 
                    className="nd-btn" 
                    onClick={() => onMove(ext.id, 'down')}
                    disabled={index === tabs.length - 1}
                    style={{ padding: 6, opacity: index === tabs.length - 1 ? 0.3 : 1 }}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
