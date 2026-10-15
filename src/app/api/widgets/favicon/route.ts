import { NextRequest, NextResponse } from 'next/server';
import { resolveWidgetSettings } from '@/lib/widgetData/resolve';
import { httpUrl } from '@/lib/widgetData/outbound';
import { loadFavicon } from '@/lib/widgetData/favicon';
import { isDemoMode } from '@/lib/demoMode';
import { readConfig } from '@/lib/config';
import { widgetFeeds } from '@/lib/widgetData/sources';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // Bookmarks show their links' icons, RSS its feeds' sites.
  const type = params.get('type') === 'rss' ? 'rss' : 'bookmarks';
  const resolved = resolveWidgetSettings(request, params.get('widgetId'), type, undefined);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status, headers });
  if (isDemoMode()) return new NextResponse(null, { status: 404, headers });
  let origin: string;
  try { origin = httpUrl(params.get('url') ?? '').origin; }
  catch { return NextResponse.json({ error: 'widgets.error.parse' }, { status: 400, headers }); }
  const sameOrigin = (url: unknown) => {
    if (typeof url !== 'string') return false;
    try { return httpUrl(url).origin === origin; } catch { return false; }
  };
  const saved = type === 'rss'
    ? widgetFeeds(resolved.settings, readConfig()).some(feed => sameOrigin(feed.url))
    : Array.isArray(resolved.settings.items) && resolved.settings.items.some(item => !!item && typeof item === 'object' && 'kind' in item && item.kind === 'link' && 'url' in item && sameOrigin(item.url));
  if (resolved.principal.role !== 'admin' && !saved) return NextResponse.json({ error: 'widgets.error.notFound' }, { status: 404, headers });
  try {
    const icon = await loadFavicon(origin);
    if (!icon) return new NextResponse(null, { status: 404, headers });
    return new NextResponse(new Uint8Array(icon.bytes), { headers: {
      'Cache-Control': 'private, max-age=604800, immutable', 'Content-Type': icon.contentType, 'X-Content-Type-Options': 'nosniff',
      ...(icon.ext === 'svg' ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } : {}),
    } });
  } catch { return new NextResponse(null, { status: 404, headers }); }
}
