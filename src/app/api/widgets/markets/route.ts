import { NextRequest, NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { widgetSymbols } from '@/lib/widgetData/sources';
import { resolveWidgetSettings } from '@/lib/widgetData/resolve';
import { isDemoMode } from '@/lib/demoMode';
import { loadMarkets, marketRange } from '@/lib/widgetData/markets';
import { demoMarkets } from '@/lib/widgetData/demo';
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
  const resolved = resolveWidgetSettings(request, body.widgetId, 'markets', body.draft);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status, headers });
  if (isDemoMode()) return NextResponse.json(demoMarkets(marketRange(body.range) ?? marketRange(resolved.settings.range)), { headers });
  try { return NextResponse.json(await loadMarkets({ ...resolved.settings, symbols: widgetSymbols(resolved.settings, readConfig()) }, body.range), { headers }); }
  catch (error) {
    const failure = sourceError('', error);
    return NextResponse.json({ error: failure.error, parameters: failure.parameters }, { status: 502, headers });
  }
}
