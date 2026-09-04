import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import CustomSelect from '@/components/shared/CustomSelect';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';
import { ChevronDown } from 'lucide-react';

import { SettingsSection } from '../../shared/SettingsSection';
import { useI18n } from '@/i18n/I18nProvider';

export function TabsHomeTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const [openSection, setOpenSection] = React.useState<string>('general');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <SettingsSection
        title={t("Options Générales")}
        isOpen={openSection === 'general'}
        onToggle={(open) => { if(open) setOpenSection('general'); else if(openSection === 'general') setOpenSection(''); }}
      >
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
          <ToggleSwitch
            checked={!!config?.settings?.showPingDetails}
            onChange={(val) => updateConfig({ showPingDetails: val })}
            label={t("Détails du ping des services")}
            sublabel={t("Affiche le statut (OK/Erreur) et la latence (ms) sous le nom des services (Layout Standard).")}
          />
        </div>
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, color: 'var(--nd-text)' }}>
            {t("Affichage des pastilles de ping (OK/Erreur)")}
          </label>
          <p style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 8 }}>
            {t("Choisissez sur quelles layouts afficher les icônes de statut réseau.")}
          </p>
          <CustomSelect
            value={config?.settings?.pingIndicatorMode || 'all'}
            onChange={(val) => updateConfig({ pingIndicatorMode: val as 'none' | 'standard_only' | 'all' })}
            options={[
              { value: 'none', label: t("Ne pas afficher") },
              { value: 'standard_only', label: t("Uniquement sur Standard & Compact") },
              { value: 'all', label: t("Afficher sur toutes les layouts") }
            ]}
            style={{ width: '100%' }}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("Disposition (Layout)")}
        description={t("Gérez l'affichage et la position des panneaux sur l'onglet Home.")}
        isOpen={openSection === 'layout'}
        onToggle={(open) => { if(open) setOpenSection('layout'); else if(openSection === 'layout') setOpenSection(''); }}
      >
        {/* Left Panel */}
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t("Panneau Gauche")}</span>
            <ToggleSwitch
              checked={!config?.settings?.tabs?.home?.hideLeftSidebar}
              onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, home: { ...config?.settings?.tabs?.home, hideLeftSidebar: !val } } })}
              label={t("Afficher le panneau")}
            />
          </div>
          <CustomSelect
            value={config?.settings?.tabs?.home?.leftSidebarPosition || 'left'}
            onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, home: { ...config?.settings?.tabs?.home, leftSidebarPosition: val } } })}
            options={[
              { value: 'left', label: t("Position : À gauche") },
              { value: 'right', label: t("Position : À droite") }
            ]}
            style={{ width: '100%' }}
          />
        </div>

        {/* Right Panel */}
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ToggleSwitch
            checked={!(config?.settings?.tabs?.home?.hideRightSidebar)}
            onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, home: { ...config?.settings?.tabs?.home, hideRightSidebar: !val } } })}
            label={t("Afficher le panneau droit")}
            sublabel={t("Si désactivé, le panneau droit sera masqué sur cet onglet.")}
          />
          <CustomSelect
            value={config?.settings?.tabs?.home?.rightSidebarPosition || 'right'}
            onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, home: { ...config?.settings?.tabs?.home, rightSidebarPosition: val } } })}
            options={[
              { value: 'left', label: t("Position : À gauche") },
              { value: 'right', label: t("Position : À droite") }
            ]}
            style={{ width: '100%' }}
          />
        </div>

        {/* Bottom Panel */}
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t("Panneau Inférieur (Widgets horizontaux)")}</span>
            <ToggleSwitch
              checked={!config?.settings?.tabs?.home?.hideBottomPanel}
              onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, home: { ...config?.settings?.tabs?.home, hideBottomPanel: !val } } })}
              label={t("Afficher le panneau")}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4 }}>
              {t("Titre séparateur")}
            </label>
            <input
              type="text"
              value={config?.settings?.tabs?.home?.bottomPanelTitle ?? 'Activité réseau'}
              onChange={async (e) => await updateConfig({ tabs: { ...config?.settings?.tabs, home: { ...config?.settings?.tabs?.home, bottomPanelTitle: e.target.value } } })}
              placeholder={t("Ex: Monitoring, Réseau...")}
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
    </div>
  );
}
