import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { latestInstance } from '@/integrations/instances';
import { useOpenSettings } from '@/components/integrations/useOpenSettings';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading, CalmeRow } from '../../shared/CalmeControls';

/**
 * The mesh widget reads the Tailscale or Headscale connection saved on the
 * Integrations page (the one saved last): this tab says which one it uses
 * and links there.
 */
export function TailscaleWidgetTab() {
  const { t } = useI18n();
  const { config } = useConfig();
  const { openIntegrations } = useOpenSettings();
  const demoMode = config?.demoMode === true;
  const connection = latestInstance(config ?? {}, ['tailscale', 'headscale']);
  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type="tailscale" />
      <section className="ndc-set-block">
        <CalmeHeading info={demoMode ? t('integrations.vpnDemo') : t('integrations.vpnHint')}>{t('settings.calme.connection')}</CalmeHeading>
        <CalmeRow
          label={connection ? connection.name : t('integrations.notConnected')}
          value={connection ? t('integrations.vpnUsed') : t('integrations.vpnMissing')}
        >
          <button type="button" className="nd-btn nd-btn-accent" onClick={() => openIntegrations('vpn')}>{t('integrations.openPage')}</button>
        </CalmeRow>
      </section>
    </div>
  );
}
