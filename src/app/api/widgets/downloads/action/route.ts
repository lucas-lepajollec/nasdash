import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { isDemoMode } from '@/lib/demoMode';
import { resolveWidgetSettings } from '@/lib/widgetData/resolve';
import { sourceTypes, widgetSources } from '@/lib/widgetData/arr';
import { demoDownloadClient } from '@/lib/widgetData/arrDemo';
import { downloadStatus, invalidateDownloadStatus } from '@/lib/widgetData/downloadStatus';
import { boundedJson, ServiceError, serviceFailure } from '@/lib/widgetData/services';
import { controlDownloadClient, validDownloadItemId } from '@/integrations/downloads/action';
import type { DownloadActionRequest, DownloadClientType } from '@/lib/widgetData/contracts';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: NextRequest) {
  // Same authentication and origin/CSRF check as the DNS toggle, with a 403 for denied control.
  const denied = checkAdmin(request);
  if (denied) return NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 403, headers });
  try {
    const body = await boundedJson(request);
    if (typeof body.clientId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.clientId) || !['pause', 'resume'].includes(body.action as string) || body.itemId !== undefined && typeof body.itemId !== 'string') throw new ServiceError('widgets.error.invalidRequest', 400);
    const resolved = resolveWidgetSettings(request, body.widgetId, 'media-downloads');
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status === 401 ? 403 : resolved.status, headers });
    const demo = isDemoMode();
    if (!demo && resolved.principal.role !== 'admin') return NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 403, headers });
    const settings = Object.fromEntries(Object.entries(resolved.settings).filter(([, value]) => value !== null));
    const instance = widgetSources(settings, sourceTypes('media-downloads')).find(instance => instance.id === body.clientId);
    if (!instance) throw new ServiceError('widgets.error.notFound', 404);
    if (body.itemId !== undefined && !validDownloadItemId(instance.type as DownloadClientType, body.itemId)) throw new ServiceError('widgets.error.invalidRequest', 400);
    const { action, itemId } = body as unknown as DownloadActionRequest;
    if (demo) return NextResponse.json(demoDownloadClient(instance, action, itemId), { headers });
    try { await controlDownloadClient(instance, action, itemId); }
    finally { invalidateDownloadStatus(instance); }
    // A revision prevents an older GET in flight from restoring pre-action status.
    const status = await downloadStatus(instance);
    return NextResponse.json({ ...status, canControl: true }, { headers });
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
