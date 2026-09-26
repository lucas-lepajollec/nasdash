import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import { RequestValidationError, readJsonObject, readStringArray } from '@/lib/requestValidation';
import { isDemoMode } from '@/lib/demoMode';
import { collectConfiguredPingTargets, resolveConfiguredPingTarget } from '@/lib/pingTargets';
import { recordTaskRun } from '@/lib/tasks';
import { pingUrl, type PingResult } from '@/lib/ping';

export const dynamic = 'force-dynamic';
const MAX_PING_BODY_BYTES = 128 * 1024;

type PingStatus = Omit<PingResult, 'status'> & { status: string };

async function pingOne(url: string, allowedTargets: Set<string>) {
  const configuredUrl = resolveConfiguredPingTarget(url, allowedTargets);
  if (!configuredUrl) {
    return { url, status: 'offline', statusText: 'Accès interdit', latency: 0 };
  }

  return { url, ...(await pingUrl(configuredUrl)) };
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
    const started = Date.now();

    // Ping all hosts concurrently on the server
    const pingPromises = urls.map(url => pingOne(url, allowedTargets));
    const results = await Promise.all(pingPromises);

    // Format as a map: { [url]: { status, statusText, latency } }
    const resultMap = results.reduce((acc, r) => {
      const { url: key, ...result } = r;
      acc[key] = result;
      return acc;
    }, {} as Record<string, PingStatus>);
    const online = results.filter(result => result.status === 'online').length;
    recordTaskRun('service-pings', { ok: online === results.length, note: `${online}/${results.length}`, durationMs: Date.now() - started });

    return NextResponse.json(resultMap);
  } catch (err: unknown) {
    if (err instanceof RequestValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Erreur Batch Ping:', err);
    return NextResponse.json({ error: 'Une erreur est survenue.' }, { status: 500 });
  }
}
