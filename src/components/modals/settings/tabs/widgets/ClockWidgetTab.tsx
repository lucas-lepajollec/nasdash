import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import CustomSelect from '../../../../shared/CustomSelect';

export function ClockWidgetTab() {
  const { config, updateConfig } = useConfig();

  const hideClock = !!config?.settings?.hideClock;
  const clockSidebar = config?.settings?.clockSidebar || 'right';
  const clockOrder = config?.settings?.clockOrder ?? 4;
  
  const [clockTimezone, setClockTimezone] = useState(config?.settings?.clockTimezone || '');
  const [clockDesign, setClockDesign] = useState<'default' | 'minimal' | 'glow' | 'split'>(config?.settings?.clockDesign || 'default');

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
          checked={!hideClock}
          onChange={(val) => handleToggleWidget('hideClock', !val)}
          label="Activer le widget Horloge / Date"
          sublabel="Choisissez si l'horloge doit s'afficher sur votre tableau de bord."
        />
      </div>

      {!hideClock && (
        <>
          {/* Column Segment Selector */}
          <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Panneau d'affichage</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleWidgetPosition('clock', 'left')}
                style={{
                  flex: 1, padding: '10px 14px', border: '1px solid',
                  borderColor: clockSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                  background: clockSidebar === 'left' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                  color: clockSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-text)',
                  borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: clockSidebar === 'left' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                }}
              >
                👈 Barre Gauche
              </button>
              <button
                onClick={() => handleWidgetPosition('clock', 'right')}
                style={{
                  flex: 1, padding: '10px 14px', border: '1px solid',
                  borderColor: clockSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                  background: clockSidebar === 'right' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                  color: clockSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-text)',
                  borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: clockSidebar === 'right' ? '0 0 8px var(--nd-accent-glow)' : 'none'
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
                onClick={() => handleWidgetOrder('clock', Math.max(-5, clockOrder - 1))}
                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
              >
                -
              </button>
              <input
                type="number"
                className="nd-input"
                min="-5"
                max="20"
                value={clockOrder}
                onChange={(e) => handleWidgetOrder('clock', Number(e.target.value))}
                style={{ flex: 1, height: '32px', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', borderRadius: 'var(--nd-card-radius)' }}
              />
              <button 
                onClick={() => handleWidgetOrder('clock', clockOrder + 1)}
                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
              >
                +
              </button>
            </div>
          </div>

          {/* Timezone Configuration */}
          <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Fuseau Horaire</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
              Spécifiez le fuseau horaire de l'horloge. Laissez vide pour utiliser l'heure locale.
            </p>
            <CustomSelect
              value={clockTimezone || ''}
              onChange={async (val) => {
                setClockTimezone(val);
                await updateConfig({ clockTimezone: val });
              }}
              options={[
                { value: '', label: '🏠 Heure locale (Défaut)' },
                ...(Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone').map(tz => ({
                  value: tz,
                  label: tz.replace('_', ' ')
                })) : [])
              ]}
            />
          </div>

          {/* Design Configuration */}
          <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Design & Style</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
              Sélectionnez l'apparence visuelle de l'horloge.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { id: 'default', name: 'Défaut', desc: 'Design classique et propre' },
                { id: 'minimal', name: 'Minimaliste', desc: 'Discret, texte seul' },
                { id: 'glow', name: 'Terminal', desc: 'Style ligne de commande minimaliste' },
                { id: 'split', name: 'Split Cards', desc: 'Boîtes séparées (style Flip)' }
              ].map(design => (
                <button
                  key={design.id}
                  onClick={async () => {
                    setClockDesign(design.id as any);
                    await updateConfig({ clockDesign: design.id });
                  }}
                  style={{
                    padding: '12px', border: '1px solid',
                    borderColor: clockDesign === design.id ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                    background: clockDesign === design.id ? 'var(--nd-accent-glow)' : 'rgba(0,0,0,0.2)',
                    color: clockDesign === design.id ? 'var(--nd-accent)' : 'var(--nd-text)',
                    borderRadius: 'var(--nd-card-radius)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: clockDesign === design.id ? '0 0 8px var(--nd-accent-glow)' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 4 }}>{design.name}</div>
                  <div style={{ fontSize: '0.62rem', color: clockDesign === design.id ? 'inherit' : 'var(--nd-text-muted)', opacity: 0.8 }}>{design.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
