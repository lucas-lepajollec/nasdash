import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { isDemoMode } from '@/lib/demoMode';
import { collectGluetun, restartGluetun } from '@/integrations/gluetun/collect';
import { tunnelContainers, tunnelServices } from '@/integrations/gluetun/dependents';
import { canReadResource, READ_ACCESS, type AccessPrincipal } from '@/lib/access';
import { readConfig } from '@/lib/config';
import type { IntegrationInstance } from '@/lib/types';
import { TtlCache } from '@/lib/widgetData/cache';
import type { VpnTunnelSummary } from '@/lib/widgetData/contracts';
import { boundedJson, demoVpn, queryDraft, resolveServiceWidget, serviceFailure, serviceIdentity, ServiceError } from '@/lib/widgetData/services';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const summaries = new TtlCache<VpnTunnelSummary>(10_000, 200, 120_000);
// Containers change rarely: read the Docker hosts at most twice a minute, shared by every VPN widget.
const services = new TtlCache<Pick<VpnTunnelSummary, 'services' | 'detached'> | null>(30_000, 50, 300_000);
/** Only for viewers who may read the containers themselves; never fails the widget. */
async function withServices(summary: VpnTunnelSummary, instance: IntegrationInstance, principal: unknown): Promise<VpnTunnelSummary> {
  try {
    const hosts = readConfig().dockerHosts ?? [];
    if (!hosts.length || !canReadResource(principal as AccessPrincipal, READ_ACCESS.dockerContainers)) return summary;
    const found = await services.get(serviceIdentity(instance), async () => tunnelServices(instance, await tunnelContainers(hosts)) ?? null);
    return found ? { ...summary, ...found } : summary;
  } catch { return summary; }
}
// Revisions isolate the summary read after a restart from an older read still in flight.
const revisions = new Map<string, number>();
let revision = 0;
const key = (identity: string) => `${identity}:${revisions.get(identity) ?? 0}`;
function invalidate(identity: string) {
  summaries.delete(key(identity));
  revisions.delete(identity);
  revisions.set(identity, ++revision);
  while (revisions.size > 1000) revisions.delete(revisions.keys().next().value!);
}
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const resolved = resolveServiceWidget(request, url.searchParams.get('widgetId'), 'vpn', queryDraft(url));
    if (resolved.response) return resolved.response;
    const { instance, principal } = resolved;
    const canControl = principal.role === 'admin' || isDemoMode();
    const summary = isDemoMode() ? demoVpn(instance) : await withServices(await summaries.get(key(serviceIdentity(instance)), () => collectGluetun(instance)), instance, principal);
    return NextResponse.json({ ...summary, canControl }, { headers });
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
/** Restart the tunnel: administrators only, same origin and CSRF checks as the other widget actions. */
export async function POST(request: NextRequest) {
  const denied = checkAdmin(request);
  if (denied) return NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 403, headers });
  try {
    const body = await boundedJson(request);
    if (body.action !== 'restart') throw new ServiceError('widgets.error.invalidRequest', 400);
    const resolved = resolveServiceWidget(request, body.widgetId, 'vpn', body.draft);
    if (resolved.response) return resolved.response;
    const { instance, principal } = resolved;
    if (isDemoMode()) return NextResponse.json({ ...demoVpn(instance, true), canControl: true }, { headers });
    const identity = serviceIdentity(instance);
    try { await restartGluetun(instance); }
    finally { invalidate(identity); }
    return NextResponse.json({ ...await withServices(await summaries.get(key(identity), () => collectGluetun(instance)), instance, principal), canControl: true }, { headers });
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
