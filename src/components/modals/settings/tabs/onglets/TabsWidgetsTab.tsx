import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { SettingsSection } from '../../shared/SettingsSection';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';
import { Emoji } from '../../../../shared/Emoji';

export function TabsWidgetsTab() {
  const { config, updateConfig } = useConfig();
  const [openSection, setOpenSection] = useState<string>('widgets');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SettingsSection 
        title="Widgets Spécifiques" 
        description="Affichez ou masquez les widgets actifs spécifiquement sur l'onglet Widgets. (Seuls les widgets activés dans Bibliothèque Globale sont listés)."
        isOpen={openSection === 'widgets'}
        onToggle={(open) => setOpenSection(open ? 'widgets' : '')}
      >
        {WIDGET_REGISTRY.map(w => {
          const hideKey = getWidgetConfigKeys(w.id).hide;
          const isGloballyHidden = (config?.settings as any)?.[hideKey] ?? w.defaultHidden;
          
          if (isGloballyHidden) return null;

          return (
            <div key={w.id} style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
              <ToggleSwitch
                checked={!((config?.settings?.tabs?.widgets as any)?.[hideKey])}
                onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, widgets: { ...config?.settings?.tabs?.widgets, [hideKey]: !val } } })}
                label={
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Emoji emoji={w.icon} />
                    {w.name}
                  </span>
                }
                sublabel="Afficher le widget sur cet onglet"
              />
            </div>
          );
        })}
      </SettingsSection>
    </div>
  );
}
