import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getConfig() {
  const configPath = path.join(process.cwd(), 'data', 'config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function getDockerHost(hostId: string) {
  const config = getConfig();
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

// GET /api/docker/[hostId]/containers/[id] — container details
// POST /api/docker/[hostId]/containers/[id]?action=start|stop|restart|remove
export async function GET(
  request: Request,
  segmentData: { params: Promise<{ hostId: string; id: string }> }
) {
  try {
    const { hostId, id } = await segmentData.params;
    const host = getDockerHost(hostId);
    if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 });

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
      env: (detail.Config?.Env || []).slice(0, 50), // Limit for safety
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
  try {
    const { hostId, id } = await segmentData.params;
    const host = getDockerHost(hostId);
    if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 });

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (!action || !['start', 'stop', 'restart', 'remove'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use: start, stop, restart, remove' }, { status: 400 });
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
