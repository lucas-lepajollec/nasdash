import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import { readBoundedResponseBytes, ResponseTooLargeError } from '@/lib/boundedResponse';
import {
  classifyDockerError,
  dockerFailureStatus,
  fetchDockerApi,
  reportDockerFailure,
} from '@/lib/dockerClient';

export const dynamic = 'force-dynamic';
const MAX_LOG_LINES = 1_000;
const MAX_LOG_BYTES = 2 * 1024 * 1024;

function getDockerHost(hostId: string) {
  const config = readConfig();
  return (config.dockerHosts || []).find(h => h.id === hostId);
}

// GET /api/docker/[hostId]/containers/[id]/logs
export async function GET(
  request: Request,
  segmentData: { params: Promise<{ hostId: string; id: string }> }
) {
  const config = readConfig();
  const access = checkReadAccess(
    request,
    config.settings?.securityMode || 'public',
    READ_ACCESS.dockerDetails
  );
  if (access.error) return access.error;

  const url = new URL(request.url);
  const rawTail = url.searchParams.get('tail') || '100';
  const tailNumber = Number(rawTail);
  if (!Number.isInteger(tailNumber) || tailNumber < 1 || tailNumber > MAX_LOG_LINES) {
    return NextResponse.json(
      { error: `Le nombre de lignes doit être compris entre 1 et ${MAX_LOG_LINES}.` },
      { status: 400 },
    );
  }
  const tail = String(tailNumber);
  const timestamps = url.searchParams.get('timestamps') !== 'false';

  let resolvedHostId = 'unknown';
  try {
    const { hostId, id } = await segmentData.params;
    resolvedHostId = hostId;
    const host = getDockerHost(hostId);
    if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 });

    const isMockMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || host.url.includes('mock') || host.id.includes('mock-host') || host.url === 'mock' || host.id === 'mock-host-id';
    if (isMockMode) {
      const mockLogs = {
        lines: [
          `[${new Date().toISOString().split('T')[0]} 10:00:00] INFO Starting service...`,
          `[${new Date().toISOString().split('T')[0]} 10:00:01] INFO Connection to database established.`,
          `[${new Date().toISOString().split('T')[0]} 10:00:02] INFO Listening on port 80.`,
          `[${new Date().toISOString().split('T')[0]} 10:05:00] DEBUG Health check passed.`,
          `[${new Date().toISOString().split('T')[0]} 10:10:00] DEBUG Health check passed.`
        ]
      };
      return NextResponse.json(mockLogs);
    }

    const query = new URLSearchParams({ stdout: 'true', stderr: 'true', tail, timestamps: String(timestamps) });
    const res = await fetchDockerApi(
      host.url,
      `/containers/${encodeURIComponent(id)}/logs?${query.toString()}`,
      {},
      8_000,
    );

    const buffer = await readBoundedResponseBytes(res, MAX_LOG_BYTES);
    
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
  } catch (error: unknown) {
    if (error instanceof ResponseTooLargeError) {
      return NextResponse.json(
        { error: 'Les logs Docker dépassent la taille autorisée (2 Mo).' },
        { status: 413 },
      );
    }
    const failure = classifyDockerError(error);
    reportDockerFailure(resolvedHostId, failure);
    return NextResponse.json(failure, { status: dockerFailureStatus(failure) });
  }
}
