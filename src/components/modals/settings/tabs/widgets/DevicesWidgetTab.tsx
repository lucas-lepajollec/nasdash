import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';

export function DevicesWidgetTab() {
  const { config, updateConfig } = useConfig();

  const hideDevices = !!config?.settings?.hideDevices;
  const devicesSidebar = config?.settings?.devicesSidebar || 'left';
  const devicesOrder = config?.settings?.devicesOrder ?? 0;

  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
  };

  const handleWidgetPosition = async (widgetKey: string, sidebar: 'left' | 'right') => {
    await updateConfig({ [`${widgetKey}Sidebar`]: sidebar });
  };

  const handleWidgetOrder = async (widgetKey: string, order: number) => {
    await updateConfig({ [`${widgetKey}Order`]: order });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <ToggleSwitch
          checked={!hideDevices}
          onChange={(val) => handleToggleWidget('hideDevices', !val)}
          label="Activer le widget Appareils"
          sublabel="Choisissez si ce module de monitoring matériel doit s'afficher sur votre tableau de bord."
        />
      </div>

      {!hideDevices && (
        <>
          {/* Column Segment Selector */}
          <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Panneau d'affichage</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleWidgetPosition('devices', 'left')}
                style={{
                  flex: 1, padding: '10px 14px', border: '1px solid',
                  borderColor: devicesSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                  background: devicesSidebar === 'left' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                  color: devicesSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-text)',
                  borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: devicesSidebar === 'left' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                }}
              >
                👈 Barre Gauche
              </button>
              <button
                onClick={() => handleWidgetPosition('devices', 'right')}
                style={{
                  flex: 1, padding: '10px 14px', border: '1px solid',
                  borderColor: devicesSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                  background: devicesSidebar === 'right' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                  color: devicesSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-text)',
                  borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: devicesSidebar === 'right' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                }}
              >
                Barre Droite 👉
              </button>
            </div>
          </div>

          {/* Priority / Sorting Order */}
          <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Ordre de priorité verticale</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button 
                onClick={() => handleWidgetOrder('devices', Math.max(0, devicesOrder - 1))}
                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
              >
                -
              </button>
              <input
                type="number"
                className="nd-input"
                min="0"
                max="20"
                value={devicesOrder}
                onChange={(e) => handleWidgetOrder('devices', Number(e.target.value))}
                style={{ flex: 1, height: '32px', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', borderRadius: 'var(--nd-card-radius)' }}
              />
              <button 
                onClick={() => handleWidgetOrder('devices', devicesOrder + 1)}
                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
              >
                +
              </button>
            </div>
          </div>

          {/* Future Options Note */}
          <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--nd-accent)', fontWeight: 600 }}>⚡ Évolutivité & Extensions</span>
            <p style={{ margin: 0, fontSize: '0.66rem', color: 'var(--nd-text-muted)', lineHeight: 1.4 }}>
              Ce sous-menu est conçu pour être extensible. Dans de futures versions, vous pourrez y configurer des capteurs matériels additionnels, lier des connexions API Proxmox multiples, ou masquer certains serveurs hors-ligne.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
