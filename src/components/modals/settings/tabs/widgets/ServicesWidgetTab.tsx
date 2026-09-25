import React from 'react';
import { useConfig } from '@/hooks/useConfig';

import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading, CalmeRow, CalmeSegmented, CalmeSwitch } from '../../shared/CalmeControls';

/** Shared options of the service categories, wherever they are placed. */
export function ServicesWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();

  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type="service-category" />
      <section className="ndc-set-block">
        <CalmeHeading>{t('settings.calme.pings')}</CalmeHeading>
        <CalmeRow label={t("Détails du ping des services")} info={t("Affiche le statut (OK/Erreur) et la latence (ms) sous le nom des services (Layout Standard).")}>
          <CalmeSwitch label={t("Détails du ping des services")} checked={!!config?.settings?.showPingDetails} onChange={(val) => updateConfig({ showPingDetails: val })} />
        </CalmeRow>
        <CalmeRow label={t('settings.calme.pingDots')} info={t("Choisissez sur quelles layouts afficher les icônes de statut réseau.")}>
          <CalmeSegmented
            label={t('settings.calme.pingDots')}
            value={config?.settings?.pingIndicatorMode || 'all'}
            options={[
              { value: 'all', label: t('settings.calme.pingAll') },
              { value: 'standard_only', label: t('settings.calme.pingLists') },
              { value: 'none', label: t('settings.calme.pingNone') },
            ]}
            onChange={(val) => updateConfig({ pingIndicatorMode: val as 'none' | 'standard_only' | 'all' })}
          />
        </CalmeRow>
      </section>
    </div>
  );
}
