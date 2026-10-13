import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { checkAdmin } from '@/lib/auth';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import {
  classifyDockerError,
  dockerFailureStatus,
  fetchDockerApi,
  readDockerJson,
  requireDockerArray,
  DockerInvalidResponseError,
  reportDockerFailure,
  reportDockerSuccess,
} from '@/lib/dockerClient';
import { isDemoMode } from '@/lib/demoMode';
import { isDemoVolumeRemoved, removeDemoVolume, withDemoSession } from '@/lib/demoSession';
import { DEMO_DOCKER_VOLUMES } from '@/lib/demoDockerFixtures';

export const dynamic = 'force-dynamic';

interface DockerApiVolume {
  Name: string;
  Driver?: string;
  Mountpoint?: string;
  CreatedAt?: string;
  Labels?: Record<string, string> | null;
  UsageData?: { Size?: number; RefCount?: number };
}

function getDockerHost(hostId: string) {
  const config = readConfig();
  return (config.dockerHosts || []).find(h => h.id === hostId);
}

// GET /api/docker/[hostId]/volumes — list all volumes
async function handleGET(
  request: Request,
  segmentData: { params: Promise<{ hostId: string }> }
) {
  const config = readConfig();
  const access = checkReadAccess(
    request,
    config.settings?.securityMode || 'public',
    READ_ACCESS.dockerDetails
  );
  if (access.error) return access.error;

  let resolvedHostId = 'unknown';
  try {
    const { hostId } = await segmentData.params;
    resolvedHostId = hostId;
    const host = getDockerHost(hostId);
    if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 });

    // Mock volumes
    if (isDemoMode()) {
      return NextResponse.json(DEMO_DOCKER_VOLUMES.filter(volume => !isDemoVolumeRemoved(volume.name)));
    }

    const response = await fetchDockerApi(host, '/volumes');
    const raw = await readDockerJson(response) as { Volumes?: DockerApiVolume[] };

    if (!raw || !Object.prototype.hasOwnProperty.call(raw, 'Volumes')) throw new DockerInvalidResponseError();
    const volumes = requireDockerArray<DockerApiVolume>(raw.Volumes === null ? [] : raw.Volumes, 'Name').map(v => ({
      name: v.Name,
      driver: v.Driver,
      mountpoint: v.Mountpoint,
      createdAt: v.CreatedAt,
      labels: v.Labels || {},
      usageData: v.UsageData ? { size: v.UsageData.Size, refCount: v.UsageData.RefCount } : undefined,
    }));

    return NextResponse.json(volumes);
  } catch (error: unknown) {
    const failure = classifyDockerError(error);
    reportDockerFailure(resolvedHostId, failure);
    return NextResponse.json(failure, { status: dockerFailureStatus(failure) });
  }
}

// DELETE /api/docker/[hostId]/volumes?name=[volumeName]
async function handleDELETE(
  request: Request,
  segmentData: { params: Promise<{ hostId: string }> }
) {
  const authError = checkAdmin(request);
  if (authError) return authError;


  let resolvedHostId = 'unknown';
  try {
    const { hostId } = await segmentData.params;
    resolvedHostId = hostId;
    const host = getDockerHost(hostId);
    if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 });

    const url = new URL(request.url);
    const volumeName = url.searchParams.get('name');
    if (!volumeName) return NextResponse.json({ error: 'Volume name required' }, { status: 400 });

    if (isDemoMode()) {
      removeDemoVolume(volumeName);
      return NextResponse.json({ success: true, simulated: true });
    }

    const res = await fetchDockerApi(
      host,
      `/volumes/${encodeURIComponent(volumeName)}`,
      { method: 'DELETE' },
      5_000,
      [404, 409],
    );

    if (res.status === 404) {
      return NextResponse.json({ error: 'Docker volume not found.' }, { status: 404 });
    }
    if (res.status === 409) {
      return NextResponse.json({ error: 'Docker volume is in use and cannot be deleted.' }, { status: 409 });
    }

    reportDockerSuccess(hostId);
    return NextResponse.json({ success: true });
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

export function DELETE(
  request: Request,
  segmentData: { params: Promise<{ hostId: string }> },
) {
  return withDemoSession(request, () => handleDELETE(request, segmentData));
}
