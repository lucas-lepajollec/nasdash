'use client';

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
  openHostForm: () => void;
  requestHostRemoval: (host: { id: string; name: string }) => void;
}

const DockerWorkspaceContext = createContext<DockerWorkspaceValue | null>(null);

export function DockerWorkspaceProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  const { config, refresh, showSecretSections } = useConfig();
  const hosts = useMemo(() => config?.dockerHosts || [], [config?.dockerHosts]);
  const docker = useDocker(hosts, enabled);
  const { activeHostId, setActiveHostId, containers, containerAction } = docker;
  const [showHostForm, setShowHostForm] = useState(false);
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

  const handleAddHost = async (data: DockerHostDraft) => {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `type` names the update; the host's own kind travels as `connection`.
      body: JSON.stringify({ ...data, type: 'dockerHost', connection: data.type }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Impossible d’enregistrer cet hôte Docker.');
    }
    await refresh();
    setShowHostForm(false);
  };

  const handleDeleteHost = async (id: string) => {
    await fetch(`/api/config?type=dockerHost&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await refresh();
    if (activeHostId === id) setActiveHostId(hosts.find(host => host.id !== id)?.id || null);
  };

  const value: DockerWorkspaceValue = {
    ...docker,
    hosts,
    visibleContainers,
    requestAction,
    openHostForm: () => setShowHostForm(true),
    requestHostRemoval: host => setPendingDeleteHost(host),
  };

  const demoMode = config?.demoMode === true;
  const actionVerb = pendingConfirm?.action === 'stop' ? t('arrêter') : pendingConfirm?.action === 'restart' ? t('redémarrer') : t('supprimer');

  return (
    <DockerWorkspaceContext.Provider value={value}>
      {children}
      {showHostForm && <DockerHostFormModal onClose={() => setShowHostForm(false)} onSave={handleAddHost} />}
      <ConfirmModal
        isOpen={!!pendingConfirm}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => { if (pendingConfirm) containerAction(pendingConfirm.id, pendingConfirm.action).catch(() => undefined); }}
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
        onConfirm={() => { if (pendingDeleteHost) void handleDeleteHost(pendingDeleteHost.id); }}
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
