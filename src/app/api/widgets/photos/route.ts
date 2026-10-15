import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { collectImmich } from '@/integrations/immich/collect';
import { collectPhotoprism } from '@/integrations/photoprism/collect';
import { TtlCache } from '@/lib/widgetData/cache';
import type { PhotosResponse } from '@/lib/widgetData/contracts';
import { demoPhotos, photoSelection, photoUrls, queryDraft, rememberWidgetPhoto, resolveServiceWidget, serviceFailure, serviceIdentity, ServiceError } from '@/lib/widgetData/services';
export const dynamic = 'force-dynamic';
const photosCache = new TtlCache<PhotosResponse>(300_000);
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url), widgetId = url.searchParams.get('widgetId');
    const draft = queryDraft(url);
    const resolved = resolveServiceWidget(request, widgetId, 'photos', draft);
    if (resolved.response) return resolved.response;
    const { instance, settings } = resolved;
    const selection = photoSelection(settings, instance.type);
    const seed = url.searchParams.get('seed') ?? '';
    if (seed.length > 128) throw new ServiceError('widgets.error.invalidRequest', 400);
    // Only the sanitizer-approved draft is reflected in proxy URLs.
    const imageDraft = resolved.principal.role === 'admin' && draft ? settings : undefined;
    if (isDemoMode()) return NextResponse.json(demoPhotos(instance, selection.count, widgetId!, seed, imageDraft));
    const key = JSON.stringify([serviceIdentity(instance), selection, selection.mode === 'random' ? seed : '']);
    const result = await photosCache.get(key, () => instance.type === 'immich' ? collectImmich(instance, selection, '') : collectPhotoprism(instance, selection, ''));
    // Previews (drafts) do not open images for the saved widget.
    if (!imageDraft) for (const photo of result.photos) rememberWidgetPhoto(instance, widgetId!, photo.id);
    // The link to the library carries its address: administrators only, like the connection itself.
    const admin = resolved.principal.role === 'admin';
    return NextResponse.json({ ...result, photos: result.photos.map(({ link, ...photo }) => ({ ...photo, ...(admin && link ? { link } : {}), ...photoUrls(widgetId!, photo.id, imageDraft) })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return serviceFailure(error); }
}
