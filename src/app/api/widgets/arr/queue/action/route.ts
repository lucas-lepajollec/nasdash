import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { readConfig } from '@/lib/config';
import { isDemoMode } from '@/lib/demoMode';
import { resolveWidgetSettings } from '@/lib/widgetData/resolve';
import { sourceTypes, widgetSources, settingNumber } from '@/lib/widgetData/arr';
import { arrRoute } from '@/lib/widgetData/arrRoutes';
import { arrQueue, invalidateArrQueue } from '@/lib/widgetData/arrQueue';
import { demoArrQueue } from '@/lib/widgetData/arrDemo';
import { invalidateDownloadStatus } from '@/lib/widgetData/downloadStatus';
import { boundedJson, ServiceError, serviceFailure } from '@/lib/widgetData/services';
import { controlDownloadClient } from '@/integrations/downloads/action';
import { findQueueDownload, invalidateDownloadLookup } from '@/integrations/downloads/lookup';
import type { QueueActionRequest } from '@/lib/widgetData/contracts';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: NextRequest) {
  const denied = checkAdmin(request);
  if (denied) return NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 403, headers });
  try {
    const body = await boundedJson(request);
    if (typeof body.itemId !== 'string' || !body.itemId || body.itemId.length > 256 || !['pause', 'resume'].includes(body.action as string)) throw new ServiceError('widgets.error.invalidRequest', 400);
    const resolved = resolveWidgetSettings(request, body.widgetId, 'media-queue');
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status === 401 ? 403 : resolved.status, headers });
    const demo = isDemoMode();
    if (!demo && resolved.principal.role !== 'admin') return NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 403, headers });
    const settings = Object.fromEntries(Object.entries(resolved.settings).filter(([, value]) => value !== null));
    settingNumber(settings, 'count', 10, 3, 50);
    const instances = widgetSources(settings, sourceTypes('media-queue'));
    const { itemId, action, widgetId } = body as unknown as QueueActionRequest;
    // Queue ids are namespaced by their *arr instance. Only a source saved on this widget can authorize the action.
    const instance = instances.find(source => itemId.startsWith(`${source.id}:`));
    if (!instance) throw new ServiceError('widgets.error.notFound', 404);
    if (demo) demoArrQueue(instance, action, itemId);
    else {
      const data = await arrQueue(instance);
      if (!data.items.some(item => item.id === itemId)) throw new ServiceError('widgets.error.notFound', 404);
      const download = data.downloads.get(itemId);
      if (!download) throw new ServiceError('widgets.error.noDownloadClient', 404);
      const target = await findQueueDownload(readConfig().integrations ?? [], download);
      try { await controlDownloadClient(target.instance, action, target.itemId); }
      finally {
        invalidateDownloadStatus(target.instance);
        invalidateDownloadLookup(target.instance, download.downloadId);
        // The same client download can appear in several *arr queues.
        for (const source of widgetSources({}, sourceTypes('media-queue'))) invalidateArrQueue(source);
      }
    }
    return arrRoute(new NextRequest(new URL(`/api/widgets/arr/queue?widgetId=${encodeURIComponent(widgetId)}`, request.url), { headers: request.headers }), 'media-queue');
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
