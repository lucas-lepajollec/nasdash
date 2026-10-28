import type { DockerHost, IntegrationInstance } from '@/lib/types';
import type { VpnTunnelSummary } from '@/lib/widgetData/contracts';
import { fetchDockerApi, readDockerJson } from '@/lib/dockerClient';

/** What the Docker Engine lists of a container, as far as the VPN widget needs it. */
export interface TunnelContainer {
  Id: string;
  Names?: string[];
  Image?: string;
  State?: string;
  HostConfig?: { NetworkMode?: string };
  Ports?: { PublicPort?: number }[];
  Labels?: Record<string, string>;
}
const nameOf = (container: TunnelContainer) => container.Labels?.['com.docker.compose.service'] || container.Names?.[0]?.replace(/^\//, '') || container.Id.slice(0, 12);
const project = (container: TunnelContainer) => container.Labels?.['com.docker.compose.project'];

/**
 * The containers that share this Gluetun's network (`network_mode: service:gluetun` or `container:gluetun`), and
 * those still tied to a Gluetun container that no longer exists: recreating Gluetun leaves them without network
 * until they are recreated too. The Gluetun container is the one publishing the control server's port, or the only
 * Gluetun found.
 */
export function tunnelServices(instance: IntegrationInstance, containers: TunnelContainer[]): Pick<VpnTunnelSummary, 'services' | 'detached'> | undefined {
  let port = 8000;
  try { const url = new URL(instance.settings.url); port = Number(url.port) || 8000; } catch { /* the default control port */ }
  const gateways = containers.filter(container => /gluetun/i.test(container.Image ?? ''));
  const gateway = gateways.length === 1 ? gateways[0] : gateways.filter(container => container.Ports?.some(item => item.PublicPort === port)).at(0);
  if (!gateway) return undefined;
  const references = new Set([gateway.Id, ...(gateway.Names ?? []).map(name => name.replace(/^\//, ''))]);
  const known = new Set(containers.flatMap(container => [container.Id, ...(container.Names ?? []).map(name => name.replace(/^\//, ''))]));
  const services: NonNullable<VpnTunnelSummary['services']> = [], detached: string[] = [];
  for (const container of containers) {
    const mode = container.HostConfig?.NetworkMode ?? '';
    if (!mode.startsWith('container:') || container === gateway) continue;
    const target = mode.slice('container:'.length);
    if (references.has(target)) services.push({ name: nameOf(container), running: container.State === 'running' });
    // A previous Gluetun of the same Compose project, gone since.
    else if (!known.has(target) && project(container) && project(container) === project(gateway)) detached.push(nameOf(container));
  }
  return { services: services.sort((a, b) => a.name.localeCompare(b.name)), detached: detached.sort() };
}

/** Every Docker host's containers, read in parallel; a host that fails is left out. */
export async function tunnelContainers(hosts: DockerHost[]): Promise<TunnelContainer[]> {
  const lists = await Promise.allSettled(hosts.slice(0, 8).map(async host => {
    const body = await readDockerJson(await fetchDockerApi(host, '/containers/json?all=true&size=false', {}, 4_000));
    return Array.isArray(body) ? body.filter((item): item is TunnelContainer => !!item && typeof item === 'object' && typeof (item as TunnelContainer).Id === 'string') : [];
  }));
  return lists.flatMap(result => result.status === 'fulfilled' ? result.value : []);
}
