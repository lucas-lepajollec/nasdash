'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { DockerHost } from '@/lib/types';
import { dockerJsonFetcher } from '@/lib/dockerErrorContract';

export function getDockerRequestKeys(
  activeHostId: string | null,
  selectedContainerId: string | null,
  enabled: boolean,
) {
  const hostBase = enabled && activeHostId ? `/api/docker/${activeHostId}` : null;

  return {
    containers: hostBase ? `${hostBase}/containers?all=true` : null,
    detail: hostBase && selectedContainerId ? `${hostBase}/containers/${selectedContainerId}` : null,
    images: hostBase ? `${hostBase}/images` : null,
    volumes: hostBase ? `${hostBase}/volumes` : null,
  };
}

export function useDocker(hosts: DockerHost[], enabled = true) {
  const [activeHostId, setActiveHostId] = useState<string | null>(hosts[0]?.id || null);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const requestKeys = getDockerRequestKeys(activeHostId, selectedContainerId, enabled);

  // Containers list
  const { data: containers, error: containersError, isLoading: containersLoading, mutate: refreshContainers } = useSWR(
    requestKeys.containers,
    dockerJsonFetcher,
    { refreshInterval: 5000 }
  );

  // Container detail (only when one is selected)
  const { data: containerDetail, error: detailError, mutate: refreshDetail } = useSWR(
    requestKeys.detail,
    dockerJsonFetcher,
    { refreshInterval: 3000 }
  );

  // Images
  const { data: images, error: imagesError, isLoading: imagesLoading, mutate: refreshImages } = useSWR(
    requestKeys.images,
    dockerJsonFetcher,
    { refreshInterval: 30000 } // Refresh every 30s — images don't change often
  );

  // Volumes
  const { data: volumes, error: volumesError, isLoading: volumesLoading, mutate: refreshVolumes } = useSWR(
    requestKeys.volumes,
    dockerJsonFetcher,
    { refreshInterval: 30000 }
  );

  // Container action
  const containerAction = useCallback(async (containerId: string, action: 'start' | 'stop' | 'restart' | 'remove') => {
    if (!activeHostId) return;
    setActionLoading(`${containerId}-${action}`);
    try {
      const res = await fetch(`/api/docker/${activeHostId}/containers/${containerId}?action=${action}`, {
        method: 'POST',
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Session administrateur requise. Veuillez vous connecter en haut à droite.");
        }
        const data = await res.json();
        throw new Error(data.error || 'Action failed');
      }
      // Wait a beat then refresh
      await new Promise(r => setTimeout(r, 500));
      await refreshContainers();
      if (selectedContainerId === containerId) {
        if (action === 'remove') {
          setSelectedContainerId(null);
        } else {
          await refreshDetail();
        }
      }
    } catch (e: any) {
      console.error(`Docker action ${action} failed:`, e.message);
      throw e;
    } finally {
      setActionLoading(null);
    }
  }, [activeHostId, selectedContainerId, refreshContainers, refreshDetail]);

  return {
    // Host
    activeHostId,
    setActiveHostId,
    activeHost: hosts.find(h => h.id === activeHostId) || null,

    // Containers
    containers: Array.isArray(containers) ? containers : [],
    containersError,
    containersLoading,
    refreshContainers,

    // Selected container
    selectedContainerId,
    setSelectedContainerId,
    containerDetail,
    detailError,

    // Images
    images: Array.isArray(images) ? images : [],
    imagesError,
    imagesLoading,
    refreshImages,

    // Volumes
    volumes: Array.isArray(volumes) ? volumes : [],
    volumesError,
    volumesLoading,
    refreshVolumes,

    // Actions
    containerAction,
    actionLoading,
  };
}
