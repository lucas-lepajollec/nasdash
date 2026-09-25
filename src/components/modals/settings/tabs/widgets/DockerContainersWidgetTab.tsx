import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading, CalmeRow, CalmeSwitch } from '../../shared/CalmeControls';

export function DockerContainersWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();

  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type="dockercontainers" />
      <section className="ndc-set-block">
        <CalmeHeading>{t('settings.calme.display')}</CalmeHeading>
        <CalmeRow label={t("Boutons d'action (Start/Stop)")} info={t("Affiche les boutons pour contrôler les conteneurs. Désactivez-le pour un design plus épuré sur les petits widgets.")}>
          <CalmeSwitch label={t("Boutons d'action (Start/Stop)")} checked={config?.settings?.allowDockerActions ?? true} onChange={async (val) => { await updateConfig({ allowDockerActions: val }); }} />
        </CalmeRow>
      </section>
    </div>
  );
}
