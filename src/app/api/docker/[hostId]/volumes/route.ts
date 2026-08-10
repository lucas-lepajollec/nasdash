import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { checkAdmin } from '@/lib/auth';
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

function getDockerHost(hostId: string) {
  const config = readConfig();
  return (config.dockerHosts || []).find((h: any) => h.id === hostId);
}

// GET /api/docker/[hostId]/volumes — list all volumes
export async function GET(
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
    if (host.url === 'mock' || host.id === 'mock-host-id') {
      const mockVolumes = [
        { name: "postgres_data", driver: "local", mountpoint: "/var/lib/docker/volumes/postgres_data/_data", createdAt: "2026-06-11T05:00:00Z", usageData: { size: 45000000, refCount: 1 } },
        { name: "redis_data", driver: "local", mountpoint: "/var/lib/docker/volumes/redis_data/_data", createdAt: "2026-06-11T09:00:00Z", usageData: { size: 12000, refCount: 1 } },
      ];
      return NextResponse.json(mockVolumes);
    }

    const response = await fetchDockerApi(host.url, '/volumes');
    const raw = await readDockerJson(response) as { Volumes?: any[] };

    const volumes = (raw.Volumes || []).map((v: any) => ({
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
export async function DELETE(
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

    const res = await fetchDockerApi(
      host.url,
      `/volumes/${encodeURIComponent(volumeName)}`,
      { method: 'DELETE' },
      5_000,
      [404, 409],
    );

    if (res.status === 404) {
      return NextResponse.json({ error: 'Volume Docker introuvable.' }, { status: 404 });
    }
    if (res.status === 409) {
      return NextResponse.json({ error: 'Le volume est en cours d\'utilisation et ne peut pas être supprimé.' }, { status: 409 });
    }

    reportDockerSuccess(hostId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const failure = classifyDockerError(error);
    reportDockerFailure(resolvedHostId, failure);
    return NextResponse.json(failure, { status: dockerFailureStatus(failure) });
  }
}
