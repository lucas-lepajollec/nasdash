import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import { isDemoMode } from '@/lib/demoMode';
import { collectConfiguredPingTargets, isConfiguredPingTarget } from '@/lib/pingTargets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const config = readConfig();
  const access = checkReadAccess(
    request,
    config.settings?.securityMode || 'public',
    READ_ACCESS.ping
  );
  if (access.error) return access.error;

  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ status: 'offline', statusText: 'Invalid URL', latency: 0 }, { status: 400 });
  }

  if (isDemoMode()) {
    const isOffline = url.includes('offline');
    const hash = Array.from(url).reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 7);
    return NextResponse.json({
      status: isOffline ? 'offline' : 'online',
      statusText: isOffline ? 'Timeout' : 'OK',
      latency: isOffline ? 0 : 4 + (hash % 12),
    });
  }

  // Prevent SSRF and side effects: a viewer may probe only an exact endpoint
  // already persisted by an administrator, not another path on the same host.
  const allowedTargets = collectConfiguredPingTargets(config);
  if (!isConfiguredPingTarget(url, allowedTargets)) {
    return NextResponse.json({ status: 'offline', statusText: 'Accès interdit (URL non configurée)', latency: 0 }, { status: 403 });
  }

  try {
    const start = Date.now();
    // Use AbortController for a 5-second timeout to avoid hanging requests (e.g. DNS timeouts on private IPs)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // We do a GET instead of HEAD because some minimal self-hosted servers block HEAD requests
    const response = await fetch(url, {
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
      // 401/403 often means the service is up but requires auth (e.g. Proxmox, AdGuard)
      return NextResponse.json({ status: 'online', statusText: 'OK', latency });
    } else {
      return NextResponse.json({ status: 'offline', statusText: `Error ${response.status}`, latency });
    }
  } catch (error: unknown) {
    const failure = error as { name?: string; code?: string; cause?: { code?: string } };
    let statusText = 'Client Error';
    if (failure.name === 'AbortError') {
      statusText = 'Timeout';
    } else if (failure.code === 'ECONNREFUSED' || failure.cause?.code === 'ECONNREFUSED') {
      statusText = 'Connection Refused';
    }
    return NextResponse.json({ status: 'offline', statusText, latency: 0 });
  }
}
