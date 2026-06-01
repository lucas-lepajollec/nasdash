import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { Check, Clipboard } from 'lucide-react';

export function HomeAssistantTab() {
  const { config } = useConfig();
  const [copied, setCopied] = useState(false);

  const activePreset = {
    primaryColor: config?.settings?.theme === 'cyberpunk' ? '#ff007f' : (config?.settings?.theme === 'midnight' ? '#ffffff' : '#38bdf8'),
    accentColor: config?.settings?.theme === 'cyberpunk' ? '#00e5ff' : (config?.settings?.theme === 'midnight' ? '#ffffff' : '#38bdf8'),
    cardBg: config?.settings?.theme === 'cyberpunk' ? 'rgba(23, 0, 38, 0.65)' : (config?.settings?.theme === 'midnight' ? 'rgba(10, 10, 12, 0.85)' : 'rgba(15, 23, 42, 0.75)'),
    cardBorder: config?.settings?.theme === 'cyberpunk' ? 'rgba(0, 229, 255, 0.2)' : (config?.settings?.theme === 'midnight' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(56, 189, 248, 0.1)'),
    text: config?.settings?.theme === 'cyberpunk' ? '#f0e6ff' : (config?.settings?.theme === 'midnight' ? '#ffffff' : '#f8fafc'),
    textMuted: config?.settings?.theme === 'cyberpunk' ? '#00e5ff' : (config?.settings?.theme === 'midnight' ? '#e5e7eb' : '#38bdf8'),
    borderRadius: config?.settings?.theme === 'cyberpunk' ? 'var(--nd-card-radius)' : (config?.settings?.theme === 'midnight' ? '12px' : '12px'),
  };

  const haYamlTheme = `Nasdash-Dynamic:
  # Main Interface Colors
  primary-color: "${activePreset.primaryColor}"
  accent-color: "${activePreset.accentColor}"
  primary-background-color: "transparent"
  secondary-background-color: "transparent"

  # Card Design
  ha-card-background: "${activePreset.cardBg}"
  ha-card-border-radius: "${config?.settings?.borderRadius || 12}px"
  ha-card-border-color: "${activePreset.cardBorder}"
  ha-card-border-width: "1px"
  ha-card-box-shadow: "none"

  # Typography & Elements
  primary-text-color: "${activePreset.text}"
  secondary-text-color: "${activePreset.textMuted}"
  divider-color: "${activePreset.cardBorder}"

  # Sidebar Menu & Headers
  sidebar-background-color: "${activePreset.cardBg}"
  sidebar-icon-color: "${activePreset.textMuted}"
  sidebar-selected-icon-color: "${activePreset.primaryColor}"
  app-header-background-color: "${activePreset.cardBg}"
  app-header-text-color: "${activePreset.text}"`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(haYamlTheme);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      
      <div style={{ padding: '10px 12px', background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.15)', borderRadius: 'var(--nd-card-radius)' }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--nd-accent)', display: 'block', fontWeight: 600 }}>💡 Synchronisation visuelle Lovelace</span>
        <span style={{ fontSize: '0.68rem', color: 'var(--nd-text-muted)', marginTop: 4, display: 'block', lineHeight: 1.4 }}>
          Copiez le code YAML ci-dessous dans votre fichier <code style={{ color: 'var(--nd-text)', fontFamily: 'monospace' }}>themes.yaml</code> de Home Assistant. Vos cartes Lovelace et fonds s'adapteront harmonieusement au style graphique choisi ici !
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        <pre style={{
          background: 'rgba(0,0,0,0.35)', padding: '12px', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)',
          fontFamily: 'monospace', fontSize: '0.65rem', color: 'var(--nd-text)', overflowX: 'auto', maxHeight: '280px', margin: 0
        }}>
          {haYamlTheme}
        </pre>
        <button
          onClick={copyToClipboard}
          style={{
            position: 'absolute', top: 8, right: 8, padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.08)',
            border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.62rem'
          }}
        >
          {copied ? <Check size={10} style={{ color: 'var(--nd-green)' }} /> : <Clipboard size={10} />}
          {copied ? 'Copié !' : 'Copier'}
        </button>
      </div>

      <div className="nd-settings-card" style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--nd-accent)' }}>🧹 Note de compatibilité</h4>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.4 }}>
          Si vous avez des styles statiques forcés comme <code style={{ color: 'var(--nd-orange)' }}>background: #161b22 !important;</code> dans vos cartes HA via card-mod, remplacez-les par <code style={{ color: 'var(--nd-green)' }}>background: var(--ha-card-background) !important;</code> pour qu'elles héritent automatiquement des thèmes dynamiques !
        </p>
      </div>

    </div>
  );
}
