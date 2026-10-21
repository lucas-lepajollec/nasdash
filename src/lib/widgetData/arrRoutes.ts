import { readConfig } from '@/lib/config';
import { collectExternal } from '@/integrations/catalog/collect';
import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { collectArrUpcoming, collectArrRecent, collectArrStatus, collectProwlarrIndexers, type ArrQueueData } from '@/integrations/arr/collect';
import { queueClientCandidates } from '@/integrations/downloads/lookup';
import { arrQueue } from './arrQueue';
import { downloadStatus } from './downloadStatus';
import type { IntegrationInstance } from '@/lib/types';
import type { UpcomingResponse, ArrAppStatus, FollowUpItem, ImportedItem, IndexersResponse, SourceFailure, UpcomingItem } from './contracts';
import { TtlCache } from './cache';
import { demoMediaUpcoming, proxyMediaItem } from './media';
import { collectLibraryUpcoming } from './libraryUpcoming';
import { resolveWidgetSettings } from './resolve';
import { queryDraft, serviceFailure, serviceIdentity } from './services';
import { librarySource, settingNumber, sourceTypes, upcomingKinds, upcomingSources, upcomingPhase, followUpPhase, externalSettings, validateIntegrationIds, widgetSources, type ArrWidgetType } from './arr';
import { demoExternalUpcoming, demoArrQueue, demoArrRecent, demoArrStatus, demoArrUpcoming, demoDownloadClient, demoIndexers } from './arrDemo';
const upcoming = new TtlCache<UpcomingItem[]>(300000);
const status = new TtlCache<ArrAppStatus>(60000), indexers = new TtlCache<IndexersResponse>(120000);
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
    const fetchedAt = Date.now(), imageDraft = admin && resolved.draft ? settings : undefined;
    if (type === 'media-upcoming') {
      const requested = upcomingSources(settings), selection = externalSettings(settings);
      validateIntegrationIds(settings);
      const response: UpcomingResponse = { items: [], failures: [], fetchedAt };
      const start = fetchedAt, end = start + days * 86400000;
      const proxy = <T extends { poster?: string; backdrop?: string; link?: string }>(instance: IntegrationInstance, item: T) => proxyMediaItem(instance, widgetId!, item, admin, imageDraft);
      const parts = await Promise.all(requested.map(async source => {
        const part: Partial<UpcomingResponse> & { failures: SourceFailure[] } = { failures: [] };
        try {
          if (source === 'external') {
            if (demo) part.external = demoExternalUpcoming().filter(item => (settings.ended === true || item.status !== 'ended') && (selection.mode !== 'all' || selection.kinds.includes(item.kind)));
            else Object.assign(part, await collectExternal(selection, settings.ended === true));
          } else if (source === 'library') {
            part.followUps = [];
            const result = await sources(librarySource(settings), instance => demo ? Promise.resolve(demoMediaUpcoming()) : library.get(serviceIdentity(instance), () => collectLibraryUpcoming(instance)));
            part.failures.push(...result.failures);
            part.followUps = result.values.flatMap(({ instance, value }) => value.filter(item => settings.ended === true || item.status !== 'ended').slice(0, 40).map(item => proxy(instance, { ...item, phase: followUpPhase(item) })));
          } else {
            part.items = [];
            // A removed connection fails independently, including when other selected arr connections survive.
            const ids = settings.integrationIds as string[] | undefined;
            const instances: IntegrationInstance[] = [];
            for (const candidate of ids === undefined ? [undefined] : ids) {
              try { instances.push(...widgetSources(candidate === undefined ? settings : { ...settings, integrationIds: [candidate] }, sourceTypes(type))); }
              catch (error) { part.failures.push({ id: candidate ?? 'arr', name: readConfig().integrations?.find(instance => instance.id === candidate)?.name ?? 'Arr', error: (await serviceFailure(error).json()).error }); }
            }
            const result = await sources(instances, instance => demo ? Promise.resolve(demoArrUpcoming(instance, start).filter(item => item.at <= end)) : upcoming.get(JSON.stringify([serviceIdentity(instance), days, Math.floor(start / 86400000)]), () => collectArrUpcoming(instance, start, end)));
            part.failures.push(...result.failures);
            part.items = result.values.flatMap(({ instance, value }) => value.filter(item => kinds.includes(item.kind)).map(item => proxy(instance, { ...item, phase: upcomingPhase(item) }))).sort((a, b) => a.at - b.at);
            if (!part.items.length) {
              const next = await sources(result.values.map(({ instance }) => instance), instance => demo ? Promise.resolve(demoArrUpcoming(instance, end)) : upcoming.get(JSON.stringify([serviceIdentity(instance), 'later', days, Math.floor(start / 86400000)]), () => collectArrUpcoming(instance, end, end + 120 * 86400000)));
              part.failures.push(...next.failures);
              part.later = next.values.flatMap(({ instance, value }) => value.filter(item => kinds.includes(item.kind) && item.at > end && item.at <= end + 120 * 86400000).map(item => ({ instance, item })))
                .sort((a, b) => a.item.at - b.item.at).slice(0, 3).map(({ instance, item }) => proxy(instance, { ...item, phase: upcomingPhase(item) }));
            }
          }
        } catch (error) {
          if (source === 'external') part.external = [];
          if (source === 'library') part.followUps = [];
          const id = source === 'library' && typeof settings.mediaId === 'string' ? settings.mediaId : source;
          part.failures.push({ id, name: readConfig().integrations?.find(instance => instance.id === id)?.name ?? (source === 'library' ? 'Library' : source === 'arr' ? 'Arr' : 'Catalogues'), error: (await serviceFailure(error).json()).error });
        }
        return part;
      }));
      for (const { failures, ...fields } of parts) { Object.assign(response, fields); response.failures.push(...failures); }
      return NextResponse.json(response, { headers });
    }
    const instances = widgetSources(settings, sourceTypes(type), type === 'media-indexers');
    if (type === 'media-indexers') {
      const instance = instances[0];
      return NextResponse.json(demo ? demoIndexers(instance) : await indexers.get(serviceIdentity(instance), () => collectProwlarrIndexers(instance)), { headers });
    }
    if (type === 'media-arr') {
      const apps = await Promise.all(instances.map(instance => demo ? demoArrStatus(instance) : status.get(serviceIdentity(instance), () => collectArrStatus(instance))));
      return NextResponse.json({ apps, fetchedAt }, { headers });
    }
    if (type === 'media-downloads') {
      const result = await sources(instances, instance => demo ? Promise.resolve(demoDownloadClient(instance)) : downloadStatus(instance));
      return NextResponse.json({ clients: result.values.map(({ value }) => ({ ...value, canControl: admin || demo, items: value.items.slice(0, items) })), failures: result.failures, fetchedAt }, { headers });
    }
    const result = await sources<ArrQueueData>(instances, instance => demo ? Promise.resolve({ ...demoArrQueue(instance), downloads: new Map() }) : arrQueue(instance));
    const total = result.values.reduce((sum, { value }) => sum + value.total, 0);
    const history = total === 0 ? await sources(result.values.map(({ instance }) => instance), instance => demo ? Promise.resolve(demoArrRecent(instance)) : recent.get(serviceIdentity(instance), () => collectArrRecent(instance))) : undefined;
    const savedClients = readConfig().integrations ?? [];
    const entries = result.values.flatMap(({ instance, value }) => value.items.map(item => {
      const download = value.downloads.get(item.id);
      return { instance, item: { ...item, ...((admin || demo) && (demo || download && queueClientCandidates(savedClients, download).length > 0) ? { canControl: true } : {}) } };
    })).slice(0, count).map(({ instance, item }) => proxyMediaItem(instance, widgetId!, item, admin, imageDraft));
    const imports = history?.values.flatMap(({ instance, value }) => value.map(item => ({ instance, item }))).sort((a, b) => b.item.at - a.item.at).slice(0, 6)
      .map(({ instance, item }) => proxyMediaItem(instance, widgetId!, item, admin, imageDraft));
    return NextResponse.json({ items: entries, total, ...(imports ? { recent: imports } : {}), failures: [...result.failures, ...(history?.failures ?? [])], fetchedAt }, { headers });
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
