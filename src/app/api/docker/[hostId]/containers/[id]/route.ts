import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { isAdmin, checkAdmin } from '@/lib/auth';
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
import {
  getDemoContainerState,
  isDemoContainerRemoved,
  normalizeDemoContainerId,
  removeDemoContainer,
  setDemoContainerState,
  withDemoSession,
} from '@/lib/demoSession';
import { demoContainerStatus, demoStartedAt, getDemoDockerService } from '@/lib/demoDockerFixtures';

export const dynamic = 'force-dynamic';

interface DockerInspectMount {
  Type: string;
  Name?: string;
  Source: string;
  Destination: string;
  RW: boolean;
}

interface DockerPortBinding {
  HostIp?: string;
  HostPort?: string;
}

interface DockerContainerInspect {
  Id?: string;
  Name?: string;
  Config?: {
    Image?: string;
    Env?: string[];
    Labels?: Record<string, string>;
  };
  State?: { Status?: string; StartedAt?: string; FinishedAt?: string };
  HostConfig?: { PortBindings?: Record<string, DockerPortBinding[] | null> };
  Mounts?: DockerInspectMount[];
  Created?: string;
  RestartCount?: number;
}

interface DockerContainerStats {
  cpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  precpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
  };
  memory_stats?: { usage?: number; limit?: number };
  networks?: Record<string, { rx_bytes?: number; tx_bytes?: number }>;
}

function getDockerHost(hostId: string) {
  const config = readConfig();
  return (config.dockerHosts || []).find(h => h.id === hostId);
}

// GET /api/docker/[hostId]/containers/[id] — container details
// POST /api/docker/[hostId]/containers/[id]?action=start|stop|restart|remove
async function handleGET(
  request: Request,
  segmentData: { params: Promise<{ hostId: string; id: string }> }
) {
  let resolvedHostId = 'unknown';
  try {
    const config = readConfig();
    const access = checkReadAccess(
      request,
      config.settings?.securityMode || 'public',
      READ_ACCESS.dockerDetails
    );
    if (access.error) return access.error;

    const { hostId, id } = await segmentData.params;
    resolvedHostId = hostId;
    const host = getDockerHost(hostId);
    if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 });

    const isAdminUser = isAdmin(request);

    // Mock details
    const isMockMode = isDemoMode() || host.url.includes('mock') || host.id.includes('mock-host') || host.url === 'mock' || host.id === 'mock-host-id';
    if (isMockMode) {
      const normalizedId = normalizeDemoContainerId(id);
      if (isDemoContainerRemoved(normalizedId)) {
        return NextResponse.json({ error: 'Container not found' }, { status: 404 });
      }

      const found = getDemoDockerService(normalizedId);
      if (!found) return NextResponse.json({ error: 'Container not found' }, { status: 404 });

      const state = getDemoContainerState(normalizedId, found.defaultState);
      const seed = Array.from(found.id).reduce((total, character) => total + character.charCodeAt(0), 0);
      const cpuPercent = Math.round((0.8 + (seed % 47) / 10) * 10) / 10;
      const memPercent = Math.round((2.5 + (seed % 23)) * 10) / 10;
      const memLimit = 2 * 1024 * 1024 * 1024;
      const memUsage = Math.round(memLimit * memPercent / 100);

      const result = {
        id: found.id,
        fullId: found.id.padEnd(64, '0'),
        name: found.name,
        image: found.image,
        state: state,
        status: demoContainerStatus(state),
        startedAt: demoStartedAt(seed % 20),
        finishedAt: '',
        created: 1780517682,
        restartCount: 0,
        ports: found.ports.map(port => ({
          containerPort: `${port.privatePort}/${port.type}`,
          hostBindings: port.publicPort ? [`0.0.0.0:${port.publicPort}`] : [],
        })),
        mounts: found.mounts,
        env: isAdminUser ? ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"] : ["<MASQUÉ - ADMINISTRATEUR UNIQUEMENT>"],
        labels: {
          'com.docker.compose.project': 'nasdash-demo',
          'com.docker.compose.service': found.name,
          'io.nasdash.demo.service-id': found.serviceId,
        },
        stats: {
          cpuPercent: state === 'running' ? cpuPercent : 0,
          memUsage: state === 'running' ? memUsage : 0,
          memLimit,
          memPercent: state === 'running' ? memPercent : 0,
          netInput: state === 'running' ? 12_450_000 + seed * 1_000 : 0,
          netOutput: state === 'running' ? 8_970_000 + seed * 800 : 0,
        }
      };
      return NextResponse.json(result);
    }

    const detailResponse = await fetchDockerApi(host.url, `/containers/${encodeURIComponent(id)}/json`);
    const detail = await readDockerJson(detailResponse) as DockerContainerInspect;

    // Also get one-shot stats
    let stats: DockerContainerStats | null = null;
    try {
      const statsResponse = await fetchDockerApi(host.url, `/containers/${encodeURIComponent(id)}/stats?stream=false`);
      stats = await readDockerJson(statsResponse) as DockerContainerStats;
    } catch { /* stats optional */ }

    const cpuDelta = (stats?.cpu_stats?.cpu_usage?.total_usage || 0) - (stats?.precpu_stats?.cpu_usage?.total_usage || 0);
    const systemDelta = (stats?.cpu_stats?.system_cpu_usage || 0) - (stats?.precpu_stats?.system_cpu_usage || 0);
    const numCpus = stats?.cpu_stats?.online_cpus || 1;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0;

    const memUsage = stats?.memory_stats?.usage || 0;
    const memLimit = stats?.memory_stats?.limit || 1;
    const memPercent = (memUsage / memLimit) * 100;

    // Network I/O
    let netInput = 0, netOutput = 0;
    if (stats?.networks) {
      for (const net of Object.values(stats.networks)) {
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
      ports: Object.entries(detail.HostConfig?.PortBindings || {}).map(([containerPort, bindings]) => ({
        containerPort,
        hostBindings: (bindings || []).map(b => `${b.HostIp || '0.0.0.0'}:${b.HostPort}`),
      })),
      mounts: (detail.Mounts || []).map(m => ({
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

    reportDockerSuccess(resolvedHostId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const failure = classifyDockerError(error);
    reportDockerFailure(resolvedHostId, failure);
    return NextResponse.json(failure, { status: dockerFailureStatus(failure) });
  }
}

// POST — container actions (start, stop, restart, remove)
async function handlePOST(
  request: Request,
  segmentData: { params: Promise<{ hostId: string; id: string }> }
) {
  const authError = checkAdmin(request);
  if (authError) return authError;

  let resolvedHostId = 'unknown';
  try {
    const { hostId, id } = await segmentData.params;
    resolvedHostId = hostId;
    const host = getDockerHost(hostId);
    if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 });

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (!action || !['start', 'stop', 'restart', 'remove'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use: start, stop, restart, remove' }, { status: 400 });
    }

    // Mock action success
    const isMockModePost = isDemoMode() || host.url.includes('mock') || host.id.includes('mock-host') || host.url === 'mock' || host.id === 'mock-host-id';
    if (isMockModePost) {
      if (action === 'remove') {
        removeDemoContainer(id);
        return NextResponse.json({ ok: true, action, simulated: true });
      }
      const newState = action === 'start' ? 'running' : action === 'stop' ? 'exited' : 'running';
      setDemoContainerState(id, newState);
      return NextResponse.json({ ok: true, action, simulated: true });
    }

    const encodedId = encodeURIComponent(id);
    const endpoint = action === 'remove'
      ? `/containers/${encodedId}?force=true`
      : `/containers/${encodedId}/${action}`;
    const method = action === 'remove' ? 'DELETE' : 'POST';

    // For DELETE we need a custom fetch
    if (action === 'remove') {
      await fetchDockerApi(host.url, endpoint, { method: 'DELETE' }, 30_000, [304]);
      return NextResponse.json({ ok: true, action });
    }

    await fetchDockerApi(host.url, endpoint, { method }, 30_000, [304]);
    return NextResponse.json({ ok: true, action });
  } catch (error: unknown) {
    const failure = classifyDockerError(error);
    reportDockerFailure(resolvedHostId, failure);
    return NextResponse.json(failure, { status: dockerFailureStatus(failure) });
  }
}

export function GET(
  request: Request,
  segmentData: { params: Promise<{ hostId: string; id: string }> },
) {
  return withDemoSession(request, () => handleGET(request, segmentData));
}

export function POST(
  request: Request,
  segmentData: { params: Promise<{ hostId: string; id: string }> },
) {
  return withDemoSession(request, () => handlePOST(request, segmentData));
}
