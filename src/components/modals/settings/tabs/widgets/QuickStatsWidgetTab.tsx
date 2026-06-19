import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { WidgetLayoutConfig } from '../../shared/WidgetLayoutConfig';
import { WidgetDockerLayoutConfig } from '../../shared/WidgetDockerLayoutConfig';
import { WidgetNetworksLayoutConfig } from '../../shared/WidgetNetworksLayoutConfig';

export function QuickStatsWidgetTab() {
  const { config, updateConfig } = useConfig();

  const hideQuickStats = !!config?.settings?.hideQuickStats;

  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <ToggleSwitch
          checked={!hideQuickStats}
          onChange={(val) => handleToggleWidget('hideQuickStats', !val)}
          label="Activer le widget Vue d'ensemble"
          sublabel="Choisissez si le résumé des statistiques du dashboard doit s'afficher dans une barre latérale."
        />
      </div>

      {!hideQuickStats && (
        <>
          <WidgetLayoutConfig widgetId="quickStats" />
          <WidgetDockerLayoutConfig widgetId="quickStats" />
          <WidgetNetworksLayoutConfig widgetId="quickStats" />
        </>
      )}
    </div>
  );
}
