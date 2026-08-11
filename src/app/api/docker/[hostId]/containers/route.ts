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

const dockerGlobal = globalThis as typeof globalThis & {
  __mockContainerStates?: Map<string, string>;
};
if (!dockerGlobal.__mockContainerStates) dockerGlobal.__mockContainerStates = new Map<string, string>();
const mockStates = dockerGlobal.__mockContainerStates;

function getDockerHost(hostId: string) {
  const config = readConfig();
  const hosts = config.dockerHosts || [];
  return hosts.find(h => h.id === hostId);
}

// GET /api/docker/[hostId]/containers — list all containers
export async function GET(
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
    const isMockMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || host.url.includes('mock') || host.id.includes('mock-host');
    if (isMockMode) {
      const isLarge = host.url.includes('mock-large') || host.id.includes('mock-host-large');
      const isSmall = host.url.includes('mock-small') || host.id.includes('mock-host-small');
      
      const getContainerState = (id: string, defaultState: string) => {
        const stored = mockStates.get(id);
        if (stored) {
          return {
            state: stored,
            status: stored === 'running' ? 'Up 5 minutes' : stored === 'paused' ? 'Paused' : 'Exited (0) 5 minutes ago'
          };
        }
        return {
          state: defaultState,
          status: defaultState === 'running' ? 'Up 3 hours' : defaultState === 'paused' ? 'Paused' : 'Exited (137) 10 minutes ago'
        };
      };

      const mockContainers = [
        {
          id: "mock11111111",
          fullId: "mock11111111111111111111111111111111",
          names: ["web-server"],
          image: "nginx:latest",
          imageId: "sha256:nginx",
          ...getContainerState("mock11111111", "running"),
          created: Math.floor(Date.now() / 1000 - 10800),
          ports: [{ privatePort: 80, publicPort: 80, type: "tcp" }],
          mounts: [],
          labels: {}
        },
        {
          id: "mock22222222",
          fullId: "mock22222222222222222222222222222222",
          names: ["postgres-db"],
          image: "postgres:15-alpine",
          imageId: "sha256:postgres",
          ...getContainerState("mock22222222", "running"),
          created: Math.floor(Date.now() / 1000 - 18000),
          ports: [{ privatePort: 5432, publicPort: 5432, type: "tcp" }],
          mounts: [],
          labels: {}
        }
      ];
 
      if (!isSmall) {
        mockContainers.push(
          {
            id: "mock33333333",
            fullId: "mock33333333333333333333333333333333",
            names: ["redis-cache"],
            image: "redis:alpine",
            imageId: "sha256:redis",
            ...getContainerState("mock33333333", "running"),
            created: Math.floor(Date.now() / 1000 - 3600),
            ports: [{ privatePort: 6379, publicPort: 6379, type: "tcp" }],
            mounts: [],
            labels: {}
          },
          {
            id: "mock44444444",
            fullId: "mock44444444444444444444444444444444",
            names: ["node-api"],
            image: "node:18-alpine",
            imageId: "sha256:node",
            ...getContainerState("mock44444444", "exited"),
            created: Math.floor(Date.now() / 1000 - 7200),
            ports: [],
            mounts: [],
            labels: {}
          },
          {
            id: "mock55555555",
            fullId: "mock55555555555555555555555555555555",
            names: ["prometheus"],
            image: "prom/prometheus:latest",
            imageId: "sha256:prometheus",
            ...getContainerState("mock55555555", "running"),
            created: Math.floor(Date.now() / 1000 - 2700),
            ports: [{ privatePort: 9090, publicPort: 9090, type: "tcp" }],
            mounts: [],
            labels: {}
          },
          {
            id: "mock66666666",
            fullId: "mock66666666666666666666666666666666",
            names: ["grafana"],
            image: "grafana/grafana:latest",
            imageId: "sha256:grafana",
            ...getContainerState("mock66666666", "running"),
            created: Math.floor(Date.now() / 1000 - 2700),
            ports: [{ privatePort: 3000, publicPort: 3000, type: "tcp" }],
            mounts: [],
            labels: {}
          },
          {
            id: "mock77777777",
            fullId: "mock77777777777777777777777777777777",
            names: ["pihole-dns"],
            image: "pihole/pihole:latest",
            imageId: "sha256:pihole",
            ...getContainerState("mock77777777", "paused"),
            created: Math.floor(Date.now() / 1000 - 86400),
            ports: [{ privatePort: 53, publicPort: 53, type: "udp" }],
            mounts: [],
            labels: {}
          },
          {
            id: "mock88888888",
            fullId: "mock88888888888888888888888888888888",
            names: ["jellyfin-media"],
            image: "jellyfin/jellyfin:latest",
            imageId: "sha256:jellyfin",
            ...getContainerState("mock88888888", "running"),
            created: Math.floor(Date.now() / 1000 - 172800),
            ports: [{ privatePort: 8096, publicPort: 8096, type: "tcp" }],
            mounts: [],
            labels: {}
          }
        );
      }

      if (isLarge) {
        for (let i = 9; i <= 24; i++) {
          const containerId = `mock${i.toString().padStart(8, '0')}`;
          const defaultState = i % 4 === 0 ? "exited" : "running";
          mockContainers.push({
            id: containerId,
            fullId: `mock${i.toString().padStart(32, '0')}`,
            names: [`demo-service-${i}`],
            image: `demo/service-${i}:latest`,
            imageId: `sha256:fake${i}`,
            ...getContainerState(containerId, defaultState),
            created: Math.floor(Date.now() / 1000 - 86400 * i),
            ports: [],
            mounts: [],
            labels: {}
          });
        }
      }

      return NextResponse.json(mockContainers);
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
