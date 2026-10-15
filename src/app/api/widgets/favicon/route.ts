import { NextRequest, NextResponse } from 'next/server';
import { resolveWidgetSettings } from '@/lib/widgetData/resolve';
import { httpUrl } from '@/lib/widgetData/outbound';
import { loadFavicon } from '@/lib/widgetData/favicon';
import { isDemoMode } from '@/lib/demoMode';
import { resolveAccessPrincipal } from '@/lib/access';
import { readConfig } from '@/lib/config';
import { widgetFeeds } from '@/lib/widgetData/sources';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // Bookmarks show their links' icons, RSS its feeds' sites.
  const type = params.get('type') === 'rss' ? 'rss' : 'bookmarks';
  // Administrators see the bookmarks library itself (settings, a widget not
  // saved yet); others only through a bookmarks widget they can see.
  const library = type === 'bookmarks' && !params.get('widgetId') && resolveAccessPrincipal(request)?.role === 'admin';
  const resolved = library ? null : resolveWidgetSettings(request, params.get('widgetId'), type, undefined);
  if (resolved && !resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status, headers });
  if (isDemoMode()) return new NextResponse(null, { status: 404, headers });
  let requested: string;
  try { requested = httpUrl(params.get('url') ?? '').origin; }
  catch { return NextResponse.json({ error: 'widgets.error.parse' }, { status: 400, headers }); }
  // Only the sites of sources an admin saved, for everyone: the address fetched is the
  // saved one, read from the config, never the text of this request.
  const savedUrls = type === 'rss'
    ? widgetFeeds(resolved?.ok ? resolved.settings : {}, readConfig()).map(feed => feed.url)
    : (readConfig().settings?.bookmarks ?? []).flatMap(item => item.kind === 'link' && typeof item.url === 'string' ? [item.url] : []);
  const origin = savedUrls.map(url => { try { return httpUrl(url).origin; } catch { return undefined; } }).find(saved => saved === requested);
  if (!origin) return NextResponse.json({ error: 'widgets.error.notFound' }, { status: 404, headers });
  try {
    const icon = await loadFavicon(origin);
    if (!icon) return new NextResponse(null, { status: 404, headers });
    return new NextResponse(new Uint8Array(icon.bytes), { headers: {
      'Cache-Control': 'private, max-age=604800, immutable', 'Content-Type': icon.contentType, 'X-Content-Type-Options': 'nosniff',
      ...(icon.ext === 'svg' ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } : {}),
    } });
  } catch { return new NextResponse(null, { status: 404, headers }); }
}
