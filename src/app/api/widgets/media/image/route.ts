import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { jellyfinHeaders } from '@/integrations/jellyfin/collect';
import { plexHeaders } from '@/integrations/plex/collect';
import { arrHeaders } from '@/integrations/arr/collect';
import { demoMediaArt, knownMediaImage, MEDIA_WIDGET_TYPES } from '@/lib/widgetData/media';
import { ARR_IMAGE_WIDGET_TYPES, librarySource, upcomingSource, widgetSources } from '@/lib/widgetData/arr';
import { LIBRARY_ARR_TYPES, MEDIA_SERVER_TYPES } from '@/lib/widgetData/contracts';
import { resolveWidgetSettings } from '@/lib/widgetData/resolve';
import { assertStatus, queryDraft, serviceBytes, serviceFailure, ServiceError } from '@/lib/widgetData/services';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
/** Pictures keep a day in this browser: the same poster is not fetched again at every refresh. */
const imageHeaders = { 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url), widgetId = url.searchParams.get('widgetId');
    const draft = queryDraft(url);
    const resolved = resolveWidgetSettings(request, widgetId, [...MEDIA_WIDGET_TYPES, ...ARR_IMAGE_WIDGET_TYPES], draft);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status, headers });
    const { principal, widgetType } = resolved;
    const settings = Object.fromEntries(Object.entries(resolved.settings).filter(([, value]) => value !== null));
    const id = url.searchParams.get('id') ?? '', kind = url.searchParams.get('kind');
    if (!/^[a-f0-9]{64}$/.test(id) || (kind !== 'poster' && kind !== 'backdrop')) throw new ServiceError('widgets.error.invalidRequest', 400);
    // Saved widgets use exactly their type's source selection. Admin drafts have
    // no saved type; membership in that exact preview still gates every image.
    const isArr = widgetType ? ARR_IMAGE_WIDGET_TYPES.some(type => type === widgetType) : settings.integrationIds !== undefined;
    let instances;
    if ((widgetType === 'media-upcoming' || !widgetType && settings.source === 'library') && upcomingSource(settings) === 'library') instances = librarySource(settings);
    else if (widgetType || settings.integrationId !== undefined || settings.integrationIds !== undefined) instances = widgetSources(settings, isArr ? LIBRARY_ARR_TYPES : MEDIA_SERVER_TYPES, !isArr);
    else instances = [...widgetSources(settings, LIBRARY_ARR_TYPES), ...widgetSources(settings, MEDIA_SERVER_TYPES)];
    const imageDraft = principal.role === 'admin' && resolved.draft ? settings : undefined;
    const match = instances.map(instance => ({ instance, path: knownMediaImage(instance, widgetId!, id, kind, imageDraft) })).find(value => value.path);
    if (!match) throw new ServiceError('widgets.error.notFound', 404);
    if (isDemoMode()) return new NextResponse(demoMediaArt(id, kind), { headers: { ...imageHeaders, 'Content-Type': 'image/svg+xml', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
    const { instance, path } = match;
    const auth = LIBRARY_ARR_TYPES.some(type => type === instance.type) ? arrHeaders(instance) : instance.type === 'plex' ? plexHeaders(instance) : jellyfinHeaders(instance);
    const answer = await serviceBytes(instance, path!, { headers: auth }, 8 * 1024 * 1024);
    assertStatus(answer.status);
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(answer.contentType)) throw new ServiceError('widgets.error.parse');
    return new NextResponse(new Uint8Array(answer.bytes), { headers: { ...imageHeaders, 'Content-Type': answer.contentType } });
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
