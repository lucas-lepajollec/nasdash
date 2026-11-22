import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { demoArtFor } from '@/lib/demo/library';
import { resolveKitWidget } from '@/lib/widgetData/kitResolve';
import { demoLandscape, queryDraft, serviceFailure, ServiceError } from '@/lib/widgetData/services';

/**
 * GET /api/widgets/kit/image?widget=<type>&widgetId=…&id=<image id> — an image
 * of a kit widget's connection (a book cover), for whoever may see the widget.
 * Only ids the integration listed in its own answers are served (`KitServer.image`).
 */
export const dynamic = 'force-dynamic';
const ID = /^[A-Za-z0-9_.:-]{1,160}$/;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id') ?? '';
    if (!ID.test(id)) throw new ServiceError('widgets.error.invalidRequest', 400);
    const resolved = resolveKitWidget(request, url.searchParams.get('widget'), url.searchParams.get('widgetId'), queryDraft(url));
    if (resolved.response) return resolved.response;
    const { instance, server } = resolved;
    if (isDemoMode()) {
      // The demo's covers ship with it (public-domain works); anything else gets drawn art.
      const file = demoArtFor(id);
      if (file) return new NextResponse(null, { status: 307, headers: { 'Cache-Control': 'private, max-age=3600', Location: file } });
      return new NextResponse(demoLandscape(id), { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, max-age=3600', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
    }
    if (!server.image) throw new ServiceError('widgets.error.notFound', 404);
    const image = await server.image(instance, id);
    if (!/^image\/(png|jpe?g|webp|gif|avif)$/.test(image.contentType)) throw new ServiceError('widgets.error.parse');
    return new NextResponse(new Uint8Array(image.bytes), { headers: { 'Content-Type': image.contentType, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return serviceFailure(error); }
}
