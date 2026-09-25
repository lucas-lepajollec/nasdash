'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import type { IntegrationInstance } from '@/lib/types';
import { selectableDeviceIntegrations } from '@/integrations/registry';
import { devicesUsing, monitoringInstances } from '@/integrations/sources';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import ConfirmModal from '../../ConfirmModal';
import { CalmeHeading } from '../shared/CalmeControls';
import { MONITORING_INFO, MonitoringConnectionDialog, testConnection, type TestResult } from '@/components/integrations/MonitoringConnectionDialog';
import { ServiceConnectionDialog } from '@/components/integrations/ServiceConnectionDialog';
import { IntegrationLogo } from '@/components/integrations/IntegrationLogo';
import { DockerHostFormModal, type DockerHostDraft } from '@/components/widgets/docker/DockerViews';

/** Where the widgets and dialogs link to: `settings → integrations → <section>`. */
export type IntegrationSection = 'monitoring' | 'docker' | 'vpn';
export const integrationSectionId = (section: IntegrationSection) => `settings-integrations-${section}`;

type Status = TestResult | 'running' | undefined;

/** A tile of the catalogue: logo, name, one line; a click adds one. */
function Tile({ logo, name, description, onClick }: { logo: string; name: string; description: string; onClick: () => void }) {
  return (
    <button type="button" className="ndc-int-tile" onClick={onClick}>
      <IntegrationLogo id={logo} size={34} />
      <span className="ndc-int-tile-text">
        <span className="ndc-int-tile-name">{name}</span>
        <span className="ndc-int-tile-desc">{description}</span>
      </span>
    </button>
  );
}

/** A connection that is set up: logo, name, details, state, actions. */
function Connection({ logo, name, details, status, onTest, onEdit, onRemove }: {
  logo: string;
  name: string;
  details: string;
  status?: Status;
  onTest?: () => void;
  onEdit?: () => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const state = status === 'running' ? 'running' : status ? (status.ok ? 'ok' : 'error') : 'idle';
  return (
    <div className={`ndc-int-row is-${state}`}>
      <IntegrationLogo id={logo} size={30} />
      <span className="ndc-int-row-text">
        <span className="ndc-int-row-name">{name}</span>
        <span className="ndc-int-row-details">{details}</span>
        {status && status !== 'running' && !status.ok && <span className="ndc-int-row-error">{t(status.message, { count: 0 })}</span>}
      </span>
      {onTest && (
        <span className={`ndc-int-state is-${state}`} title={status && status !== 'running' ? t(status.message, { count: status.count ?? 0 }) : undefined}>
          {state === 'running' ? <Loader2 size={12} className="nd-spin" /> : <span className="ndc-int-state-dot" aria-hidden="true" />}
          {state === 'ok' ? t('integrations.state.ok') : state === 'error' ? t('integrations.state.error') : state === 'running' ? t('integrations.state.testing') : t('integrations.state.unknown')}
        </span>
      )}
      <span className="ndc-int-row-actions">
        {onTest && <button type="button" className="ndc-icon-button" onClick={onTest} disabled={state === 'running'} title={t('integrations.test')} aria-label={t('integrations.test')}><RefreshCw size={13} /></button>}
        {onEdit && <button type="button" className="ndc-icon-button" onClick={onEdit} title={t('Modifier')} aria-label={t('Modifier')}><Pencil size={13} /></button>}
        <button type="button" className="ndc-icon-button" onClick={onRemove} title={t('Supprimer')} aria-label={t('Supprimer')}><Trash2 size={13} /></button>
      </span>
    </div>
  );
}

/**
 * Every connection of the dashboard in one place, in the order a newcomer
 * needs them. Each category shows the connections already set up (their
 * state is tested when the page opens) and, below, the tiles to add one:
 * machine monitoring, Docker engines, private network. Widgets and dialogs
 * link to a category of this page.
 */
export function IntegrationsTab({ targetSection, onOpenTab, showSensitive = false }: {
  targetSection?: string;
  /** Opens another settings tab (the machines). */
  onOpenTab: (tab: string) => void;
  showSensitive?: boolean;
}) {
  const { t } = useI18n();
  const { config, deleteIntegration, refresh } = useConfig();
  const [editing, setEditing] = useState<{ type: string; instance?: IntegrationInstance } | null>(null);
  const [service, setService] = useState<string | null>(null);
  const [removing, setRemoving] = useState<IntegrationInstance | null>(null);
  const [tests, setTests] = useState<Record<string, Status>>({});
  const [addingHost, setAddingHost] = useState<DockerHostDraft['type'] | null>(null);
  const [removingHost, setRemovingHost] = useState<{ id: string; name: string } | null>(null);
  const demoMode = config?.demoMode === true;
  const instances = monitoringInstances(config);
  const devices = config?.devices ?? [];
  const hosts = config?.dockerHosts ?? [];
  const mesh = (config?.integrations ?? []).filter(instance => instance.type === 'tailscale' || instance.type === 'headscale');

  // Opened from a widget or a dialog: straight to its category.
  useEffect(() => {
    if (!targetSection) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(integrationSectionId(targetSection as IntegrationSection))?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    return () => window.cancelAnimationFrame(frame);
  }, [targetSection]);

  const runTest = async (instance: IntegrationInstance) => {
    setTests(current => ({ ...current, [instance.id]: 'running' }));
    const result = await testConnection({ type: instance.type, id: instance.id });
    setTests(current => ({ ...current, [instance.id]: result }));
  };

  // Each saved connection is tried once when the page opens: its state shows at a glance.
  const tested = useRef(new Set<string>());
  useEffect(() => {
    for (const instance of instances) {
      if (tested.current.has(instance.id)) continue;
      tested.current.add(instance.id);
      void runTest(instance);
    }
  });

  const address = (value: string | undefined, port?: string) => {
    const where = [value?.replace(/^https?:\/\//, ''), port].filter(Boolean).join(':');
    return where ? (showSensitive ? where : '•••') : '';
  };

  const addHost = async (draft: DockerHostDraft) => {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, type: 'dockerHost', connection: draft.type }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error || t('integrations.saveFailed'));
    }
    await refresh();
    setAddingHost(null);
  };

  const removeHost = async (id: string) => {
    await fetch(`/api/config?type=dockerHost&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await refresh();
  };

  const scrollTo = (section: IntegrationSection) => document.getElementById(integrationSectionId(section))?.scrollIntoView({ behavior: 'smooth' });

  const section = (id: IntegrationSection, title: string, hint: string, rows: React.ReactNode[], empty: string, tiles: React.ReactNode) => (
    <section className="ndc-set-block ndc-int-section" id={integrationSectionId(id)}>
      <CalmeHeading info={hint}>{title}</CalmeHeading>
      {rows.length ? <div className="ndc-int-rows">{rows}</div> : <div className="ndc-int-empty">{empty}</div>}
      <div className="ndc-int-add-label">{t('integrations.addLabel')}</div>
      <div className="ndc-int-tiles">{tiles}</div>
    </section>
  );

  return (
    <div className="ndc-set-page ndc-int-page">
      <section className="ndc-set-block">
        <div className="ndc-setup">
          <button type="button" className={`ndc-setup-step ${instances.length ? 'is-done' : 'is-next'}`} onClick={() => scrollTo('monitoring')}>
            <span className="ndc-setup-number" aria-hidden="true">{instances.length ? <CheckCircle2 size={15} /> : 1}</span>
            <span className="ndc-setup-text">
              <span className="ndc-setup-label">{t('integrations.stepSources')}</span>
              <span className="ndc-setup-state">{instances.length ? t('integrations.sourcesCount', { count: instances.length }) : t('integrations.stepSourcesAction')}</span>
            </span>
          </button>
          <button type="button" className={`ndc-setup-step ${devices.length ? 'is-done' : instances.length ? 'is-next' : ''}`} onClick={() => onOpenTab('widget-devices')}>
            <span className="ndc-setup-number" aria-hidden="true">{devices.length ? <CheckCircle2 size={15} /> : 2}</span>
            <span className="ndc-setup-text">
              <span className="ndc-setup-label">{t('integrations.stepMachines')}</span>
              <span className="ndc-setup-state">{devices.length ? t('integrations.machinesCount', { count: devices.length }) : t('integrations.stepMachinesAction')}</span>
            </span>
          </button>
        </div>
      </section>

      {section(
        'monitoring', t('integrations.monitoring'), t('integrations.monitoringHint'),
        instances.map(instance => {
          const used = devicesUsing(config, instance.id);
          const type = selectableDeviceIntegrations().find(manifest => manifest.id === instance.type)?.name ?? instance.type;
          return (
            <Connection
              key={instance.id}
              logo={instance.type}
              name={instance.name}
              details={[type, address(instance.settings.ip, instance.settings.port), used.length ? t('integrations.usedBy', { count: used.length }) : t('integrations.unused')].filter(Boolean).join(' · ')}
              status={tests[instance.id]}
              onTest={() => void runTest(instance)}
              onEdit={() => setEditing({ type: instance.type, instance })}
              onRemove={() => setRemoving(instance)}
            />
          );
        }),
        t('integrations.monitoringEmpty'),
        selectableDeviceIntegrations().map(manifest => (
          <Tile key={manifest.id} logo={manifest.id} name={manifest.name} description={t(MONITORING_INFO[manifest.id]?.descriptionKey ?? '')} onClick={() => setEditing({ type: manifest.id })} />
        )),
      )}

      {section(
        'docker', t('integrations.docker'), t('integrations.dockerHint'),
        hosts.map(host => (
          <Connection
            key={host.id}
            logo={host.type}
            name={host.name}
            details={[t(`integrations.docker.${host.type}`), host.type === 'socket' ? host.socketPath ?? '' : address(host.url)].filter(Boolean).join(' · ')}
            onRemove={() => setRemovingHost({ id: host.id, name: host.name })}
          />
        )),
        t('integrations.dockerEmpty'),
        (['tcp', 'socket', 'portainer', 'dockhand'] as const).map(kind => (
          <Tile key={kind} logo={kind} name={t(`integrations.docker.${kind}`)} description={t(`integrations.dockerInfo.${kind}`)} onClick={() => setAddingHost(kind)} />
        )),
      )}

      {section(
        'vpn', t('integrations.vpn'), demoMode ? t('integrations.vpnDemo') : t('integrations.vpnHint'),
        mesh.map(instance => (
          <Connection
            key={instance.id}
            logo={instance.type}
            name={instance.name}
            details={[instance.type === 'headscale' ? 'Headscale' : 'Tailscale', instance.type === 'headscale' ? address(instance.settings.url) : instance.settings.tailnet].filter(Boolean).join(' · ')}
            onEdit={demoMode ? undefined : () => setService(instance.type)}
            onRemove={() => setRemoving(instance)}
          />
        )),
        t('integrations.vpnEmpty'),
        (['tailscale', 'headscale'] as const).map(kind => (
          <Tile key={kind} logo={kind} name={kind === 'tailscale' ? 'Tailscale' : 'Headscale'} description={t(`integrations.info.${kind}`)} onClick={() => { if (!demoMode) setService(kind); }} />
        )),
      )}

      {editing && <MonitoringConnectionDialog type={editing.type} instance={editing.instance} onClose={() => setEditing(null)} showSensitive={showSensitive} />}
      {service && <ServiceConnectionDialog type={service} onClose={() => setService(null)} />}
      {addingHost && <DockerHostFormModal initialConnection={addingHost} onClose={() => setAddingHost(null)} onSave={addHost} />}
      <ConfirmModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => { if (removing) void deleteIntegration(removing.id); setRemoving(null); }}
        title={t('integrations.removeTitle')}
        description={removing ? (devicesUsing(config, removing.id).length
          ? t('integrations.removeUsed', { name: removing.name, machines: devicesUsing(config, removing.id).map(device => device.name).join(', ') })
          : t('integrations.removeUnused', { name: removing.name })) : ''}
      />
      <ConfirmModal
        isOpen={!!removingHost}
        onClose={() => setRemovingHost(null)}
        onConfirm={() => { if (removingHost) void removeHost(removingHost.id); setRemovingHost(null); }}
        title={t('integrations.removeHostTitle')}
        description={removingHost ? t('integrations.removeUnused', { name: removingHost.name }) : ''}
      />
    </div>
  );
}
