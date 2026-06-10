import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { SettingsSection } from './SettingsSection';

interface WidgetLayoutConfigProps {
  widgetId: string;
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

export function WidgetLayoutConfig({ widgetId, isOpen: controlledIsOpen, onToggle: controlledOnToggle }: WidgetLayoutConfigProps) {
  const { config, updateConfig } = useConfig();
  const [localIsOpen, setLocalIsOpen] = useState(false);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : localIsOpen;
  const onToggle = controlledOnToggle || setLocalIsOpen;

  const sidebarKey = `${widgetId}Sidebar`;
  const orderKey = `${widgetId}Order`;

  const sidebarValue = (config?.settings as any)?.[sidebarKey] || 'right';
  const orderValue = (config?.settings as any)?.[orderKey] ?? 0;

  const handlePosition = async (position: 'left' | 'right' | 'bottom') => {
    await updateConfig({ [sidebarKey]: position });
  };

  const handleOrder = async (order: number) => {
    await updateConfig({ [orderKey]: order });
  };

  return (
    <SettingsSection 
      title="🏠 Paramètres Spécifiques (Home)"
      description="Disposition sur l'onglet Home"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: 600 }}>Panneau d'affichage</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['left', 'bottom', 'right'] as const).map((pos) => {
            const isSelected = sidebarValue === pos;
            const labels = { left: '👈 Barre Gauche', bottom: '👇 Panneau Inférieur', right: 'Barre Droite 👉' };
            return (
              <button
                key={pos}
                onClick={() => handlePosition(pos)}
                style={{
                  flex: 1, padding: '10px 14px', border: '1px solid',
                  borderColor: isSelected ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                  background: isSelected ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                  color: isSelected ? 'var(--nd-accent)' : 'var(--nd-text)',
                  borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: isSelected ? '0 0 8px var(--nd-accent-glow)' : 'none'
                }}
              >
                {labels[pos]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: 600 }}>Ordre de priorité verticale</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            onClick={() => handleOrder(Math.max(0, Number(orderValue) - 1))}
            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
          >
            -
          </button>
          <input
            type="number"
            className="nd-input"
            min="0"
            max="20"
            value={orderValue as number}
            onChange={(e) => handleOrder(Number(e.target.value))}
            style={{ flex: 1, height: '32px', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', borderRadius: 'var(--nd-card-radius)' }}
          />
          <button 
            onClick={() => handleOrder(Number(orderValue) + 1)}
            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
          >
            +
          </button>
        </div>
      </div>
    </SettingsSection>
  );
}
