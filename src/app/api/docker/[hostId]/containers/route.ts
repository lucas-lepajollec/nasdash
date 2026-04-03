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
  try {
    const { hostId } = await segmentData.params;
    const host = getDockerHost(hostId);
    if (!host) {
      return NextResponse.json({ error: 'Docker host not found' }, { status: 404 });
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

    return NextResponse.json(containers);
  } catch (e: any) {
    console.error('Docker containers error:', e.message);
    return NextResponse.json(
      { error: e.message || 'Failed to fetch containers', isOffline: true },
      { status: 502 }
    );
  }
}
