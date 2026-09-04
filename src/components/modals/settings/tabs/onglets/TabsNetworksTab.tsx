import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import CustomSelect from '@/components/shared/CustomSelect';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';
import { SettingsSection } from '../../shared/SettingsSection';
import ConfirmModal from '../../../ConfirmModal';
import { useI18n } from '@/i18n/I18nProvider';

export function TabsNetworksTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const [openSection, setOpenSection] = React.useState<string>('layout');
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  const handleResetSchema = async () => {
    await updateConfig({
      networkTopology: { nodes: [], groups: [], connections: [] }
    });
  };

  const tabConf = config?.settings?.tabs?.networks || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Layout Configuration */}
      <SettingsSection
        title={t("Disposition (Layout)")}
        description={t("Gérez l'affichage et la position des panneaux sur l'onglet Réseaux.")}
        isOpen={openSection === 'layout'}
        onToggle={(open) => { if(open) setOpenSection('layout'); else if(openSection === 'layout') setOpenSection(''); }}
      >
        {/* Networks Main Panel Position */}
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t("Panneau Principal (Carte Réseau & Outils)")}</span>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', margin: 0 }}>
            {t("Positionnez le panneau principal contenant la cartographie du réseau.")}
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
              { value: 'left', label: t("Position : À gauche") },
              { value: 'right', label: t("Position : À droite") }
            ]}
            style={{ width: '100%' }}
          />
        </div>

        {/* Node Card Size Option */}
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t("Taille des nœuds de la carte")}</span>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', margin: 0 }}>
            {t("Ajustez la taille des cartes de nœuds sur la cartographie (Auto s'adapte selon le nombre de services).")}
          </p>
          <CustomSelect
            value={tabConf.cardSize || 'auto'}
            onChange={async (val) => await updateConfig({
              tabs: {
                ...config?.settings?.tabs,
                networks: {
                  ...tabConf,
                  cardSize: val as 'auto' | 'standard' | 'compact' | 'mini'
                }
              }
            })}
            options={[
              { value: 'auto', label: t("Automatique (Adaptatif)") },
              { value: 'standard', label: t("Standard (Grand)") },
              { value: 'compact', label: t("Compact") },
              { value: 'mini', label: t("Mini") }
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
            label={t("Afficher le panneau des widgets")}
            sublabel={t("Affiche une barre latérale supplémentaire contenant vos widgets actifs.")}
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
              { value: 'left', label: t("Position : À gauche") },
              { value: 'right', label: t("Position : À droite") }
            ]}
            style={{ width: '100%' }}
          />
        </div>
      </SettingsSection>



      {/* Network Schema Actions */}
      <SettingsSection
        title={t("Actions de la Carte")}
        description={t("Gérez les données et la cartographie de votre réseau.")}
        isOpen={openSection === 'actions'}
        onToggle={(open) => { if(open) setOpenSection('actions'); else if(openSection === 'actions') setOpenSection(''); }}
      >
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t("Réinitialiser la carte réseau")}</span>
          <p style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', margin: 0 }}>
            {t("Cette action supprimera définitivement tous les nœuds, groupes et liaisons de votre cartographie réseau de manière irréversible.")}
          </p>
          <button
            className="nd-btn"
            onClick={() => setShowResetConfirm(true)}
            style={{
              alignSelf: 'flex-start',
              background: 'var(--nd-red)',
              borderColor: 'var(--nd-red)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.7rem',
              height: 28,
              padding: '0 12px'
            }}
          >
            {t("Réinitialiser de zéro")}
          </button>
        </div>
      </SettingsSection>

      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetSchema}
        title={t("Réinitialiser la cartographie réseau ?")}
        description={t("Êtes-vous sûr de vouloir supprimer tous les nœuds, groupes et liaisons de votre cartographie réseau ? Cette opération est irréversible.")}
        confirmLabel="Réinitialiser"
        cancelLabel="Annuler"
      />
    </div>
  );
}
