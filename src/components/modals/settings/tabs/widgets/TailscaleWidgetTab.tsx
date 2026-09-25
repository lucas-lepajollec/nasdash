import React, { useState } from 'react';
import CustomSelect from '@/components/shared/CustomSelect';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { IntegrationConnectionForm } from '../../shared/IntegrationConnectionForm';
import { useCalme } from '@/widgets/calme';
import { CalmeHeading, CalmeRow, CalmeSegmented, CalmeSwitch } from '../../shared/CalmeControls';

export function TailscaleWidgetTab() {
  const { t } = useI18n();
  const { config } = useConfig();
  const demoMode = config?.demoMode === true;
  // The widget uses the connection saved last; start on that one.
  const [provider, setProvider] = useState<'tailscale' | 'headscale'>(() => {
    const mesh = (config?.integrations ?? []).filter(instance => instance.type === 'tailscale' || instance.type === 'headscale');
    mesh.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    return mesh[0]?.type === 'headscale' ? 'headscale' : 'tailscale';
  });

  const calme = useCalme();
  if (calme) {
    return (
      <div className="ndc-set-page">
        <WidgetPlacementNote type="tailscale" />
        <section className="ndc-set-block">
          <CalmeHeading info={demoMode
            ? t("La démo utilise une liste fictive d&apos;appareils et ne contacte jamais Tailscale. Les identifiants OAuth sont volontairement désactivés : ne saisissez aucun secret réel dans cette instance publique.")
            : t("Connectez votre compte Tailscale pour visualiser l&apos;état de vos appareils directement sur le Dashboard.")}>
            {t('settings.calme.connection')}
          </CalmeHeading>
          {!demoMode && (
            <>
              <CalmeRow label={t('integrations.mesh.provider')}>
                <CalmeSegmented
                  label={t('integrations.mesh.provider')}
                  value={provider}
                  options={[{ value: 'tailscale', label: 'Tailscale' }, { value: 'headscale', label: t('integrations.mesh.headscale') }]}
                  onChange={value => setProvider(value)}
                />
              </CalmeRow>
              <div className="ndc-set-form"><IntegrationConnectionForm key={provider} type={provider} /></div>
            </>
          )}
        </section>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <WidgetPlacementNote type="tailscale" />

      {demoMode ? (
        <div className="nd-settings-card" style={{ padding: '14px', background: 'color-mix(in srgb, var(--nd-accent) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--nd-accent) 32%, var(--nd-card-border))', borderRadius: 'var(--nd-card-radius)' }}>
          <h4 style={{ margin: '0 0 5px 0', fontSize: '0.8rem', fontWeight: 700 }}>{t("Connexion Tailscale simulée")}</h4>
          <p style={{ margin: 0, fontSize: '0.68rem', lineHeight: 1.55, color: 'var(--nd-text-muted)' }}>
            {t("La démo utilise une liste fictive d&apos;appareils et ne contacte jamais Tailscale. Les identifiants OAuth sont volontairement désactivés : ne saisissez aucun secret réel dans cette instance publique.")}
          </p>
        </div>
      ) : (
      <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>{t("Authentification API Tailscale")}</h4>
        <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
          {t("Connectez votre compte Tailscale pour visualiser l&apos;état de vos appareils directement sur le Dashboard.")}
        </p>
        <div style={{ marginBottom: 10 }}>
          <label className="nd-label">{t('integrations.mesh.provider')}</label>
          <CustomSelect
            value={provider}
            onChange={value => setProvider(value as 'tailscale' | 'headscale')}
            options={[{ value: 'tailscale', label: 'Tailscale' }, { value: 'headscale', label: t('integrations.mesh.headscale') }]}
          />
        </div>
        <IntegrationConnectionForm key={provider} type={provider} />
      </div>
      )}
    </div>
  );
}
