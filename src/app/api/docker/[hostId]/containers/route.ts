import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import {
  classifyDockerError,
  dockerFailureStatus,
  fetchDockerApi,
  readDockerJson,
  reportDockerFailure,
  reportDockerSuccess,
} from '@/lib/dockerClient';
import { isDemoMode } from '@/lib/demoMode';
import { getDemoContainerState, isDemoContainerRemoved, withDemoSession } from '@/lib/demoSession';
import { DEMO_DOCKER_SERVICES, demoContainerStatus } from '@/lib/demoDockerFixtures';

export const dynamic = 'force-dynamic';

interface DockerApiPort {
  IP?: string;
  PrivatePort: number;
  PublicPort?: number;
  Type: string;
}

interface DockerApiMount {
  Type: string;
  Name?: string;
  Source: string;
  Destination: string;
  RW: boolean;
}

interface DockerApiContainerSummary {
  Id: string;
  Names?: string[];
  Image?: string;
  ImageID?: string;
  State?: string;
  Status?: string;
  Created?: number;
  Ports?: DockerApiPort[];
  Mounts?: DockerApiMount[];
  Labels?: Record<string, string>;
}

function getDockerHost(hostId: string) {
  const config = readConfig();
  const hosts = config.dockerHosts || [];
  return hosts.find(h => h.id === hostId);
}

// GET /api/docker/[hostId]/containers — list all containers
async function handleGET(
  request: Request,
  segmentData: { params: Promise<{ hostId: string }> }
) {
  const config = readConfig();
  const access = checkReadAccess(
    request,
    config.settings?.securityMode || 'public',
    READ_ACCESS.dockerContainers
  );
  if (access.error) return access.error;

  let resolvedHostId = 'unknown';
  try {
    const { hostId } = await segmentData.params;
    resolvedHostId = hostId;
    const host = getDockerHost(hostId);
    if (!host) {
      return NextResponse.json({ error: 'Docker host not found' }, { status: 404 });
    }

    // Return mock data for demo/mock hosts
    const isMockMode = isDemoMode() || host.url.includes('mock') || host.id.includes('mock-host');
    if (isMockMode) {
      const mockContainers = DEMO_DOCKER_SERVICES.map((service, index) => {
        const state = getDemoContainerState(service.id, service.defaultState);
        return {
          id: service.id,
          fullId: service.id.padEnd(64, '0'),
          names: [service.name],
          image: service.image,
          imageId: `${service.id}-image`,
          state,
          status: demoContainerStatus(state),
          created: Math.floor(Date.now() / 1000 - (10_800 + index * 3_600)),
          ports: service.ports,
          mounts: service.mounts,
          labels: {
            'com.docker.compose.project': 'nasdash-demo',
            'com.docker.compose.service': service.name,
            'io.nasdash.demo.service-id': service.serviceId,
          },
        };
      });

      return NextResponse.json(mockContainers.filter(container => !isDemoContainerRemoved(container.id)));
    }

    const url = new URL(request.url);
    const all = url.searchParams.get('all') !== 'false'; // default true
    
    const response = await fetchDockerApi(host.url, `/containers/json?all=${all}&size=false`);
    const rawContainers = await readDockerJson(response) as DockerApiContainerSummary[];
    
    const containers = rawContainers.map(c => ({
      id: c.Id?.substring(0, 12) || c.Id,
      fullId: c.Id,
      names: (c.Names || []).map((n: string) => n.replace(/^\//, '')),
      image: c.Image,
      imageId: c.ImageID?.substring(0, 19) || '',
      state: c.State?.toLowerCase() || 'unknown',
      status: c.Status || '',
      created: c.Created || 0,
      ports: (c.Ports || []).map(p => ({
        ip: p.IP,
        privatePort: p.PrivatePort,
        publicPort: p.PublicPort,
        type: p.Type,
      })),
      mounts: (c.Mounts || []).map(m => ({
        type: m.Type,
        name: m.Name,
        source: m.Source,
        destination: m.Destination,
        rw: m.RW,
      })),
      labels: c.Labels || {},
    }));

    reportDockerSuccess(resolvedHostId);
    return NextResponse.json(containers);
  } catch (error: unknown) {
    const failure = classifyDockerError(error);
    reportDockerFailure(resolvedHostId, failure);
    return NextResponse.json(failure, { status: dockerFailureStatus(failure) });
  }
}

export function GET(
  request: Request,
  segmentData: { params: Promise<{ hostId: string }> },
) {
  return withDemoSession(request, () => handleGET(request, segmentData));
}
