import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { isDemoMode } from '@/lib/demoMode';
import { collectPihole, togglePihole } from '@/integrations/pihole/collect';
import { collectAdguard, toggleAdguard } from '@/integrations/adguard/collect';
import { TtlCache } from '@/lib/widgetData/cache';
import type { DnsSummary } from '@/lib/widgetData/contracts';
import { boundedJson, demoDns, queryDraft, resolveServiceWidget, serviceFailure, serviceIdentity, ServiceError } from '@/lib/widgetData/services';
import type { IntegrationInstance } from '@/lib/types';
export const dynamic = 'force-dynamic';
const summaries = new TtlCache<DnsSummary>(15_000, 200, 300_000);
const revisions = new Map<string, number>();
function cacheKey(identity: string) { return `${identity}:${revisions.get(identity) ?? 0}`; }
function invalidate(identity: string) {
  summaries.delete(cacheKey(identity));
  revisions.set(identity, (revisions.get(identity) ?? 0) + 1);
  while (revisions.size > 1000) {
    const oldest = revisions.keys().next().value!;
    summaries.delete(cacheKey(oldest));
    revisions.delete(oldest);
  }
}
const collect = (instance: IntegrationInstance) => instance.type === 'pihole' ? collectPihole(instance) : collectAdguard(instance);
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const resolved = resolveServiceWidget(request, url.searchParams.get('widgetId'), 'dns', queryDraft(url));
    if (resolved.response) return resolved.response;
    const { instance } = resolved;
    if (isDemoMode()) return NextResponse.json(demoDns(instance));
    return NextResponse.json(await summaries.get(cacheKey(serviceIdentity(instance)), () => collect(instance)), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return serviceFailure(error); }
}
export async function POST(request: NextRequest) {
  const authError = checkAdmin(request);
  if (authError) return authError;
  try {
    const body = await boundedJson(request);
    if (typeof body.blocking !== 'boolean' || body.durationSeconds !== undefined && (!Number.isInteger(body.durationSeconds) || Number(body.durationSeconds) < 0 || Number(body.durationSeconds) > 86400)) throw new ServiceError('widgets.error.invalidRequest', 400);
    const resolved = resolveServiceWidget(request, body.widgetId, 'dns', body.draft);
    if (resolved.response) return resolved.response;
    const { instance } = resolved;
    const duration = body.durationSeconds as number | undefined;
    if (isDemoMode()) return NextResponse.json(demoDns(instance, body.blocking, duration));
    const key = serviceIdentity(instance);
    // Bypass any in-flight GET after mutation; never read its pre-toggle cache.
    await (instance.type === 'pihole' ? togglePihole : toggleAdguard)(instance, body.blocking, duration);
    invalidate(key);
    const summary = await collect(instance);
    invalidate(key);
    return NextResponse.json(summary);
  } catch (error) { return serviceFailure(error); }
}
