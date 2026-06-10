import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import CustomSelect from '@/components/shared/CustomSelect';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';
import { ChevronDown } from 'lucide-react';

import { SettingsSection } from '../../shared/SettingsSection';

export function TabsHomeTab() {
  const { config, updateConfig } = useConfig();
  const [openSection, setOpenSection] = React.useState<string>('general');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      <SettingsSection 
        title="Options Générales" 
        isOpen={openSection === 'general'} 
        onToggle={(open) => { if(open) setOpenSection('general'); else if(openSection === 'general') setOpenSection(''); }}
      >
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
          <ToggleSwitch 
            checked={!!config?.settings?.showPingDetails}
            onChange={(val) => updateConfig({ showPingDetails: val })}
            label="Détails du ping des services"
            sublabel="Affiche le statut (OK/Erreur) et la latence (ms) sous le nom des services (Layout Standard)."
          />
        </div>
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, color: 'var(--nd-text)' }}>
            Affichage des pastilles de ping (OK/Erreur)
          </label>
          <p style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 8 }}>
            Choisissez sur quelles layouts afficher les icônes de statut réseau.
          </p>
          <CustomSelect
            value={config?.settings?.pingIndicatorMode || 'all'}
            onChange={(val) => updateConfig({ pingIndicatorMode: val as 'none' | 'standard_only' | 'all' })}
            options={[
              { value: 'none', label: 'Ne pas afficher' },
              { value: 'standard_only', label: 'Uniquement sur Standard & Compact' },
              { value: 'all', label: 'Afficher sur toutes les layouts' }
            ]}
            style={{ width: '100%' }}
          />
        </div>
      </SettingsSection>

      <SettingsSection 
        title="Disposition (Layout)" 
        description="Gérez l'affichage et la position des panneaux sur l'onglet Home."
        isOpen={openSection === 'layout'}
        onToggle={(open) => { if(open) setOpenSection('layout'); else if(openSection === 'layout') setOpenSection(''); }}
      >
        {/* Left Panel */}
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Panneau Gauche</span>
            <ToggleSwitch
              checked={!config?.settings?.tabs?.home?.hideLeftSidebar}
              onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, home: { ...config?.settings?.tabs?.home, hideLeftSidebar: !val } } })}
              label="Afficher le panneau"
            />
          </div>
          <CustomSelect
            value={config?.settings?.tabs?.home?.leftSidebarPosition || 'left'}
            onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, home: { ...config?.settings?.tabs?.home, leftSidebarPosition: val } } })}
            options={[
              { value: 'left', label: 'Position : À gauche' },
              { value: 'right', label: 'Position : À droite' }
            ]}
            style={{ width: '100%' }}
          />
        </div>

        {/* Right Panel */}
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ToggleSwitch 
            checked={!(config?.settings?.tabs?.home?.hideRightSidebar)}
            onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, home: { ...config?.settings?.tabs?.home, hideRightSidebar: !val } } })}
            label="Afficher le panneau droit"
            sublabel="Si désactivé, le panneau droit sera masqué sur cet onglet."
          />
          <CustomSelect
            value={config?.settings?.tabs?.home?.rightSidebarPosition || 'right'}
            onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, home: { ...config?.settings?.tabs?.home, rightSidebarPosition: val } } })}
            options={[
              { value: 'left', label: 'Position : À gauche' },
              { value: 'right', label: 'Position : À droite' }
            ]}
            style={{ width: '100%' }}
          />
        </div>

        {/* Bottom Panel */}
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Panneau Inférieur (Widgets horizontaux)</span>
            <ToggleSwitch
              checked={!config?.settings?.tabs?.home?.hideBottomPanel}
              onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, home: { ...config?.settings?.tabs?.home, hideBottomPanel: !val } } })}
              label="Afficher le panneau"
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4 }}>
              Titre séparateur
            </label>
            <input
              type="text"
              value={config?.settings?.tabs?.home?.bottomPanelTitle ?? 'Activité réseau'}
              onChange={async (e) => await updateConfig({ tabs: { ...config?.settings?.tabs, home: { ...config?.settings?.tabs?.home, bottomPanelTitle: e.target.value } } })}
              placeholder="Ex: Monitoring, Réseau..."
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--nd-input-border)',
                borderRadius: '4px',
                padding: '6px 10px',
                color: 'var(--nd-text)',
                fontSize: '0.75rem'
              }}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection 
        title="Widgets Spécifiques" 
        description="Affichez ou masquez les widgets actifs spécifiquement sur l'onglet Home."
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
                checked={!((config?.settings?.tabs?.home as any)?.[hideKey])}
                onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, home: { ...config?.settings?.tabs?.home, [hideKey]: !val } } })}
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
