import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import CustomSelect from '@/components/shared/CustomSelect';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';

import { SettingsSection } from '../../shared/SettingsSection';
import { useI18n } from '@/i18n/I18nProvider';

export function TabsDockerTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const [openSection, setOpenSection] = React.useState<string>('layout');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <SettingsSection
        title={t("Disposition (Layout)")}
        description={t("Gérez l'affichage et la position des panneaux sur l'onglet Docker.")}
        isOpen={openSection === 'layout'}
        onToggle={(open) => { if(open) setOpenSection('layout'); else if(openSection === 'layout') setOpenSection(''); }}
      >
        {/* Docker Main Panel Position */}
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t("Panneau Docker (Hôtes & Conteneurs)")}</span>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', margin: 0 }}>
            {t("Positionnez le panneau principal de gestion Docker (la liste des conteneurs, images, etc.).")}
          </p>
          <CustomSelect
            value={config?.settings?.tabs?.docker?.dockerPanelPosition || 'left'}
            onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, docker: { ...config?.settings?.tabs?.docker, dockerPanelPosition: val as 'left' | 'right' } } })}
            options={[
              { value: 'left', label: t("Position : À gauche") },
              { value: 'right', label: t("Position : À droite") }
            ]}
            style={{ width: '100%' }}
          />
        </div>

        {/* Widgets Panel Toggle & Position */}
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ToggleSwitch
            checked={!(config?.settings?.tabs?.docker?.hideWidgetsSidebar ?? true)}
            onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, docker: { ...config?.settings?.tabs?.docker, hideWidgetsSidebar: !val } } })}
            label={t("Afficher le panneau des widgets")}
            sublabel={t("Affiche une barre latérale supplémentaire contenant vos widgets actifs.")}
          />
          <CustomSelect
            value={config?.settings?.tabs?.docker?.widgetsSidebarPosition || 'right'}
            onChange={async (val) => await updateConfig({ tabs: { ...config?.settings?.tabs, docker: { ...config?.settings?.tabs?.docker, widgetsSidebarPosition: val as 'left' | 'right' } } })}
            options={[
              { value: 'left', label: t("Position : À gauche") },
              { value: 'right', label: t("Position : À droite") }
            ]}
            style={{ width: '100%' }}
          />
        </div>
      </SettingsSection>
    </div>
  );
}
