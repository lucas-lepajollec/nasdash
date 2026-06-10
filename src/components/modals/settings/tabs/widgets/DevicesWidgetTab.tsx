import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { WidgetLayoutConfig } from '../../shared/WidgetLayoutConfig';

export function DevicesWidgetTab() {
  const { config, updateConfig } = useConfig();

  const hideDevices = !!config?.settings?.hideDevices;
  const devicesSidebar = config?.settings?.devicesSidebar || 'left';
  const devicesOrder = config?.settings?.devicesOrder ?? 0;

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
          checked={!hideDevices}
          onChange={(val) => handleToggleWidget('hideDevices', !val)}
          label="Activer le widget Appareils"
          sublabel="Choisissez si ce module de monitoring matériel doit s'afficher sur votre tableau de bord."
        />
      </div>

      {!hideDevices && (
        <>
          <WidgetLayoutConfig widgetId="devices" />

          {/* Future Options Note */}
          <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--nd-accent)', fontWeight: 600 }}>⚡ Évolutivité & Extensions</span>
            <p style={{ margin: 0, fontSize: '0.66rem', color: 'var(--nd-text-muted)', lineHeight: 1.4 }}>
              Ce sous-menu est conçu pour être extensible. Dans de futures versions, vous pourrez y configurer des capteurs matériels additionnels, lier des connexions API Proxmox multiples, ou masquer certains serveurs hors-ligne.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
