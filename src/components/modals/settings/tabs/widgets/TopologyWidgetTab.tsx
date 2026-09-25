import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import ConfirmModal from '../../../ConfirmModal';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading, CalmeRow, CalmeSegmented } from '../../shared/CalmeControls';

/** Shared options of the network topology widget, wherever it is placed. */
export function TopologyWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  const handleResetSchema = async () => {
    await updateConfig({
      networkTopology: { nodes: [], groups: [], connections: [] }
    });
  };

  const tabConf = config?.settings?.tabs?.networks || {};

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
