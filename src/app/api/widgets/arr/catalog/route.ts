import { NextRequest, NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { resolveAccessPrincipal } from '@/lib/access';
import { isDemoMode } from '@/lib/demoMode';
import { searchCatalog } from '@/integrations/catalog/collect';
import { catalogKinds } from '@/lib/widgetData/arr';
import { demoCatalogHits } from '@/lib/widgetData/arrDemo';
import { resolveWidgetSettings } from '@/lib/widgetData/resolve';
import { ServiceError, serviceFailure } from '@/lib/widgetData/services';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  try {
    const principal = resolveAccessPrincipal(request, readConfig().settings?.securityMode || 'public');
    if (principal?.role !== 'admin') return NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 403, headers });
    const url = new URL(request.url), q = (url.searchParams.get('q') ?? '').trim(), widgetId = url.searchParams.get('widgetId');
    if (q.length < 2 || q.length > 80) throw new ServiceError('widgets.error.invalidRequest', 400);
    const kinds = catalogKinds({ catalogKinds: url.searchParams.has('kinds') ? url.searchParams.get('kinds')!.split(',') : undefined });
    if (widgetId !== null) {
      const resolved = resolveWidgetSettings(request, widgetId, 'media-upcoming');
      if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status, headers });
    }
    return NextResponse.json(isDemoMode() ? demoCatalogHits(kinds) : await searchCatalog(q, kinds), { headers });
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
