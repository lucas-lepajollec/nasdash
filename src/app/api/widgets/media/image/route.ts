import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { jellyfinHeaders } from '@/integrations/jellyfin/collect';
import { plexHeaders } from '@/integrations/plex/collect';
import { demoMediaArt, knownMediaImage, MEDIA_WIDGET_TYPES } from '@/lib/widgetData/media';
import { assertStatus, queryDraft, resolveServiceWidget, serviceBytes, serviceFailure, ServiceError } from '@/lib/widgetData/services';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url), widgetId = url.searchParams.get('widgetId');
    const draft = queryDraft(url);
    const resolved = resolveServiceWidget(request, widgetId, MEDIA_WIDGET_TYPES, draft);
    if (resolved.response) return resolved.response;
    const { instance, settings, principal } = resolved;
    const id = url.searchParams.get('id') ?? '', kind = url.searchParams.get('kind');
    if (!/^[a-f0-9]{64}$/.test(id) || (kind !== 'poster' && kind !== 'backdrop')) throw new ServiceError('widgets.error.invalidRequest', 400);
    const path = knownMediaImage(instance, widgetId!, id, kind, principal.role === 'admin' && draft ? settings : undefined);
    if (!path) throw new ServiceError('widgets.error.notFound', 404);
    if (isDemoMode()) return new NextResponse(demoMediaArt(id, kind), { headers: { ...headers, 'Content-Type': 'image/svg+xml', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
    const answer = await serviceBytes(instance, path, { headers: instance.type === 'plex' ? plexHeaders(instance) : jellyfinHeaders(instance) }, 8 * 1024 * 1024);
    assertStatus(answer.status);
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(answer.contentType)) throw new ServiceError('widgets.error.parse');
    return new NextResponse(new Uint8Array(answer.bytes), { headers: { ...headers, 'Content-Type': answer.contentType } });
  } catch (error) { return serviceFailure(error); }
}
