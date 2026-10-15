import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { immichHeaders } from '@/integrations/immich/collect';
import { photoprismHeaders, photoprismPreviewToken } from '@/integrations/photoprism/collect';
import { assertStatus, demoLandscape, knownPhoto, PHOTO_HASH, queryDraft, resolveServiceWidget, serviceBytes, serviceFailure, ServiceError, validPhotoId } from '@/lib/widgetData/services';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const resolved = resolveServiceWidget(request, url.searchParams.get('widgetId'), 'photos', queryDraft(url));
    if (resolved.response) return resolved.response;
    const { instance } = resolved;
    const id = url.searchParams.get('id') ?? '', size = url.searchParams.get('size') ?? 'thumb';
    if (!validPhotoId(instance.type, id) || !['thumb', 'preview'].includes(size)) throw new ServiceError('widgets.error.invalidRequest', 400);
    if (isDemoMode()) return new NextResponse(demoLandscape(id), { headers: { ...headers, 'Content-Type': 'image/svg+xml', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
    const asset = knownPhoto(instance, id);
    if (!asset) throw new ServiceError('widgets.error.notFound', 404);
    let path: string;
    if (instance.type === 'immich') path = `/api/assets/${id}/thumbnail?size=${size === 'thumb' ? 'thumbnail' : 'preview'}`;
    else {
      if (!asset.hash || !PHOTO_HASH.test(asset.hash)) throw new ServiceError('widgets.error.notFound', 404);
      const token = await photoprismPreviewToken(instance);
      path = `/api/v1/t/${asset.hash}/${token}/${size === 'thumb' ? 'fit_720' : 'fit_1920'}`;
    }
    const answer = await serviceBytes(instance, path, { headers: instance.type === 'immich' ? immichHeaders(instance) : photoprismHeaders(instance) });
    assertStatus(answer.status);
    // Raster allowlist prevents active SVG/HTML from an upstream being served
    // on NasDash's authenticated origin. The local demo SVG is generated above.
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(answer.contentType)) throw new ServiceError('widgets.error.parse');
    return new NextResponse(new Uint8Array(answer.bytes), { headers: { ...headers, 'Content-Type': answer.contentType } });
  } catch (error) { return serviceFailure(error); }
}
