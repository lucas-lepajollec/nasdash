import { NextRequest, NextResponse } from 'next/server';
import { resolveWidgetSettings } from '@/lib/widgetData/resolve';
import { isDemoMode } from '@/lib/demoMode';
import { loadRss } from '@/lib/widgetData/rss';
import { readConfig } from '@/lib/config';
import { widgetFeeds } from '@/lib/widgetData/sources';
import { demoRss } from '@/lib/widgetData/demo';
import { sourceError } from '@/lib/widgetData/outbound';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed;
  } catch { return NextResponse.json({ error: 'widgets.error.parse' }, { status: 400, headers }); }
  const resolved = resolveWidgetSettings(request, body.widgetId, 'rss', body.draft);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status, headers });
  if (isDemoMode()) return NextResponse.json(demoRss(), { headers });
  try { return NextResponse.json(await loadRss({ ...resolved.settings, feeds: widgetFeeds(resolved.settings, readConfig()) }), { headers }); }
  catch (error) {
    const failure = sourceError('', error);
    return NextResponse.json({ error: failure.error, parameters: failure.parameters }, { status: 502, headers });
  }
}
