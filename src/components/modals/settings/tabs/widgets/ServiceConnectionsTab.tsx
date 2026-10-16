import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { useOpenSettings } from '@/components/integrations/useOpenSettings';
import { IntegrationLogo } from '@/components/integrations/IntegrationLogo';
import { getServiceIntegration } from '@/integrations/registry';
import type { IntegrationSection } from '../IntegrationsTab';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading, CalmeRow } from '../../shared/CalmeControls';
import { DNS_TYPES, PHOTO_TYPES } from '@/lib/widgetData/contracts';

/**
 * Settings tab of a widget that reads service connections (DNS, photos):
 * the connections saved in Integrations, listed, and the way there.
 * Connections are added and edited only on that page.
 */
export function ServiceConnectionsTab({ widget, types, section, hintKey, emptyKey }: {
  widget: string; types: readonly string[]; section: IntegrationSection; hintKey: string; emptyKey: string;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { openIntegrations } = useOpenSettings();
  const connections = (config?.integrations ?? []).filter(instance => types.includes(instance.type));
  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type={widget} />
      <section className="ndc-set-block">
        <CalmeHeading
          info={t(hintKey)}
          action={<button type="button" className="nd-btn nd-btn-accent" onClick={() => openIntegrations(section)}>{t('integrations.openPage')}</button>}
        >
          {t('settings.calme.connection')}
        </CalmeHeading>
        {connections.length
          ? connections.map(instance => (
            <CalmeRow key={instance.id} label={<span className="ndc-source-logo"><IntegrationLogo id={instance.type} size={16} />{instance.name}</span>} value={getServiceIntegration(instance.type)?.name ?? instance.type} />
          ))
          : <p className="ndc-source-empty">{t(emptyKey)}</p>}
      </section>
    </div>
  );
}

export const DnsWidgetTab = () => <ServiceConnectionsTab widget="dns" types={DNS_TYPES} section="dns" hintKey="settings.dns.connectionsHint" emptyKey="settings.dns.empty" />;
export const PhotosWidgetTab = () => <ServiceConnectionsTab widget="photos" types={PHOTO_TYPES} section="photos" hintKey="settings.photos.connectionsHint" emptyKey="settings.photos.empty" />;
