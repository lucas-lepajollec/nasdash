import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import CustomSelect from '@/components/shared/CustomSelect';
import { SettingsSection } from '../../shared/SettingsSection';
import ConfirmModal from '../../../ConfirmModal';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { useCalme } from '@/widgets/calme';
import { CalmeHeading, CalmeRow, CalmeSegmented } from '../../shared/CalmeControls';

/** Shared options of the network topology widget, wherever it is placed. */
export function TopologyWidgetTab() {
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

  const calme = useCalme();
  const resetDialog = (
    <ConfirmModal
      isOpen={showResetConfirm}
      onClose={() => setShowResetConfirm(false)}
      onConfirm={handleResetSchema}
      title={t("Réinitialiser la cartographie réseau ?")}
      description={t("Êtes-vous sûr de vouloir supprimer tous les nœuds, groupes et liaisons de votre cartographie réseau ? Cette opération est irréversible.")}
      confirmLabel={t("Réinitialiser")}
      cancelLabel={t("Annuler")}
    />
  );
  if (calme) {
    const setCardSize = async (val: string) => updateConfig({ tabs: { ...config?.settings?.tabs, networks: { ...tabConf, cardSize: val as 'auto' | 'standard' | 'compact' | 'mini' } } });
    return (
      <div className="ndc-set-page">
        <WidgetPlacementNote type="network-topology" />
        <section className="ndc-set-block">
          <CalmeHeading>{t('settings.calme.display')}</CalmeHeading>
          <CalmeRow label={t("Taille des nœuds de la carte")} info={t("Ajustez la taille des cartes de nœuds sur la cartographie (Auto s'adapte selon le nombre de services).")}>
            <CalmeSegmented
              label={t("Taille des nœuds de la carte")}
              value={tabConf.cardSize || 'auto'}
              options={[
                { value: 'auto', label: t('settings.calme.auto') },
                { value: 'standard', label: t('settings.calme.large') },
                { value: 'compact', label: t("Compact") },
                { value: 'mini', label: t("Mini") },
              ]}
              onChange={setCardSize}
            />
          </CalmeRow>
        </section>
        <section className="ndc-set-block">
          <CalmeHeading>{t('settings.calme.dangerZone')}</CalmeHeading>
          <CalmeRow label={t("Réinitialiser la carte réseau")} info={t("Cette action supprimera définitivement tous les nœuds, groupes et liaisons de votre cartographie réseau de manière irréversible.")}>
            <button type="button" className="nd-btn ndc-danger" onClick={() => setShowResetConfirm(true)}>{t("Réinitialiser")}</button>
          </CalmeRow>
        </section>
        {resetDialog}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <WidgetPlacementNote type="network-topology" />

      {/* Display */}
      <SettingsSection
        title={t('settings.topology.display')}
        description={t('settings.topology.displayDescription')}
        isOpen={openSection === 'layout'}
        onToggle={(open) => { if(open) setOpenSection('layout'); else if(openSection === 'layout') setOpenSection(''); }}
      >
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
        confirmLabel={t("Réinitialiser")}
        cancelLabel={t("Annuler")}
      />
    </div>
  );
}
