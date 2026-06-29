import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function checkAdmin(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/nasdash_session=([^;]+)/);
  const token = match ? match[1] : null;
  if (!token) return false;
  const payload = verifyToken(token);
  return payload?.role === 'admin';
}

function getDockerHost(hostId: string) {
  const config = readConfig();
  return (config.dockerHosts || []).find((h: any) => h.id === hostId);
}

async function dockerFetch(hostUrl: string, endpoint: string, method = 'GET') {
  const url = `${hostUrl.replace(/\/$/, '')}${endpoint}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { method, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Docker API error ${res.status}: ${text}`);
    }
    // Some Docker endpoints return empty body on success (e.g. POST start/stop)
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await res.json();
    }
    return { ok: true };
  } catch (e: any) {
    clearTimeout(timeout);
    throw e;
  }
}

import { getSessionFromRequest } from '@/lib/auth';

// GET /api/docker/[hostId]/containers/[id] — container details
// POST /api/docker/[hostId]/containers/[id]?action=start|stop|restart|remove
export async function GET(
  request: Request,
  segmentData: { params: Promise<{ hostId: string; id: string }> }
) {
  try {
    const config = readConfig();

    // Bloquer l'accès en mode privé si non authentifié
    if (config.settings?.securityMode === 'private') {
      const session = getSessionFromRequest(request);
      if (!session) {
        return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
      }
    }

    const { hostId, id } = await segmentData.params;
    const host = getDockerHost(hostId);
    if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 });

    const isAdminUser = checkAdmin(request);

    // Mock details
    if (host.url === 'mock' || host.id === 'mock-host-id') {
      const mockContainers = [
        { id: "mock11111111", name: "web-server", image: "nginx:latest", state: "running", status: "running", startedAt: "2026-06-11T07:00:00Z" },
        { id: "mock22222222", name: "postgres-db", image: "postgres:15-alpine", state: "running", status: "running", startedAt: "2026-06-11T05:00:00Z" },
        { id: "mock33333333", name: "redis-cache", image: "redis:alpine", state: "running", status: "running", startedAt: "2026-06-11T09:00:00Z" },
        { id: "mock44444444", name: "node-api", image: "node:18-alpine", state: "exited", status: "exited", startedAt: "2026-06-11T08:00:00Z", finishedAt: "2026-06-11T08:50:00Z" },
        { id: "mock55555555", name: "prometheus", image: "prom/prometheus:latest", state: "running", status: "running", startedAt: "2026-06-11T09:15:00Z" },
        { id: "mock66666666", name: "grafana", image: "grafana/grafana:latest", state: "running", status: "running", startedAt: "2026-06-11T09:15:00Z" },
        { id: "mock77777777", name: "pihole-dns", image: "pihole/pihole:latest", state: "paused", status: "paused", startedAt: "2026-06-10T10:00:00Z" },
        { id: "mock88888888", name: "jellyfin-media", image: "jellyfin/jellyfin:latest", state: "running", status: "running", startedAt: "2026-06-09T10:00:00Z" },
      ];
      const found = mockContainers.find(c => c.id === id);
      if (!found) return NextResponse.json({ error: 'Container not found' }, { status: 404 });
      
      const result = {
        id: found.id,
        fullId: found.id.padEnd(64, '0'),
        name: found.name,
        image: found.image,
        state: found.state,
        status: found.status,
        startedAt: found.startedAt,
        finishedAt: found.finishedAt || '',
        created: 1780517682,
        restartCount: 0,
        ports: [],
        mounts: [],
        env: isAdminUser ? ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"] : ["<MASQUÉ - ADMINISTRATEUR UNIQUEMENT>"],
        labels: {},
        stats: {
          cpuPercent: found.state === 'running' ? 1.2 : 0,
          memUsage: found.state === 'running' ? 24 * 1024 * 1024 : 0,
          memLimit: 1024 * 1024 * 1024,
          memPercent: found.state === 'running' ? 2.3 : 0,
          netInput: found.state === 'running' ? 124500 : 0,
          netOutput: found.state === 'running' ? 987000 : 0,
        }
      };
      return NextResponse.json(result);
    }

    const detail = await dockerFetch(host.url, `/containers/${id}/json`);

    // Also get one-shot stats
    let stats: any = null;
    try {
      stats = await dockerFetch(host.url, `/containers/${id}/stats?stream=false`);
    } catch { /* stats optional */ }

    const cpuDelta = stats?.cpu_stats?.cpu_usage?.total_usage - (stats?.precpu_stats?.cpu_usage?.total_usage || 0);
    const systemDelta = stats?.cpu_stats?.system_cpu_usage - (stats?.precpu_stats?.system_cpu_usage || 0);
    const numCpus = stats?.cpu_stats?.online_cpus || 1;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0;

    const memUsage = stats?.memory_stats?.usage || 0;
    const memLimit = stats?.memory_stats?.limit || 1;
    const memPercent = (memUsage / memLimit) * 100;

    // Network I/O
    let netInput = 0, netOutput = 0;
    if (stats?.networks) {
      for (const net of Object.values(stats.networks) as any[]) {
        netInput += net.rx_bytes || 0;
        netOutput += net.tx_bytes || 0;
      }
    }

    const result = {
      id: detail.Id?.substring(0, 12),
      fullId: detail.Id,
      name: detail.Name?.replace(/^\//, ''),
      image: detail.Config?.Image,
      state: detail.State?.Status?.toLowerCase() || 'unknown',
      status: detail.State?.Status || '',
      startedAt: detail.State?.StartedAt,
      finishedAt: detail.State?.FinishedAt,
      created: detail.Created,
      restartCount: detail.RestartCount || 0,
      ports: Object.entries(detail.HostConfig?.PortBindings || {}).map(([containerPort, bindings]: [string, any]) => ({
        containerPort,
        hostBindings: (bindings || []).map((b: any) => `${b.HostIp || '0.0.0.0'}:${b.HostPort}`),
      })),
      mounts: (detail.Mounts || []).map((m: any) => ({
        type: m.Type,
        name: m.Name,
        source: m.Source,
        destination: m.Destination,
        rw: m.RW,
      })),
      env: isAdminUser ? (detail.Config?.Env || []).slice(0, 50) : ["<MASQUÉ - ADMINISTRATEUR UNIQUEMENT>"], // Limit and protect for safety
      labels: detail.Config?.Labels || {},
      stats: {
        cpuPercent: Math.round(cpuPercent * 10) / 10,
        memUsage,
        memLimit,
        memPercent: Math.round(memPercent * 10) / 10,
        netInput,
        netOutput,
      },
    };

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Docker container detail error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

// POST — container actions (start, stop, restart, remove)
export async function POST(
  request: Request,
  segmentData: { params: Promise<{ hostId: string; id: string }> }
) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  try {
    const { hostId, id } = await segmentData.params;
    const host = getDockerHost(hostId);
    if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 });

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (!action || !['start', 'stop', 'restart', 'remove'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use: start, stop, restart, remove' }, { status: 400 });
    }

    // Mock action success
    if (host.url === 'mock' || host.id === 'mock-host-id') {
      return NextResponse.json({ ok: true, action });
    }

    const endpoint = action === 'remove'
      ? `/containers/${id}?force=true`
      : `/containers/${id}/${action}`;
    const method = action === 'remove' ? 'DELETE' : 'POST';

    // For DELETE we need a custom fetch
    if (action === 'remove') {
      const deleteUrl = `${host.url.replace(/\/$/, '')}${endpoint}`;
      const res = await fetch(deleteUrl, { method: 'DELETE' });
      if (!res.ok && res.status !== 304) {
        const text = await res.text();
        throw new Error(`Docker API error ${res.status}: ${text}`);
      }
      return NextResponse.json({ ok: true, action });
    }

    await dockerFetch(host.url, endpoint, method);
    return NextResponse.json({ ok: true, action });
  } catch (e: any) {
    console.error('Docker action error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
