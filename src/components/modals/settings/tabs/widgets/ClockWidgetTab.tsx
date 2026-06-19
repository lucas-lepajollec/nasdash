import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { WidgetLayoutConfig } from '../../shared/WidgetLayoutConfig';
import { WidgetDockerLayoutConfig } from '../../shared/WidgetDockerLayoutConfig';
import { WidgetNetworksLayoutConfig } from '../../shared/WidgetNetworksLayoutConfig';
import CustomSelect from '../../../../shared/CustomSelect';

export function ClockWidgetTab() {
  const { config, updateConfig } = useConfig();

  const hideClock = !!config?.settings?.hideClock;
  const clockTimezone = config?.settings?.clockTimezone || '';
  const clockDesign = config?.settings?.clockDesign || 'default';

  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
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
          <WidgetLayoutConfig widgetId="clock" />
          <WidgetDockerLayoutConfig widgetId="clock" />
          <WidgetNetworksLayoutConfig widgetId="clock" />

          {/* Timezone Configuration */}
          <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Fuseau Horaire</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
              Spécifiez le fuseau horaire de l'horloge. Laissez vide pour utiliser l'heure locale.
            </p>
            <CustomSelect
              value={clockTimezone || ''}
              onChange={async (val) => {
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
