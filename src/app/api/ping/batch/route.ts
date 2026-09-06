import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import { RequestValidationError, readJsonObject, readStringArray } from '@/lib/requestValidation';
import { isDemoMode } from '@/lib/demoMode';
import { collectConfiguredPingTargets, resolveConfiguredPingTarget } from '@/lib/pingTargets';

export const dynamic = 'force-dynamic';
const MAX_PING_BODY_BYTES = 128 * 1024;

interface PingStatus {
  status: string;
  statusText: string;
  latency: number;
}

async function pingOne(url: string, allowedTargets: Set<string>) {
  const configuredUrl = resolveConfiguredPingTarget(url, allowedTargets);
  if (!configuredUrl) {
    return { url, status: 'offline', statusText: 'Accès interdit', latency: 0 };
  }

  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(configuredUrl, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Connection': 'close',
      }
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - start;

    if (response.ok || response.status < 400 || response.status === 401 || response.status === 403) {
      return { url, status: 'online', statusText: 'OK', latency };
    } else {
      return { url, status: 'offline', statusText: `Error ${response.status}`, latency };
    }
  } catch (error: unknown) {
    let statusText = 'Offline';
    const errorName = error instanceof Error ? error.name : '';
    const errorCode = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
    if (errorName === 'AbortError') {
      statusText = 'Timeout';
    } else if (errorCode === 'ECONNREFUSED') {
      statusText = 'Refusé';
    } else if (errorCode === 'ECONNRESET') {
      statusText = 'Offline';
    }
    return { url, status: 'offline', statusText, latency: 0 };
  }
}

export async function POST(request: Request) {
  const config = readConfig();
  const access = checkReadAccess(
    request,
    config.settings?.securityMode || 'public',
    READ_ACCESS.ping
  );
  if (access.error) return access.error;

  try {
    const body = await readJsonObject(request, MAX_PING_BODY_BYTES);
    const urls = readStringArray(body, 'urls', { maxItems: 50, maxItemLength: 2048 }) || [];

    if (isDemoMode()) {
      const resultMap: Record<string, PingStatus> = {};
      urls.forEach(url => {
        const isOffline = url.includes('offline');
        const hash = Array.from(url).reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 7);
        const latency = isOffline ? 0 : 4 + (hash % 12);
        resultMap[url] = {
          status: isOffline ? 'offline' : 'online',
          statusText: isOffline ? 'Timeout' : 'OK',
          latency
        };
      });
      return NextResponse.json(resultMap);
    }

    if (urls.length === 0) {
      return NextResponse.json({});
    }

    const allowedTargets = collectConfiguredPingTargets(config);

    // Ping all hosts concurrently on the server
    const pingPromises = urls.map(url => pingOne(url, allowedTargets));
    const results = await Promise.all(pingPromises);

    // Format as a map: { [url]: { status, statusText, latency } }
    const resultMap = results.reduce((acc, r) => {
      acc[r.url] = { status: r.status, statusText: r.statusText, latency: r.latency };
      return acc;
    }, {} as Record<string, PingStatus>);

    return NextResponse.json(resultMap);
  } catch (err: unknown) {
    if (err instanceof RequestValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Erreur Batch Ping:', err);
    return NextResponse.json({ error: 'Une erreur est survenue.' }, { status: 500 });
  }
}
