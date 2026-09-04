import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { WidgetLayoutConfig } from '../../shared/WidgetLayoutConfig';
import { WidgetDockerLayoutConfig } from '../../shared/WidgetDockerLayoutConfig';
import { WidgetNetworksLayoutConfig } from '../../shared/WidgetNetworksLayoutConfig';
import { useI18n } from '@/i18n/I18nProvider';

export function TailscaleWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();

  const hideTailscaleStatus = !!config?.settings?.hideTailscaleStatus;
  const demoMode = config?.demoMode === true;

  const [tailscaleTailnet, setTailscaleTailnet] = useState(config?.settings?.tailscaleTailnet || '');
  const [tailscaleClientId, setTailscaleClientId] = useState(config?.settings?.tailscaleClientId || '');
  const [tailscaleClientSecret, setTailscaleClientSecret] = useState(config?.settings?.tailscaleClientSecret ? '********' : '');

  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <ToggleSwitch
          checked={!hideTailscaleStatus}
          onChange={(val) => handleToggleWidget('hideTailscaleStatus', !val)}
          label={t("Activer le widget VPN Tailscale")}
          sublabel={t("Choisissez si l'état général et la liste des machines Tailscale doivent s'afficher.")}
        />
      </div>

      {!hideTailscaleStatus && (
        <>
          <WidgetLayoutConfig widgetId="tailscale" />
          <WidgetDockerLayoutConfig widgetId="tailscale" />
          <WidgetNetworksLayoutConfig widgetId="tailscale" />

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                aria-label={t("Nom du Tailnet")}
                className="nd-input"
                placeholder={t("Nom du Tailnet (ex: email@domaine.com)")}
                value={tailscaleTailnet}
                onChange={(e) => {
                  setTailscaleTailnet(e.target.value);
                  updateConfig({ tailscaleTailnet: e.target.value });
                }}
                style={{ fontSize: '0.75rem', padding: '10px 14px' }}
              />
              <input
                type="password"
                aria-label={t("OAuth Client ID Tailscale")}
                className="nd-input"
                placeholder={t("OAuth Client ID (kxxxx...)")}
                value={tailscaleClientId}
                onChange={(e) => {
                  setTailscaleClientId(e.target.value);
                  updateConfig({ tailscaleClientId: e.target.value });
                }}
                style={{ fontSize: '0.75rem', padding: '10px 14px' }}
              />
              <input
                type="password"
                aria-label={t("OAuth Client Secret Tailscale")}
                className="nd-input"
                placeholder={t("OAuth Client Secret (tskey-client-...)")}
                value={tailscaleClientSecret}
                onChange={(e) => {
                  setTailscaleClientSecret(e.target.value);
                  updateConfig({ tailscaleClientSecret: e.target.value });
                }}
                style={{ fontSize: '0.75rem', padding: '10px 14px' }}
              />
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
}
