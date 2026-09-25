import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import CustomSelect from '../../../../shared/CustomSelect';
import { Emoji } from '../../../../shared/Emoji';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { useCalme } from '@/widgets/calme';
import { CalmeHeading, CalmeRow, CalmeSegmented, CalmeSwitch } from '../../shared/CalmeControls';

export function ClockWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const clockTimezone = config?.settings?.clockTimezone || '';
  const clockDesign = config?.settings?.clockDesign || 'default';

  const calme = useCalme();
  if (calme) {
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <WidgetPlacementNote type="clock" />

      {/* Timezone Configuration */}
      <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>{t("Fuseau Horaire")}</h4>
        <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
          {t("Spécifiez le fuseau horaire de l&apos;horloge. Laissez vide pour utiliser l&apos;heure locale.")}
        </p>
        <CustomSelect
          ariaLabel={t("Fuseau Horaire")}
          value={clockTimezone || ''}
          onChange={async (val) => {
            await updateConfig({ clockTimezone: val });
          }}
          options={[
            { value: '', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Emoji emoji="🏠" /> {t("Heure locale (Défaut)")}</span> },
            ...(Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone').map(tz => ({
              value: tz,
              label: tz.replace('_', ' ')
            })) : [])
          ]}
        />
      </div>

      {/* Design Configuration */}
      <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>{t("Design & Style")}</h4>
        <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
          {t("Sélectionnez l&apos;apparence visuelle de l&apos;horloge.")}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { id: 'default', name: t("Défaut"), desc: t("Design classique et propre") },
            { id: 'minimal', name: 'Minimaliste', desc: t("Discret, texte seul") },
            { id: 'glow', name: 'Terminal', desc: t("Style ligne de commande minimaliste") },
            { id: 'split', name: t("Split Cards"), desc: t("Boîtes séparées (style Flip)") }
          ].map(design => (
            <button
              key={design.id}
              onClick={async () => {
                await updateConfig({ clockDesign: design.id });
              }}
              style={{
                padding: '12px', border: '1px solid',
                borderColor: clockDesign === design.id ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                background: clockDesign === design.id ? 'var(--nd-accent-glow)' : 'rgba(0,0,0,0.2)',
                color: clockDesign === design.id ? 'var(--nd-accent)' : 'var(--nd-text)',
                borderRadius: 'var(--nd-card-radius)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: clockDesign === design.id ? '0 0 8px var(--nd-accent-glow)' : 'none'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 4 }}>{design.name}</div>
              <div style={{ fontSize: '0.62rem', color: clockDesign === design.id ? 'inherit' : 'var(--nd-text-muted)', opacity: 0.8 }}>{design.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
