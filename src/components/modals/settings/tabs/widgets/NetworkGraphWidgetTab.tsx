import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { WidgetLayoutConfig } from '../../shared/WidgetLayoutConfig';

export function NetworkGraphWidgetTab() {
  const { config, updateConfig } = useConfig();
  const hideNetworkGraph = !!config?.settings?.hideNetworkGraph;
    
  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <ToggleSwitch
          checked={!hideNetworkGraph}
          onChange={(val) => handleToggleWidget('hideNetworkGraph', !val)}
          label="Activer le widget Graphe Réseau"
          sublabel="Affichage graphique de la latence réseau (Ping) avec historique et jauge d'état."
        />
      </div>

      {!hideNetworkGraph && (
        <>
          <WidgetLayoutConfig widgetId="networkGraph" />
        </>
      )}
    </div>
  );
}
