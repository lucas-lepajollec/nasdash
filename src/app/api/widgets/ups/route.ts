import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { collectNut } from '@/integrations/nut/collect';
import { collectApcupsd } from '@/integrations/apcupsd/collect';
import { TtlCache } from '@/lib/widgetData/cache';
import type { UpsSummary } from '@/lib/widgetData/contracts';
import { demoUps, queryDraft, resolveServiceWidget, serviceFailure, serviceIdentity, ServiceError } from '@/lib/widgetData/services';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
// A UPS changes within seconds when the power goes: a short cache, shared by every widget on the same UPS.
const summaries = new TtlCache<UpsSummary>(5_000, 200, 60_000);
/** Read only: neither protocol is ever asked to change anything. */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const resolved = resolveServiceWidget(request, url.searchParams.get('widgetId'), 'ups', queryDraft(url));
    if (resolved.response) return resolved.response;
    const { instance, settings } = resolved;
    const ups = settings.ups === undefined || settings.ups === null || settings.ups === '' ? undefined : settings.ups;
    if (ups !== undefined && (typeof ups !== 'string' || instance.type !== 'nut')) throw new ServiceError('widgets.error.invalidSettings', 400);
    if (isDemoMode()) return NextResponse.json(demoUps(instance), { headers });
    const summary = await summaries.get(`${serviceIdentity(instance)}:${ups ?? ''}`, () => instance.type === 'nut' ? collectNut(instance, ups) : collectApcupsd(instance));
    return NextResponse.json(summary, { headers });
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
