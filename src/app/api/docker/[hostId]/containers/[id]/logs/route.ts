import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDockerHost(hostId: string) {
  const configPath = path.join(process.cwd(), 'data', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return (config.dockerHosts || []).find((h: any) => h.id === hostId);
}

// GET /api/docker/[hostId]/containers/[id]/logs
export async function GET(
  request: Request,
  segmentData: { params: Promise<{ hostId: string; id: string }> }
) {
  try {
    const { hostId, id } = await segmentData.params;
    const host = getDockerHost(hostId);
    if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 });

    const url = new URL(request.url);
    const tail = url.searchParams.get('tail') || '100';
    const timestamps = url.searchParams.get('timestamps') !== 'false';

    const dockerUrl = `${host.url.replace(/\/$/, '')}/containers/${id}/logs?stdout=true&stderr=true&tail=${tail}&timestamps=${timestamps}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const res = await fetch(dockerUrl, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Docker logs error ${res.status}: ${text}`);
    }

    const raw = await res.arrayBuffer();
    const buffer = new Uint8Array(raw);
    
    // Docker logs can have a multiplexed stream header (8 bytes per frame)
    // or return plain text. We handle both.
    const lines: string[] = [];
    const decoder = new TextDecoder();
    
    // Try to detect if the log output has Docker stream headers
    // Docker stream header: [stream_type(1)][0][0][0][size(4)][payload]
    if (buffer.length >= 8 && (buffer[0] === 1 || buffer[0] === 2) && buffer[1] === 0 && buffer[2] === 0 && buffer[3] === 0) {
      // Multiplexed stream format
      let offset = 0;
      while (offset < buffer.length - 8) {
        const frameSize = (buffer[offset + 4] << 24) | (buffer[offset + 5] << 16) | (buffer[offset + 6] << 8) | buffer[offset + 7];
        offset += 8;
        if (offset + frameSize > buffer.length) break;
        const text = decoder.decode(buffer.slice(offset, offset + frameSize));
        text.split('\n').forEach(line => {
          if (line.trim()) lines.push(line);
        });
        offset += frameSize;
      }
    } else {
      // Plain text format
      const text = decoder.decode(buffer);
      text.split('\n').forEach(line => {
        if (line.trim()) lines.push(line);
      });
    }

    return NextResponse.json({ lines });
  } catch (e: any) {
    console.error('Docker logs error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
