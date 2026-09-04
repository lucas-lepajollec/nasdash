import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { WidgetLayoutConfig } from '../../shared/WidgetLayoutConfig';
import { WidgetDockerLayoutConfig } from '../../shared/WidgetDockerLayoutConfig';
import { WidgetNetworksLayoutConfig } from '../../shared/WidgetNetworksLayoutConfig';
import { useI18n } from '@/i18n/I18nProvider';

export function DockerActionsWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();

  const hideDockerActions = config?.settings?.hideDockerActions ?? true;

  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <ToggleSwitch
          checked={!hideDockerActions}
          onChange={(val) => handleToggleWidget('hideDockerActions', !val)}
          label={t("Activer le widget Actions Docker")}
          sublabel={t("Choisissez si la section d'alimentation des conteneurs doit s'afficher sur votre dashboard.")}
        />
      </div>

      {!hideDockerActions && (
        <>
          <WidgetLayoutConfig widgetId="dockerActions" />
          <WidgetDockerLayoutConfig widgetId="dockerActions" />
          <WidgetNetworksLayoutConfig widgetId="dockerActions" />
        </>
      )}
    </div>
  );
}
