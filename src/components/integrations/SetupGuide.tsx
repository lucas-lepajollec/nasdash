'use client';

import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { monitoringInstances } from '@/integrations/sources';
import { latestInstance } from '@/integrations/instances';
import { useOpenSettings } from './useOpenSettings';

/**
 * What a widget shows before it can work, in the order to follow: for the
 * machine widgets, connect a monitoring source then add the machines; for
 * Docker, add an engine; for the mesh widget, connect Tailscale or Headscale.
 * Each step links straight to the right place; done steps are ticked.
 * Visitors who cannot change the settings are told an admin has to.
 */
export function SetupGuide({ kind }: { kind: 'devices' | 'docker' | 'vpn' }) {
  const { t } = useI18n();
  const { config, user } = useConfig();
  const { openIntegrations, openMachines } = useOpenSettings();
  const admin = user?.role === 'admin';

  const steps = kind === 'devices'
    ? [
      { done: monitoringInstances(config).length > 0, label: t('setup.devices.source'), action: t('setup.devices.sourceAction'), open: () => openIntegrations('monitoring') },
      { done: (config?.devices ?? []).length > 0, label: t('setup.devices.machines'), action: t('setup.devices.machinesAction'), open: openMachines },
    ]
    : kind === 'docker'
      ? [{ done: (config?.dockerHosts ?? []).length > 0, label: t('setup.docker.engine'), action: t('setup.docker.engineAction'), open: () => openIntegrations('docker') }]
      : [{ done: !!latestInstance(config ?? {}, ['tailscale', 'headscale']), label: t('setup.vpn.connect'), action: t('setup.vpn.connectAction'), open: () => openIntegrations('vpn') }];
  const next = steps.findIndex(step => !step.done);

  return (
    <div className="ndc-guide">
      <span className="ndc-guide-title">{t(kind === 'devices' ? 'setup.devices.title' : kind === 'docker' ? 'setup.docker.title' : 'setup.vpn.title')}</span>
      <ol className="ndc-guide-steps">
        {steps.map((step, index) => (
          <li key={step.label} className={`ndc-guide-step ${step.done ? 'is-done' : index === next ? 'is-next' : ''}`}>
            <span className="ndc-setup-number" aria-hidden="true">{step.done ? <CheckCircle2 size={14} /> : index + 1}</span>
            <span className="ndc-guide-label">{step.label}</span>
            {admin && !step.done && index === next && (
              <button type="button" className="nd-btn nd-btn-accent ndc-guide-action" onClick={step.open}>{step.action} <ArrowRight size={12} /></button>
            )}
          </li>
        ))}
      </ol>
      {!admin && <span className="ndc-guide-note">{t('setup.adminOnly')}</span>}
    </div>
  );
}
