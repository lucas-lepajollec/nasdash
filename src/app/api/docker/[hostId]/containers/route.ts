import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// --- Smart Logger to avoid spamming errors ---
const globalAny: any = global;
if (!globalAny.__dockerErrorLogCache) globalAny.__dockerErrorLogCache = new Map<string, string>();
const errorLogCache: Map<string, string> = globalAny.__dockerErrorLogCache;

function logErrorSmartly(hostId: string, context: string, errorMsg: string) {
  const key = `${hostId}-${context}`;
  if (errorLogCache.get(key) !== errorMsg) {
    console.error(`🔴 [${context}]`, errorMsg);
    errorLogCache.set(key, errorMsg);
  }
}

function clearErrorSmartly(hostId: string, context: string) {
  errorLogCache.delete(`${hostId}-${context}`);
}
// ---------------------------------------------

function getConfig() {
  const configPath = path.join(process.cwd(), 'data', 'config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function getDockerHost(hostId: string) {
  const config = getConfig();
  const hosts = config.dockerHosts || [];
  return hosts.find((h: any) => h.id === hostId);
}

async function dockerFetch(hostUrl: string, endpoint: string, method = 'GET') {
  const url = `${hostUrl.replace(/\/$/, '')}${endpoint}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Docker API error ${res.status}: ${text}`);
    }
    return await res.json();
  } catch (e: any) {
    clearTimeout(timeout);
    throw e;
  }
}

// GET /api/docker/[hostId]/containers — list all containers
export async function GET(
  request: Request,
  segmentData: { params: Promise<{ hostId: string }> }
) {
  let resolvedHostId = 'unknown';
  try {
    const { hostId } = await segmentData.params;
    resolvedHostId = hostId;
    const host = getDockerHost(hostId);
    if (!host) {
      return NextResponse.json({ error: 'Docker host not found' }, { status: 404 });
    }

    // Return mock data for demo/mock hosts
    if (host.url === 'mock' || host.id === 'mock-host-id') {
      const mockContainers = [
        {
          id: "mock11111111",
          fullId: "mock11111111111111111111111111111111",
          names: ["web-server"],
          image: "nginx:latest",
          imageId: "sha256:nginx",
          state: "running",
          status: "Up 3 hours",
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
          state: "running",
          status: "Up 5 hours",
          created: Math.floor(Date.now() / 1000 - 18000),
          ports: [{ privatePort: 5432, publicPort: 5432, type: "tcp" }],
          mounts: [],
          labels: {}
        },
        {
          id: "mock33333333",
          fullId: "mock33333333333333333333333333333333",
          names: ["redis-cache"],
          image: "redis:alpine",
          imageId: "sha256:redis",
          state: "running",
          status: "Up 1 hour",
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
          state: "exited",
          status: "Exited (137) 10 minutes ago",
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
          state: "running",
          status: "Up 45 minutes",
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
          state: "running",
          status: "Up 45 minutes",
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
          state: "paused",
          status: "Paused",
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
          state: "running",
          status: "Up 2 days",
          created: Math.floor(Date.now() / 1000 - 172800),
          ports: [{ privatePort: 8096, publicPort: 8096, type: "tcp" }],
          mounts: [],
          labels: {}
        }
      ];
      return NextResponse.json(mockContainers);
    }

    const url = new URL(request.url);
    const all = url.searchParams.get('all') !== 'false'; // default true
    
    const rawContainers = await dockerFetch(host.url, `/containers/json?all=${all}&size=false`);
    
    const containers = rawContainers.map((c: any) => ({
      id: c.Id?.substring(0, 12) || c.Id,
      fullId: c.Id,
      names: (c.Names || []).map((n: string) => n.replace(/^\//, '')),
      image: c.Image,
      imageId: c.ImageID?.substring(0, 19) || '',
      state: c.State?.toLowerCase() || 'unknown',
      status: c.Status || '',
      created: c.Created || 0,
      ports: (c.Ports || []).map((p: any) => ({
        ip: p.IP,
        privatePort: p.PrivatePort,
        publicPort: p.PublicPort,
        type: p.Type,
      })),
      mounts: (c.Mounts || []).map((m: any) => ({
        type: m.Type,
        name: m.Name,
        source: m.Source,
        destination: m.Destination,
        rw: m.RW,
      })),
      labels: c.Labels || {},
    }));

    clearErrorSmartly(resolvedHostId, 'Docker');
    return NextResponse.json(containers);
  } catch (e: any) {
    logErrorSmartly(resolvedHostId, 'Docker', e.message || 'Unknown error');
    return NextResponse.json(
      { error: e.message || 'Failed to fetch containers', isOffline: true },
      { status: 502 }
    );
  }
}
