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
import { isDemoMode } from '@/lib/demoMode';
import { isDemoImageRemoved, removeDemoImage, withDemoSession } from '@/lib/demoSession';
import { DEMO_DOCKER_IMAGES } from '@/lib/demoDockerFixtures';

export const dynamic = 'force-dynamic';

interface DockerApiImage {
  Id?: string;
  RepoTags?: string[] | null;
  Size?: number;
  Created?: number;
  Containers?: number;
}

function getDockerHost(hostId: string) {
  const config = readConfig();
  return (config.dockerHosts || []).find(h => h.id === hostId);
}

// GET /api/docker/[hostId]/images — list all images
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

    // Mock images
    if (isDemoMode() || host.url.includes('mock') || host.id.includes('mock-host')) {
      return NextResponse.json(DEMO_DOCKER_IMAGES.filter(image => !isDemoImageRemoved(image.id)));
    }

    const response = await fetchDockerApi(host.url, '/images/json');
    const raw = await readDockerJson(response) as DockerApiImage[];

    const images = raw.map(img => ({
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
    const imageId = url.searchParams.get('id');
    if (!imageId) return NextResponse.json({ error: 'Image ID required' }, { status: 400 });

    if (isDemoMode()) {
      removeDemoImage(imageId);
      return NextResponse.json({ success: true, simulated: true });
    }

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
