import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';

export function TabsWidgetsTab() {
  const { config, updateConfig } = useConfig();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Widgets</h4>
        <p style={{ margin: '4px 0 12px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
          Affichez ou masquez les widgets actifs spécifiquement sur l'onglet Widgets. (Seuls les widgets activés dans Bibliothèque Globale sont listés).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <ToggleSwitch
              checked={!(config?.settings?.tabs?.widgets?.hideDevices)}
              onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, widgets: { ...config?.settings?.tabs?.widgets, hideDevices: !val } } })}
              label="🖥️ Appareils"
              sublabel="Afficher le widget"
            />
          </div>
          <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <ToggleSwitch
              checked={!(config?.settings?.tabs?.widgets?.hideQuickStats)}
              onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, widgets: { ...config?.settings?.tabs?.widgets, hideQuickStats: !val } } })}
              label="📊 Vue d'ensemble"
              sublabel="Afficher le widget"
            />
          </div>
          <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <ToggleSwitch
              checked={!(config?.settings?.tabs?.widgets?.hideTailscaleStatus)}
              onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, widgets: { ...config?.settings?.tabs?.widgets, hideTailscaleStatus: !val } } })}
              label="🛡️ VPN Tailscale"
              sublabel="Afficher le widget"
            />
          </div>
          <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <ToggleSwitch
              checked={!(config?.settings?.tabs?.widgets?.hideDockerActions)}
              onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, widgets: { ...config?.settings?.tabs?.widgets, hideDockerActions: !val } } })}
              label="🐳 Actions Docker"
              sublabel="Afficher le widget"
            />
          </div>
          <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <ToggleSwitch
              checked={!(config?.settings?.tabs?.widgets?.hideClock)}
              onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, widgets: { ...config?.settings?.tabs?.widgets, hideClock: !val } } })}
              label="⌚ Horloge"
              sublabel="Afficher le widget"
            />
          </div>
          <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <ToggleSwitch
              checked={!(config?.settings?.tabs?.widgets?.hideCalendar)}
              onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, widgets: { ...config?.settings?.tabs?.widgets, hideCalendar: !val } } })}
              label="📅 Calendrier"
              sublabel="Afficher le widget"
            />
          </div>
          <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <ToggleSwitch
              checked={!(config?.settings?.tabs?.widgets?.hideWeather)}
              onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, widgets: { ...config?.settings?.tabs?.widgets, hideWeather: !val } } })}
              label="☁️ Météo"
              sublabel="Afficher le widget"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
