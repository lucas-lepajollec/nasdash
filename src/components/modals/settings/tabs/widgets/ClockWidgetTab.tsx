import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import CustomSelect from '../../../../shared/CustomSelect';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading, CalmeRow, CalmeSegmented } from '../../shared/CalmeControls';

export function ClockWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const clockTimezone = config?.settings?.clockTimezone || '';
  const clockDesign = config?.settings?.clockDesign || 'default';

  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type="clock" />
      <section className="ndc-set-block">
        <CalmeHeading>{t('settings.calme.display')}</CalmeHeading>
        <CalmeRow label={t("Fuseau Horaire")} info={t("Spécifiez le fuseau horaire de l&apos;horloge. Laissez vide pour utiliser l&apos;heure locale.")}>
          <div style={{ width: 240 }}>
            <CustomSelect
              ariaLabel={t("Fuseau Horaire")}
              value={clockTimezone || ''}
              onChange={async (val) => { await updateConfig({ clockTimezone: val }); }}
              options={[
                { value: '', label: t("Heure locale (Défaut)") },
                ...(Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone').map(tz => ({ value: tz, label: tz.replace('_', ' ') })) : []),
              ]}
            />
          </div>
        </CalmeRow>
        <CalmeRow label={t("Design & Style")} info={t('settings.calme.clockStyles')}>
          <CalmeSegmented
            label={t("Design & Style")}
            value={clockDesign}
            options={[
              { value: 'default', label: t("Défaut") },
              { value: 'minimal', label: t('settings.calme.clockMinimal') },
              { value: 'glow', label: t('settings.calme.clockAccent') },
              { value: 'split', label: t('settings.calme.clockSplit') },
            ]}
            onChange={async (value) => { await updateConfig({ clockDesign: value }); }}
          />
        </CalmeRow>
      </section>
    </div>
  );
}
