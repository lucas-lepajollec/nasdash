import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { collectArrUpcoming, collectArrQueue, collectArrRecent, collectArrStatus, collectProwlarrIndexers } from '@/integrations/arr/collect';
import { collectDownloadClient } from '@/integrations/downloads/collect';
import type { IntegrationInstance } from '@/lib/types';
import type { ArrAppStatus, DownloadClientStatus, FollowUpItem, ImportedItem, IndexersResponse, QueueItem, SourceFailure, UpcomingItem } from './contracts';
import { TtlCache } from './cache';
import { demoMediaUpcoming, proxyMediaItem } from './media';
import { collectLibraryUpcoming } from './libraryUpcoming';
import { resolveWidgetSettings } from './resolve';
import { queryDraft, serviceFailure, serviceIdentity } from './services';
import { librarySource, settingNumber, sourceTypes, upcomingKinds, upcomingSource, widgetSources, type ArrWidgetType } from './arr';
import { demoArrQueue, demoArrRecent, demoArrStatus, demoArrUpcoming, demoDownloadClient, demoIndexers } from './arrDemo';
const upcoming = new TtlCache<UpcomingItem[]>(300000), queue = new TtlCache<{ items: QueueItem[]; total: number }>(10000);
const status = new TtlCache<ArrAppStatus>(60000), indexers = new TtlCache<IndexersResponse>(120000), downloads = new TtlCache<DownloadClientStatus>(3000);
const recent = new TtlCache<ImportedItem[]>(60000), library = new TtlCache<FollowUpItem[]>(1800000);
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
    const libraryMode = type === 'media-upcoming' && upcomingSource(settings) === 'library';
    const instances = libraryMode ? librarySource(settings) : widgetSources(settings, sourceTypes(type), type === 'media-indexers');
    const fetchedAt = Date.now(), imageDraft = admin && resolved.draft ? settings : undefined;
    if (libraryMode) {
      const result = await sources(instances, instance => demo ? Promise.resolve(demoMediaUpcoming()) : library.get(serviceIdentity(instance), () => collectLibraryUpcoming(instance)));
      const followUps = result.values.flatMap(({ instance, value }) => value.filter(item => settings.ended === true || item.status !== 'ended').slice(0, 40).map(item => proxyMediaItem(instance, widgetId!, item, admin, imageDraft)));
      return NextResponse.json({ items: [], followUps, failures: result.failures, fetchedAt }, { headers });
    }
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
      const result = await sources(instances, instance => demo ? Promise.resolve(demoArrUpcoming(instance, start).filter(item => item.at <= end)) : upcoming.get(JSON.stringify([serviceIdentity(instance), days, Math.floor(start / 86400000)]), () => collectArrUpcoming(instance, start, end)));
      const entries = result.values.flatMap(({ instance, value }) => value.filter(item => kinds.includes(item.kind)).map(item => proxyMediaItem(instance, widgetId!, item, admin, imageDraft))).sort((a, b) => a.at - b.at);
      if (entries.length) return NextResponse.json({ items: entries, failures: result.failures, fetchedAt }, { headers });
      const next = await sources(result.values.map(({ instance }) => instance), instance => demo ? Promise.resolve(demoArrUpcoming(instance, end)) : upcoming.get(JSON.stringify([serviceIdentity(instance), 'later', days, Math.floor(start / 86400000)]), () => collectArrUpcoming(instance, end, end + 120 * 86400000)));
      const later = next.values.flatMap(({ instance, value }) => value.filter(item => kinds.includes(item.kind) && item.at > end && item.at <= end + 120 * 86400000).map(item => ({ instance, item })))
        .sort((a, b) => a.item.at - b.item.at).slice(0, 3).map(({ instance, item }) => proxyMediaItem(instance, widgetId!, item, admin, imageDraft));
      return NextResponse.json({ items: entries, later, failures: [...result.failures, ...next.failures], fetchedAt }, { headers });
    }
    const result = await sources(instances, instance => demo ? Promise.resolve(demoArrQueue(instance)) : queue.get(serviceIdentity(instance), () => collectArrQueue(instance)));
    const total = result.values.reduce((sum, { value }) => sum + value.total, 0);
    const history = total === 0 ? await sources(result.values.map(({ instance }) => instance), instance => demo ? Promise.resolve(demoArrRecent(instance)) : recent.get(serviceIdentity(instance), () => collectArrRecent(instance))) : undefined;
    const entries = result.values.flatMap(({ instance, value }) => value.items.map(item => ({ instance, item }))).slice(0, count).map(({ instance, item }) => proxyMediaItem(instance, widgetId!, item, admin, imageDraft));
    const imports = history?.values.flatMap(({ instance, value }) => value.map(item => ({ instance, item }))).sort((a, b) => b.item.at - a.item.at).slice(0, 6)
      .map(({ instance, item }) => proxyMediaItem(instance, widgetId!, item, admin, imageDraft));
    return NextResponse.json({ items: entries, total, ...(imports ? { recent: imports } : {}), failures: [...result.failures, ...(history?.failures ?? [])], fetchedAt }, { headers });
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
