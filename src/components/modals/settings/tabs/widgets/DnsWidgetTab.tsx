import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { useOpenSettings } from '@/components/integrations/useOpenSettings';
import { IntegrationLogo } from '@/components/integrations/IntegrationLogo';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading, CalmeRow } from '../../shared/CalmeControls';

/**
 * The DNS widget reads the Pi-hole and AdGuard Home connections saved on the
 * Integrations page; each widget picks one of them. This tab lists them and
 * links there: connections are added and edited only on that page.
 */
export function DnsWidgetTab() {
  const { t } = useI18n();
  const { config } = useConfig();
  const { openIntegrations } = useOpenSettings();
  const connections = (config?.integrations ?? []).filter(instance => instance.type === 'pihole' || instance.type === 'adguard');
  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type="dns" />
      <section className="ndc-set-block">
        <CalmeHeading
          info={t('settings.dns.connectionsHint')}
          action={<button type="button" className="nd-btn nd-btn-accent" onClick={() => openIntegrations('dns')}>{t('integrations.openPage')}</button>}
        >
          {t('settings.calme.connection')}
        </CalmeHeading>
        {connections.length
          ? connections.map(instance => (
            <CalmeRow key={instance.id} label={<span className="ndc-source-logo"><IntegrationLogo id={instance.type} size={16} />{instance.name}</span>} value={instance.type === 'pihole' ? 'Pi-hole' : 'AdGuard Home'} />
          ))
          : <p className="ndc-source-empty">{t('settings.dns.empty')}</p>}
      </section>
    </div>
  );
}
