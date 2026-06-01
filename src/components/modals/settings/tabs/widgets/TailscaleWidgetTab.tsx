import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';

export function TailscaleWidgetTab() {
  const { config, updateConfig } = useConfig();

  const hideTailscaleStatus = !!config?.settings?.hideTailscaleStatus;
  const tailscaleSidebar = config?.settings?.tailscaleSidebar || 'right';
  const tailscaleOrder = config?.settings?.tailscaleOrder ?? 2;

  const [tailscaleTailnet, setTailscaleTailnet] = useState(config?.settings?.tailscaleTailnet || '');
  const [tailscaleClientId, setTailscaleClientId] = useState(config?.settings?.tailscaleClientId || '');
  const [tailscaleClientSecret, setTailscaleClientSecret] = useState(config?.settings?.tailscaleClientSecret ? '********' : '');

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
          checked={!hideTailscaleStatus}
          onChange={(val) => handleToggleWidget('hideTailscaleStatus', !val)}
          label="Activer le widget VPN Tailscale"
          sublabel="Choisissez si l'état général et la liste des machines Tailscale doivent s'afficher."
        />
      </div>

      {!hideTailscaleStatus && (
        <>
          <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Panneau d'affichage</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleWidgetPosition('tailscale', 'left')}
                style={{
                  flex: 1, padding: '10px 14px', border: '1px solid',
                  borderColor: tailscaleSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                  background: tailscaleSidebar === 'left' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                  color: tailscaleSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-text)',
                  borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: tailscaleSidebar === 'left' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                }}
              >
                👈 Barre Gauche
              </button>
              <button
                onClick={() => handleWidgetPosition('tailscale', 'right')}
                style={{
                  flex: 1, padding: '10px 14px', border: '1px solid',
                  borderColor: tailscaleSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                  background: tailscaleSidebar === 'right' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                  color: tailscaleSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-text)',
                  borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: tailscaleSidebar === 'right' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                }}
              >
                Barre Droite 👉
              </button>
            </div>
          </div>

          <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Ordre de priorité verticale</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button 
                onClick={() => handleWidgetOrder('tailscale', Math.max(0, tailscaleOrder - 1))}
                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
              >
                -
              </button>
              <input
                type="number"
                className="nd-input"
                min="0"
                max="20"
                value={tailscaleOrder}
                onChange={(e) => handleWidgetOrder('tailscale', Number(e.target.value))}
                style={{ flex: 1, height: '32px', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', borderRadius: 'var(--nd-card-radius)' }}
              />
              <button 
                onClick={() => handleWidgetOrder('tailscale', tailscaleOrder + 1)}
                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
              >
                +
              </button>
            </div>
          </div>

          <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Authentification API Tailscale</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
              Connectez votre compte Tailscale pour visualiser l'état de vos appareils directement sur le Dashboard.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                className="nd-input"
                placeholder="Nom du Tailnet (ex: email@domaine.com)"
                value={tailscaleTailnet}
                onChange={(e) => {
                  setTailscaleTailnet(e.target.value);
                  updateConfig({ tailscaleTailnet: e.target.value });
                }}
                style={{ fontSize: '0.75rem', padding: '10px 14px' }}
              />
              <input
                type="password"
                className="nd-input"
                placeholder="OAuth Client ID (kxxxx...)"
                value={tailscaleClientId}
                onChange={(e) => {
                  setTailscaleClientId(e.target.value);
                  updateConfig({ tailscaleClientId: e.target.value });
                }}
                style={{ fontSize: '0.75rem', padding: '10px 14px' }}
              />
              <input
                type="password"
                className="nd-input"
                placeholder="OAuth Client Secret (tskey-client-...)"
                value={tailscaleClientSecret}
                onChange={(e) => {
                  setTailscaleClientSecret(e.target.value);
                  updateConfig({ tailscaleClientSecret: e.target.value });
                }}
                style={{ fontSize: '0.75rem', padding: '10px 14px' }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
