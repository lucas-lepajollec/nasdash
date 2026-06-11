import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { WidgetLayoutConfig } from '../../shared/WidgetLayoutConfig';
import { WidgetDockerLayoutConfig } from '../../shared/WidgetDockerLayoutConfig';

export function DockerContainersWidgetTab() {
  const { config, updateConfig } = useConfig();
  const hideDockerContainers = config?.settings?.hideDockerContainers ?? true;
  const [dockerContainersStyle, setDockerContainersStyle] = useState<'standard' | 'extended' | 'minimalist'>(config?.settings?.dockerContainersStyle || 'standard');
    
  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <ToggleSwitch
          checked={!hideDockerContainers}
          onChange={(val) => handleToggleWidget('hideDockerContainers', !val)}
          label="Activer le widget Conteneurs Docker"
          sublabel="Affichage paginé de vos conteneurs Docker avec état en temps réel et durée de fonctionnement."
        />
      </div>

      {!hideDockerContainers && (
        <>
          <WidgetLayoutConfig widgetId="dockerContainers" />
          <WidgetDockerLayoutConfig widgetId="dockerContainers" />

          {/* Design & Style Configuration */}
          <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Design & Style</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
              Sélectionnez le style d'affichage et le nombre de conteneurs visibles.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { id: 'standard', name: 'Standard (5)', desc: '5 conteneurs par page' },
                { id: 'extended', name: 'Étendu (8)', desc: '8 conteneurs par page' },
                { id: 'minimalist', name: 'Minimaliste (3)', desc: '3 conteneurs par page' },
              ].map(styleOpt => (
                <button
                  key={styleOpt.id}
                  onClick={async () => {
                    setDockerContainersStyle(styleOpt.id as any);
                    await updateConfig({ dockerContainersStyle: styleOpt.id });
                  }}
                  style={{
                    padding: '12px', border: '1px solid',
                    borderColor: dockerContainersStyle === styleOpt.id ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                    background: dockerContainersStyle === styleOpt.id ? 'var(--nd-accent-glow)' : 'rgba(0,0,0,0.2)',
                    color: dockerContainersStyle === styleOpt.id ? 'var(--nd-accent)' : 'var(--nd-text)',
                    borderRadius: 'var(--nd-card-radius)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: dockerContainersStyle === styleOpt.id ? '0 0 8px var(--nd-accent-glow)' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 4 }}>{styleOpt.name}</div>
                  <div style={{ fontSize: '0.62rem', color: dockerContainersStyle === styleOpt.id ? 'inherit' : 'var(--nd-text-muted)', opacity: 0.8 }}>{styleOpt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Auto-scroll toggle */}
          <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <ToggleSwitch
              checked={config?.settings?.dockerContainersAutoScroll ?? false}
              onChange={async (val) => {
                await updateConfig({ dockerContainersAutoScroll: val });
              }}
              label="Défilement automatique"
              sublabel="Remplace la pagination par un défilement lent, continu et infini. Se met en pause au survol."
            />
          </div>
        </>
      )}
    </div>
  );
}
