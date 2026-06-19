import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { WidgetLayoutConfig } from '../../shared/WidgetLayoutConfig';
import { WidgetDockerLayoutConfig } from '../../shared/WidgetDockerLayoutConfig';
import { WidgetNetworksLayoutConfig } from '../../shared/WidgetNetworksLayoutConfig';

export function DockerContainersWidgetTab() {
  const { config, updateConfig } = useConfig();
  const hideDockerContainers = config?.settings?.hideDockerContainers ?? true;
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
          <WidgetNetworksLayoutConfig widgetId="dockerContainers" />

          {/* Allow Actions toggle */}
          <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <ToggleSwitch
              checked={config?.settings?.allowDockerActions ?? true}
              onChange={async (val) => {
                await updateConfig({ allowDockerActions: val });
              }}
              label="Boutons d'action (Start/Stop)"
              sublabel="Affiche les boutons pour contrôler les conteneurs. Désactivez-le pour un design plus épuré sur les petits widgets."
            />
          </div>
        </>
      )}
    </div>
  );
}
