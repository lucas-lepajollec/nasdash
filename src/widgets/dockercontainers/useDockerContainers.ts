'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useConfig } from '@/hooks/useConfig';
import { dockerJsonFetcher } from '@/lib/dockerErrorContract';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Containers of the selected Docker host (refreshed every 5 s), without the
 * ones matching a service of a hidden category, plus start/stop. Shared by
 * the Classic and Calme versions of the widget.
 */
export function useDockerContainers({ editMode, isVisible }: { editMode?: boolean; isVisible: boolean }) {
  const { t } = useI18n();
  const { config, showSecretSections } = useConfig();
  const hosts = useMemo(() => config?.dockerHosts || [], [config?.dockerHosts]);
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const [actionRunning, setActionRunning] = useState<Record<string, boolean>>({});
  const allowActions = config?.settings?.allowDockerActions ?? true;

  useEffect(() => {
    if (hosts.length > 0 && !selectedHostId) setSelectedHostId(hosts[0].id);
  }, [hosts, selectedHostId]);

  const { data: containers, error, isLoading, mutate } = useSWR(
    isVisible && selectedHostId ? `/api/docker/${selectedHostId}/containers?all=true` : null,
    dockerJsonFetcher,
    { refreshInterval: 5000 },
  );

  const containerList = useMemo(() => {
    const rawList = Array.isArray(containers) ? containers : [];
    if (showSecretSections || !config?.categories) return rawList;
    const secretServiceNames = new Set<string>();
    config.categories.forEach(cat => {
      if (cat.isSecret) cat.services.forEach(svc => secretServiceNames.add(svc.name.toLowerCase().trim()));
    });
    return rawList.filter((c: any) => {
      const isSecretContainer = (c.names || []).some((n: string) => secretServiceNames.has(n.replace(/^\//, '').toLowerCase().trim()))
        || secretServiceNames.has((c.names?.[0] || '').replace(/^\//, '').toLowerCase().trim());
      return !isSecretContainer;
    });
  }, [containers, config?.categories, showSecretSections]);

  const toggleContainer = async (containerId: string, currentState: string) => {
    if (editMode) return;
    setActionRunning(prev => ({ ...prev, [containerId]: true }));
    try {
      const action = currentState === 'running' ? 'stop' : 'start';
      const res = await fetch(`/api/docker/${selectedHostId}/containers/${containerId}?action=${action}`, { method: 'POST' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          alert(t("Action refusée. Session administrateur requise (veuillez vous connecter via le bouton Connexion en haut)."));
          return;
        }
        const data = await res.json();
        throw new Error(data.error || 'Action échouée');
      }
      await mutate();
    } catch (e) {
      console.error('Failed to change container state:', e);
    } finally {
      setActionRunning(prev => ({ ...prev, [containerId]: false }));
    }
  };

  return { hosts, selectedHostId, setSelectedHostId, containerList, error, isLoading, allowActions, actionRunning, toggleContainer };
}

/** Repeats the list until its length is a multiple of `targetMultiple`, so an endless scroll loops cleanly. */
export function getPaddedList<T>(list: T[], targetMultiple: number): T[] {
  if (list.length === 0) return [];
  let k = 1;
  while ((list.length * k) % targetMultiple !== 0 && k < 12) k++;
  const result: T[] = [];
  for (let i = 0; i < k; i++) result.push(...list);
  return result;
}

export const containerName = (c: any): string => c.names?.[0]?.replace(/^\//, '') || c.id.substring(0, 12);
