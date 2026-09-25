import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import { isDemoMode } from '@/lib/demoMode';
import { collectConfiguredPingTargets, resolveConfiguredPingTarget } from '@/lib/pingTargets';
import { pingUrl } from '@/lib/ping';

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
  const configuredUrl = resolveConfiguredPingTarget(url, allowedTargets);
  if (!configuredUrl) {
    return NextResponse.json({ status: 'offline', statusText: 'Accès interdit (URL non configurée)', latency: 0 }, { status: 403 });
  }

  return NextResponse.json(await pingUrl(configuredUrl, 5000));
}
