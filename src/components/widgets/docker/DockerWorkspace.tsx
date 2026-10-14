'use client';

import { demoFetch } from '@/lib/demoTransport';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useDocker } from '@/hooks/useDocker';
import { useI18n } from '@/i18n/I18nProvider';
import type { DockerHost } from '@/lib/types';
import ConfirmModal from '../../modals/ConfirmModal';
import { DockerHostFormModal, type DockerHostDraft } from './DockerViews';

/**
 * Page-level state shared by the linked Docker widgets: the active host, the
 * selected container, pending confirmations and the host form. Widgets placed
 * on the same page stay in sync; each page has its own workspace.
 */

export type ContainerAction = 'start' | 'stop' | 'restart' | 'remove';

/** Fields of the container list used by the Docker widgets. */
export interface DockerContainerSummary {
  id: string;
  fullId: string;
  names: string[];
  image: string;
  state: string;
  status: string;
}

type DockerState = ReturnType<typeof useDocker>;

interface DockerWorkspaceValue extends DockerState {
  hosts: DockerHost[];
  /** Containers minus those matching hidden secret services. */
  visibleContainers: DockerContainerSummary[];
  requestAction: (id: string, action: ContainerAction, name: string) => void;
  /** Opens the host form: empty to add a host, filled to edit one. */
  openHostForm: (host?: DockerHost) => void;
  requestHostRemoval: (host: { id: string; name: string }) => void;
  /** Moves a host before or after another one (saved order). */
  moveHost: (activeId: string, overId: string) => void;
  /** Hosts being removed: shown as busy until the configuration is saved. */
  removingHostIds: string[];
  /** The page still has the former counters widget: the hosts widget leaves its counters to it. */
  summaryOnPage: boolean;
}

const DockerWorkspaceContext = createContext<DockerWorkspaceValue | null>(null);

export function DockerWorkspaceProvider({ enabled, summaryOnPage = false, children }: { enabled: boolean; summaryOnPage?: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  const { config, refresh, showSecretSections, reorderDockerHosts } = useConfig();
  const hosts = useMemo(() => config?.dockerHosts || [], [config?.dockerHosts]);
  const docker = useDocker(hosts, enabled);
  const { activeHostId, setActiveHostId, containers, containerAction } = docker;
  const [hostForm, setHostForm] = useState<{ host?: DockerHost } | null>(null);
  const [removingHostIds, setRemovingHostIds] = useState<string[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<{ id: string; action: ContainerAction; name: string } | null>(null);
  const [pendingDeleteHost, setPendingDeleteHost] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!activeHostId && hosts.length > 0) setActiveHostId(hosts[0].id);
    if (activeHostId && !hosts.some(host => host.id === activeHostId)) setActiveHostId(hosts[0]?.id ?? null);
  }, [activeHostId, hosts, setActiveHostId]);

  const categories = config?.categories;
  const visibleContainers = useMemo<DockerContainerSummary[]>(() => {
    const list = containers as DockerContainerSummary[];
    if (showSecretSections || !categories) return list;
    const secretServiceNames = new Set<string>();
    categories.forEach(category => {
      if (category.isSecret) category.services.forEach(service => secretServiceNames.add(service.name.toLowerCase().trim()));
    });
    return list.filter(container => !(container.names || []).some(name => (
      secretServiceNames.has(name.replace(/^\//, '').toLowerCase().trim())
    )));
  }, [containers, categories, showSecretSections]);

  const requestAction = (id: string, action: ContainerAction, name: string) => {
    if (action === 'start') containerAction(id, action).catch(() => undefined);
    else setPendingConfirm({ id, action, name });
  };

  const handleSaveHost = async (data: DockerHostDraft) => {
    const editing = hostForm?.host;
    const response = await demoFetch('/api/config', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `type` names the update; the host's own kind travels as `connection`.
      body: JSON.stringify({ ...data, type: 'dockerHost', connection: data.type, ...(editing ? { id: editing.id } : {}) }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(t(payload?.error || 'docker.failure.save_host'));
    await refresh();
    // A new host is opened at once: its containers load in sight.
    const id = editing?.id ?? (typeof payload?.id === 'string' ? payload.id : null);
    if (id) setActiveHostId(id);
    setHostForm(null);
  };

  const handleDeleteHost = async (id: string) => {
    setRemovingHostIds(current => [...current, id]);
    try {
      const response = await demoFetch(`/api/config?type=dockerHost&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(t('docker.failure.delete_host'));
      if (activeHostId === id) setActiveHostId(hosts.find(host => host.id !== id)?.id || null);
      await refresh();
    } finally {
      setRemovingHostIds(current => current.filter(item => item !== id));
    }
  };

  const moveHost = (activeId: string, overId: string) => {
    const from = hosts.findIndex(host => host.id === activeId);
    const to = hosts.findIndex(host => host.id === overId);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...hosts];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void reorderDockerHosts(next);
  };

  const value: DockerWorkspaceValue = {
    ...docker,
    hosts,
    visibleContainers,
    requestAction,
    openHostForm: host => setHostForm({ host }),
    requestHostRemoval: host => setPendingDeleteHost(host),
    moveHost,
    removingHostIds,
    summaryOnPage,
  };

  const demoMode = config?.demoMode === true;
  const actionVerb = pendingConfirm?.action === 'stop' ? t('arrêter') : pendingConfirm?.action === 'restart' ? t('redémarrer') : t('supprimer');

  return (
    <DockerWorkspaceContext.Provider value={value}>
      {docker.actionError && !pendingConfirm && <p role="alert" className="ndc-dialog-hint" style={{ color: 'var(--nd-red)' }}>{docker.actionError}</p>}
      {children}
      {hostForm && <DockerHostFormModal host={hostForm.host} onClose={() => setHostForm(null)} onSave={handleSaveHost} />}
      <ConfirmModal
        isOpen={!!pendingConfirm}
        onClose={() => setPendingConfirm(null)}
        onConfirm={async () => { if (pendingConfirm) await containerAction(pendingConfirm.id, pendingConfirm.action); }}
        title={
          pendingConfirm?.action === 'stop' ? t('Arrêter le conteneur')
            : pendingConfirm?.action === 'restart' ? t('Redémarrer le conteneur')
              : t('Supprimer le conteneur')
        }
        description={demoMode
          ? t('docker.demoAction', { name: pendingConfirm?.name || '' })
          : t('docker.confirmAction', { action: actionVerb, name: pendingConfirm?.name || '' })}
        confirmLabel={
          pendingConfirm?.action === 'stop' ? t('Arrêter')
            : pendingConfirm?.action === 'restart' ? t('Redémarrer')
              : t('Supprimer')
        }
        cancelLabel={t('Annuler')}
      />
      <ConfirmModal
        isOpen={!!pendingDeleteHost}
        onClose={() => setPendingDeleteHost(null)}
        onConfirm={async () => { if (pendingDeleteHost) await handleDeleteHost(pendingDeleteHost.id); }}
        title={t("Supprimer l'hôte Docker")}
        description={demoMode
          ? t('docker.demoHostRemove', { name: pendingDeleteHost?.name || '' })
          : t('docker.confirmHostDelete', { name: pendingDeleteHost?.name || '' })}
        confirmLabel={t('Supprimer')}
        cancelLabel={t('Annuler')}
      />
    </DockerWorkspaceContext.Provider>
  );
}

export function useDockerWorkspace(): DockerWorkspaceValue {
  const context = useContext(DockerWorkspaceContext);
  if (!context) throw new Error('Docker widgets must be rendered inside a DockerWorkspaceProvider');
  return context;
}
