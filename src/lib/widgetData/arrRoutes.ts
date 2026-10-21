import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { collectArrUpcoming, collectArrQueue, collectArrStatus, collectProwlarrIndexers } from '@/integrations/arr/collect';
import { collectDownloadClient } from '@/integrations/downloads/collect';
import type { IntegrationInstance } from '@/lib/types';
import type { ArrAppStatus, DownloadClientStatus, IndexersResponse, QueueItem, SourceFailure, UpcomingItem } from './contracts';
import { TtlCache } from './cache';
import { proxyMediaItem } from './media';
import { resolveWidgetSettings } from './resolve';
import { queryDraft, serviceFailure, serviceIdentity } from './services';
import { settingNumber, sourceTypes, upcomingKinds, widgetSources, type ArrWidgetType } from './arr';
import { demoArrQueue, demoArrStatus, demoArrUpcoming, demoDownloadClient, demoIndexers } from './arrDemo';
const upcoming = new TtlCache<UpcomingItem[]>(300000), queue = new TtlCache<{ items: QueueItem[]; total: number }>(10000);
const status = new TtlCache<ArrAppStatus>(60000), indexers = new TtlCache<IndexersResponse>(120000), downloads = new TtlCache<DownloadClientStatus>(3000);
const headers = { 'Cache-Control': 'private, no-store' };
async function sources<T>(instances: IntegrationInstance[], load: (instance: IntegrationInstance) => Promise<T>) {
  const results = await Promise.allSettled(instances.map(load));
  const failures: SourceFailure[] = [], values: { instance: IntegrationInstance; value: T }[] = [];
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') values.push({ instance: instances[i], value: result.value });
    else { const body = await serviceFailure(result.reason).json(); failures.push({ id: instances[i].id, name: instances[i].name, error: body.error }); }
  }
  return { values, failures };
}
export async function arrRoute(request: NextRequest, type: ArrWidgetType) {
  try {
    const url = new URL(request.url), widgetId = url.searchParams.get('widgetId'), draft = queryDraft(url);
    const resolved = resolveWidgetSettings(request, widgetId, type, draft);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status, headers });
    // `null` is how widget settings clear a value: the same as absent.
    const settings = Object.fromEntries(Object.entries(resolved.settings).filter(([, value]) => value !== null));
    const { principal } = resolved, demo = isDemoMode(), admin = principal.role === 'admin';
    // Validate before fetching any source, including when no connections have been saved.
    const days = type === 'media-upcoming' ? settingNumber(settings, 'days', 14, 1, 60) : 14;
    const kinds = type === 'media-upcoming' ? upcomingKinds(settings) : [];
    const count = type === 'media-queue' ? settingNumber(settings, 'count', 10, 3, 50) : 10;
    const items = type === 'media-downloads' ? settingNumber(settings, 'items', 5, 0, 10) : 5;
    const instances = widgetSources(settings, sourceTypes(type), type === 'media-indexers');
    const fetchedAt = Date.now(), imageDraft = admin && resolved.draft ? settings : undefined;
    if (type === 'media-indexers') {
      const instance = instances[0];
      return NextResponse.json(demo ? demoIndexers(instance) : await indexers.get(serviceIdentity(instance), () => collectProwlarrIndexers(instance)), { headers });
    }
    if (type === 'media-arr') {
      const apps = await Promise.all(instances.map(instance => demo ? demoArrStatus(instance) : status.get(serviceIdentity(instance), () => collectArrStatus(instance))));
      return NextResponse.json({ apps, fetchedAt }, { headers });
    }
    if (type === 'media-downloads') {
      const result = await sources(instances, instance => demo ? Promise.resolve(demoDownloadClient(instance)) : downloads.get(serviceIdentity(instance), () => collectDownloadClient(instance)));
      return NextResponse.json({ clients: result.values.map(({ value }) => ({ ...value, items: value.items.slice(0, items) })), failures: result.failures, fetchedAt }, { headers });
    }
    if (type === 'media-upcoming') {
      const start = fetchedAt, end = start + days * 86400000;
      const result = await sources(instances, instance => demo ? Promise.resolve(demoArrUpcoming(instance, start)) : upcoming.get(JSON.stringify([serviceIdentity(instance), days, Math.floor(start / 86400000)]), () => collectArrUpcoming(instance, start, end)));
      const entries = result.values.flatMap(({ instance, value }) => value.filter(item => kinds.includes(item.kind)).map(item => proxyMediaItem(instance, widgetId!, item, admin, imageDraft))).sort((a, b) => a.at - b.at);
      return NextResponse.json({ items: entries, failures: result.failures, fetchedAt }, { headers });
    }
    const result = await sources(instances, instance => demo ? Promise.resolve(demoArrQueue(instance)) : queue.get(serviceIdentity(instance), () => collectArrQueue(instance)));
    return NextResponse.json({ items: result.values.flatMap(({ instance, value }) => value.items.map(item => proxyMediaItem(instance, widgetId!, item, admin, imageDraft))).slice(0, count),
      total: result.values.reduce((sum, { value }) => sum + value.total, 0), failures: result.failures, fetchedAt }, { headers });
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
