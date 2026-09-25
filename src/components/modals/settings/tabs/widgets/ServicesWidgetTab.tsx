import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import CustomSelect from '@/components/shared/CustomSelect';

import { SettingsSection } from '../../shared/SettingsSection';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { useCalme } from '@/widgets/calme';
import { CalmeHeading, CalmeRow, CalmeSegmented, CalmeSwitch } from '../../shared/CalmeControls';

/** Shared options of the service categories, wherever they are placed. */
export function ServicesWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const [openSection, setOpenSection] = React.useState<string>('general');

  const calme = useCalme();
  if (calme) {
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <WidgetPlacementNote type="service-category" />

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

    </div>
  );
}
