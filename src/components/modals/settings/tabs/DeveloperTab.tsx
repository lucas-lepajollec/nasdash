import React, { useState, useEffect } from 'react';
import { Cpu, Code } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { SettingsAccordion } from '../shared/SettingsAccordion';
import { ToggleSwitch } from '../shared/ToggleSwitch';

export function DeveloperTab() {
  const { config, updateConfig } = useConfig();
  
  const [openAccordions, setOpenAccordions] = useState<string[]>(['perf']);
  const [customCss, setCustomCss] = useState('');

  useEffect(() => {
    if (config) {
      if (config.settings?.customCss !== undefined) setCustomCss(config.settings.customCss);
    }
  }, [config]);

  const toggleAccordion = (id: string) => {
    setOpenAccordions(prev => prev.includes(id) ? [] : [id]);
  };

  const handleSaveCss = async () => {
    await updateConfig({ customCss });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SettingsAccordion
        title="Performance Monitor"
        description="Statistiques en temps réel sur les performances"
        icon={<Cpu size={18} />}
        isOpen={openAccordions.includes('perf')}
        onToggle={() => toggleAccordion('perf')}
      >
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 'var(--nd-card-radius)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <ToggleSwitch 
            checked={!!config?.settings?.enablePerfMonitor}
            onChange={async (val) => await updateConfig({ enablePerfMonitor: val })}
            label="Activer le Performance Monitor"
            sublabel="Désactivé par défaut pour économiser les ressources client."
          />
        </div>
      </SettingsAccordion>

      <SettingsAccordion
        title="Custom CSS"
        description="Code CSS personnalisé pour l'interface globale"
        icon={<Code size={18} />}
        isOpen={openAccordions.includes('css')}
        onToggle={() => toggleAccordion('css')}
      >
        <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Overide CSS personnalisé</h4>
        <p style={{ margin: '4px 0 10px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
          Injectez des styles CSS surcharges réactivement sur votre dashboard.
        </p>
        <textarea
          className="nd-input"
          rows={3}
          placeholder="/* Exemple: .nd-brand { color: red !important; } */"
          value={customCss}
          onChange={(e) => setCustomCss(e.target.value)}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.7rem', resize: 'vertical', minHeight: '60px', marginBottom: '8px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="nd-btn" onClick={handleSaveCss} style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
            Appliquer le CSS
          </button>
        </div>
      </SettingsAccordion>
    </div>
  );
}
