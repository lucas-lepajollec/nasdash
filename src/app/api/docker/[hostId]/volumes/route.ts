import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { isAdmin, getSessionFromRequest } from '@/lib/auth';

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

  // Bloquer l'accès en mode privé si non authentifié
  if (config.settings?.securityMode === 'private') {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
    }
  }

  try {
    const { hostId } = await segmentData.params;
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

    const dockerUrl = `${host.url.replace(/\/$/, '')}/volumes`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(dockerUrl, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) throw new Error(`Docker volumes error ${res.status}`);
    const raw = await res.json();

    const volumes = (raw.Volumes || []).map((v: any) => ({
      name: v.Name,
      driver: v.Driver,
      mountpoint: v.Mountpoint,
      createdAt: v.CreatedAt,
      labels: v.Labels || {},
      usageData: v.UsageData ? { size: v.UsageData.Size, refCount: v.UsageData.RefCount } : undefined,
    }));

    return NextResponse.json(volumes);
  } catch (e: any) {
    console.error('Docker volumes error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

// DELETE /api/docker/[hostId]/volumes?name=[volumeName]
export async function DELETE(
  request: Request,
  segmentData: { params: Promise<{ hostId: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  try {
    const { hostId } = await segmentData.params;
    const host = getDockerHost(hostId);
    if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 });

    const url = new URL(request.url);
    const volumeName = url.searchParams.get('name');
    if (!volumeName) return NextResponse.json({ error: 'Volume name required' }, { status: 400 });

    const dockerUrl = `${host.url.replace(/\/$/, '')}/volumes/${encodeURIComponent(volumeName)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    // Attempt deletion
    const res = await fetch(dockerUrl, { method: 'DELETE', signal: controller.signal });
    clearTimeout(timeout);
    
    // Status 204 means successful deletion, 404 means no such volume, 409 means volume is in use
    if (res.status === 409) {
      return NextResponse.json({ error: 'Le volume est en cours d\'utilisation et ne peut pas être supprimé.' }, { status: 409 });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Docker API error ${res.status}: ${text}`);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Docker volume delete error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
