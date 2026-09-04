import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { WidgetLayoutConfig } from '../../shared/WidgetLayoutConfig';
import { WidgetDockerLayoutConfig } from '../../shared/WidgetDockerLayoutConfig';
import { WidgetNetworksLayoutConfig } from '../../shared/WidgetNetworksLayoutConfig';
import CustomSelect from '../../../../shared/CustomSelect';
import { Emoji } from '../../../../shared/Emoji';
import { useI18n } from '@/i18n/I18nProvider';

export function ClockWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();

  const hideClock = !!config?.settings?.hideClock;
  const clockTimezone = config?.settings?.clockTimezone || '';
  const clockDesign = config?.settings?.clockDesign || 'default';

  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ToggleSwitch
        checked={!hideClock}
        onChange={(val) => handleToggleWidget('hideClock', !val)}
        label={t("Activer le widget Horloge / Date")}
        sublabel={t("Choisissez si l'horloge doit s'afficher sur votre tableau de bord.")}
      />

      {!hideClock && (
        <>
          <WidgetLayoutConfig widgetId="clock" />
          <WidgetDockerLayoutConfig widgetId="clock" />
          <WidgetNetworksLayoutConfig widgetId="clock" />

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
        </>
      )}
    </div>
  );
}
