'use client';

import React, { useContext } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import CustomSelect from '@/components/shared/CustomSelect';
import { getServiceIntegration } from '@/integrations/registry';
import type { IntegrationSection } from '@/components/modals/settings/tabs/IntegrationsTab';
import { useOpenSettings } from '@/components/integrations/useOpenSettings';
import type { IntegrationInstance } from '@/lib/types';
import { CloseWidgetDialog } from './kit';

/** The saved connection a widget reads: the chosen one, or the first of its types when none was chosen (same rule as the server). */
export function chosenConnection(instances: IntegrationInstance[] | undefined, types: readonly string[], id: unknown): IntegrationInstance | undefined {
  const matching = (instances ?? []).filter(instance => types.includes(instance.type));
  return id === undefined || id === null ? matching[0] : matching.find(instance => instance.id === id);
}

/** The service's name beside the connection's, unless the connection is simply named after it ("Jellyfin", not "Jellyfin · Jellyfin"). */
export function connectionDetail(instance: IntegrationInstance): string | undefined {
  const service = getServiceIntegration(instance.type)?.name ?? instance.type;
  return instance.name.trim().toLowerCase() === service.toLowerCase() ? undefined : service;
}
export const connectionLabel = (instance: IntegrationInstance) => [instance.name, connectionDetail(instance)].filter(Boolean).join(' · ');

/**
 * Which saved connection a widget reads (one Pi-hole among several…).
 * Connections are added and edited only in Settings → Integrations; this
 * picks among them and links there.
 */
export function ConnectionPicker({ types, section, value, onChange }: { types: readonly string[]; section: IntegrationSection; value: string | undefined; onChange: (id: string) => void }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { openIntegrations } = useOpenSettings();
  const closeDialog = useContext(CloseWidgetDialog);
  const connections = (config?.integrations ?? []).filter(instance => types.includes(instance.type));
  const current = chosenConnection(config?.integrations, types, value);
  return (
    <div className="ndw-connection">
      {connections.length > 1 ? (
        <CustomSelect
          ariaLabel={t('widgets.connection')}
          value={current?.id ?? ''}
          onChange={onChange}
          options={connections.map(instance => ({ value: instance.id, label: connectionLabel(instance) }))}
        />
      ) : <span className="ndw-connection-name">{current ? connectionLabel(current) : t('widgets.connectionNone')}</span>}
      <button type="button" className="nd-btn" onClick={() => { closeDialog?.(); openIntegrations(section); }}>{t('integrations.openPage')}</button>
    </div>
  );
}
