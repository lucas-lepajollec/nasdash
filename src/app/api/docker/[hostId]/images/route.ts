import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDockerHost(hostId: string) {
  const configPath = path.join(process.cwd(), 'data', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return (config.dockerHosts || []).find((h: any) => h.id === hostId);
}

// GET /api/docker/[hostId]/images — list all images
export async function GET(
  request: Request,
  segmentData: { params: Promise<{ hostId: string }> }
) {
  try {
    const { hostId } = await segmentData.params;
    const host = getDockerHost(hostId);
    if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 });

    const dockerUrl = `${host.url.replace(/\/$/, '')}/images/json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(dockerUrl, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) throw new Error(`Docker images error ${res.status}`);
    const raw = await res.json();

    const images = raw.map((img: any) => ({
      id: img.Id?.replace('sha256:', '').substring(0, 12) || img.Id,
      repoTags: img.RepoTags || ['<none>:<none>'],
      size: img.Size || 0,
      created: img.Created || 0,
      containers: img.Containers || 0,
    }));

    return NextResponse.json(images);
  } catch (e: any) {
    console.error('Docker images error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

// DELETE /api/docker/[hostId]/images?id=[imageId]
export async function DELETE(
  request: Request,
  segmentData: { params: Promise<{ hostId: string }> }
) {
  try {
    const { hostId } = await segmentData.params;
    const host = getDockerHost(hostId);
    if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 });

    const url = new URL(request.url);
    const imageId = url.searchParams.get('id');
    if (!imageId) return NextResponse.json({ error: 'Image ID required' }, { status: 400 });

    const dockerUrl = `${host.url.replace(/\/$/, '')}/images/${encodeURIComponent(imageId)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    // Attempt deletion
    const res = await fetch(dockerUrl, { method: 'DELETE', signal: controller.signal });
    clearTimeout(timeout);
    
    // Status 200 means successful deletion, 404 means no such image, 409 means image is in use
    if (res.status === 409) {
      return NextResponse.json({ error: 'L\'image est en cours d\'utilisation par un conteneur et ne peut pas être supprimée.' }, { status: 409 });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Docker API error ${res.status}: ${text}`);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Docker image delete error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
