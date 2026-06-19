import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import CustomSelect from '@/components/shared/CustomSelect';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';
import { SettingsSection } from '../../shared/SettingsSection';

export function TabsNetworksTab() {
  const { config, updateConfig } = useConfig();
  const [openSection, setOpenSection] = React.useState<string>('layout');

  const tabConf = config?.settings?.tabs?.networks || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* Layout Configuration */}
      <SettingsSection 
        title="Disposition (Layout)" 
        description="Gérez l'affichage et la position des panneaux sur l'onglet Réseaux."
        isOpen={openSection === 'layout'}
        onToggle={(open) => { if(open) setOpenSection('layout'); else if(openSection === 'layout') setOpenSection(''); }}
      >
        {/* Networks Main Panel Position */}
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Panneau Principal (Carte Réseau & Outils)</span>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', margin: 0 }}>
            Positionnez le panneau principal contenant la cartographie du réseau.
          </p>
          <CustomSelect
            value={tabConf.networksPanelPosition || 'left'}
            onChange={async (val) => await updateConfig({ 
              tabs: { 
                ...config?.settings?.tabs, 
                networks: { 
                  ...tabConf, 
                  networksPanelPosition: val as 'left' | 'right' 
                } 
              } 
            })}
            options={[
              { value: 'left', label: 'Position : À gauche' },
              { value: 'right', label: 'Position : À droite' }
            ]}
            style={{ width: '100%' }}
          />
        </div>

        {/* Widgets Panel Toggle & Position */}
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ToggleSwitch 
            checked={!(tabConf.hideWidgetsSidebar ?? true)}
            onChange={async (val) => await updateConfig({ 
              tabs: { 
                ...config?.settings?.tabs, 
                networks: { 
                  ...tabConf, 
                  hideWidgetsSidebar: !val 
                } 
              } 
            })}
            label="Afficher le panneau des widgets"
            sublabel="Affiche une barre latérale supplémentaire contenant vos widgets actifs."
          />
          <CustomSelect
            value={tabConf.widgetsSidebarPosition || 'right'}
            onChange={async (val) => await updateConfig({ 
              tabs: { 
                ...config?.settings?.tabs, 
                networks: { 
                  ...tabConf, 
                  widgetsSidebarPosition: val as 'left' | 'right' 
                } 
              } 
            })}
            options={[
              { value: 'left', label: 'Position : À gauche' },
              { value: 'right', label: 'Position : À droite' }
            ]}
            style={{ width: '100%' }}
          />
        </div>
      </SettingsSection>

      {/* Specific Widgets Configuration */}
      <SettingsSection 
        title="Widgets Spécifiques" 
        description="Affichez ou masquez les widgets actifs spécifiquement sur l'onglet Réseaux."
        isOpen={openSection === 'widgets'}
        onToggle={(open) => { if(open) setOpenSection('widgets'); else if(openSection === 'widgets') setOpenSection(''); }}
      >
        {WIDGET_REGISTRY.map(w => {
          const hideKey = getWidgetConfigKeys(w.id).hide;
          const isGloballyHidden = (config?.settings as any)?.[hideKey] ?? w.defaultHidden;
          
          if (isGloballyHidden) return null;

          return (
            <div key={w.id} style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
              <ToggleSwitch
                checked={!((tabConf as any)?.[hideKey])}
                onChange={async (val) => await updateConfig({ 
                  tabs: { 
                    ...config?.settings?.tabs, 
                    networks: { 
                      ...tabConf, 
                      [hideKey]: !val 
                    } 
                  } 
                })}
                label={`${w.icon} ${w.name}`}
                sublabel="Afficher le widget sur cet onglet"
              />
            </div>
          );
        })}
      </SettingsSection>
    </div>
  );
}
