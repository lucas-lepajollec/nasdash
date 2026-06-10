import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { WidgetLayoutConfig } from '../../shared/WidgetLayoutConfig';

export function DockerActionsWidgetTab() {
  const { config, updateConfig } = useConfig();

  const hideDockerActions = config?.settings?.hideDockerActions ?? true;
  const dockerActionsSidebar = config?.settings?.dockerActionsSidebar || 'right';
  const dockerActionsOrder = config?.settings?.dockerActionsOrder ?? 3;

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
          checked={!hideDockerActions}
          onChange={(val) => handleToggleWidget('hideDockerActions', !val)}
          label="Activer le widget Actions Docker"
          sublabel="Choisissez si la section d'alimentation des conteneurs doit s'afficher sur votre dashboard."
        />
      </div>

      {!hideDockerActions && (
        <>
          <WidgetLayoutConfig widgetId="dockerActions" />
        </>
      )}
    </div>
  );
}
