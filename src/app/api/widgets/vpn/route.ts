import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { isDemoMode } from '@/lib/demoMode';
import { collectGluetun, restartGluetun } from '@/integrations/gluetun/collect';
import { TtlCache } from '@/lib/widgetData/cache';
import type { VpnTunnelSummary } from '@/lib/widgetData/contracts';
import { boundedJson, demoVpn, queryDraft, resolveServiceWidget, serviceFailure, serviceIdentity, ServiceError } from '@/lib/widgetData/services';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const summaries = new TtlCache<VpnTunnelSummary>(10_000, 200, 120_000);
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
    const summary = isDemoMode() ? demoVpn(instance) : await summaries.get(key(serviceIdentity(instance)), () => collectGluetun(instance));
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
    const { instance } = resolved;
    if (isDemoMode()) return NextResponse.json({ ...demoVpn(instance, true), canControl: true }, { headers });
    const identity = serviceIdentity(instance);
    try { await restartGluetun(instance); }
    finally { invalidate(identity); }
    return NextResponse.json({ ...await summaries.get(key(identity), () => collectGluetun(instance)), canControl: true }, { headers });
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
