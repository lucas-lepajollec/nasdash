import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { WidgetLayoutConfig } from '../../shared/WidgetLayoutConfig';
import { WidgetDockerLayoutConfig } from '../../shared/WidgetDockerLayoutConfig';
import { WidgetNetworksLayoutConfig } from '../../shared/WidgetNetworksLayoutConfig';
import { useI18n } from '@/i18n/I18nProvider';

export function NetworkGraphWidgetTab() {
  const { t } = useI18n();
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
          label={t("Activer le widget Graphe Réseau")}
          sublabel={t("Affichage graphique de la latence réseau (Ping) avec historique et jauge d'état.")}
        />
      </div>

      {!hideNetworkGraph && (
        <>
          <WidgetLayoutConfig widgetId="networkGraph" />
          <WidgetDockerLayoutConfig widgetId="networkGraph" />
          <WidgetNetworksLayoutConfig widgetId="networkGraph" />
        </>
      )}
    </div>
  );
}
