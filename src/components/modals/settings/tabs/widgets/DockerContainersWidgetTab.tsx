import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { useCalme } from '@/widgets/calme';
import { CalmeHeading, CalmeRow, CalmeSegmented, CalmeSwitch } from '../../shared/CalmeControls';

export function DockerContainersWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();

  const calme = useCalme();
  if (calme) {
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <WidgetPlacementNote type="dockercontainers" />

      {/* Allow Actions toggle */}
      <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <ToggleSwitch
          checked={config?.settings?.allowDockerActions ?? true}
          onChange={async (val) => {
            await updateConfig({ allowDockerActions: val });
          }}
          label={t("Boutons d'action (Start/Stop)")}
          sublabel={t("Affiche les boutons pour contrôler les conteneurs. Désactivez-le pour un design plus épuré sur les petits widgets.")}
        />
      </div>
    </div>
  );
}
