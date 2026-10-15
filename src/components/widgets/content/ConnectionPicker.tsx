'use client';

import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import CustomSelect from '@/components/shared/CustomSelect';
import { getServiceIntegration } from '@/integrations/registry';
import type { IntegrationSection } from '@/components/modals/settings/tabs/IntegrationsTab';
import { useOpenSettings } from '@/components/integrations/useOpenSettings';
import type { IntegrationInstance } from '@/lib/types';

/** The saved connection a widget reads: the chosen one, or the first of its types when none was chosen (same rule as the server). */
export function chosenConnection(instances: IntegrationInstance[] | undefined, types: readonly string[], id: unknown): IntegrationInstance | undefined {
  const matching = (instances ?? []).filter(instance => types.includes(instance.type));
  return id === undefined || id === null ? matching[0] : matching.find(instance => instance.id === id);
}

/**
 * Which saved connection a widget reads (one Pi-hole among several…).
 * Connections are added and edited only in Settings → Integrations; this
 * picks among them and links there.
 */
export function ConnectionPicker({ types, section, value, onChange }: { types: readonly string[]; section: IntegrationSection; value: string | undefined; onChange: (id: string) => void }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { openIntegrations } = useOpenSettings();
  const connections = (config?.integrations ?? []).filter(instance => types.includes(instance.type));
  const current = chosenConnection(config?.integrations, types, value);
  const name = (type: string) => getServiceIntegration(type)?.name ?? type;
  return (
    <div className="ndw-connection">
      {connections.length > 1 ? (
        <CustomSelect
          ariaLabel={t('widgets.connection')}
          value={current?.id ?? ''}
          onChange={onChange}
          options={connections.map(instance => ({ value: instance.id, label: `${instance.name} · ${name(instance.type)}` }))}
        />
      ) : <span className="ndw-connection-name">{current ? [current.name, name(current.type)].join(" · ") : t('widgets.connectionNone')}</span>}
      <button type="button" className="nd-btn" onClick={() => openIntegrations(section)}>{t('integrations.openPage')}</button>
    </div>
  );
}
