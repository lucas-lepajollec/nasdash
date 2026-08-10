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

// GET /api/docker/[hostId]/images — list all images
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

    // Mock images
    if (host.url === 'mock' || host.id === 'mock-host-id') {
      const mockImages = [
        { id: "nginx-img-id", repoTags: ["nginx:latest"], size: 142000000, created: 1780517682, containers: 1 },
        { id: "postgres-img-id", repoTags: ["postgres:15-alpine"], size: 234000000, created: 1780517682, containers: 1 },
        { id: "redis-img-id", repoTags: ["redis:alpine"], size: 32000000, created: 1780517682, containers: 1 },
        { id: "node-img-id", repoTags: ["node:18-alpine"], size: 180000000, created: 1780517682, containers: 1 },
      ];
      return NextResponse.json(mockImages);
    }

    const response = await fetchDockerApi(host.url, '/images/json');
    const raw = await readDockerJson(response) as any[];

    const images = raw.map((img: any) => ({
      id: img.Id?.replace('sha256:', '').substring(0, 12) || img.Id,
      repoTags: img.RepoTags || ['<none>:<none>'],
      size: img.Size || 0,
      created: img.Created || 0,
      containers: img.Containers || 0,
    }));

    return NextResponse.json(images);
  } catch (error: unknown) {
    const failure = classifyDockerError(error);
    reportDockerFailure(resolvedHostId, failure);
    return NextResponse.json(failure, { status: dockerFailureStatus(failure) });
  }
}

// DELETE /api/docker/[hostId]/images?id=[imageId]
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
    const imageId = url.searchParams.get('id');
    if (!imageId) return NextResponse.json({ error: 'Image ID required' }, { status: 400 });

    const res = await fetchDockerApi(
      host.url,
      `/images/${encodeURIComponent(imageId)}`,
      { method: 'DELETE' },
      5_000,
      [404, 409],
    );

    if (res.status === 404) {
      return NextResponse.json({ error: 'Image Docker introuvable.' }, { status: 404 });
    }
    if (res.status === 409) {
      return NextResponse.json({ error: 'L\'image est en cours d\'utilisation par un conteneur et ne peut pas être supprimée.' }, { status: 409 });
    }

    reportDockerSuccess(hostId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const failure = classifyDockerError(error);
    reportDockerFailure(resolvedHostId, failure);
    return NextResponse.json(failure, { status: dockerFailureStatus(failure) });
  }
}
