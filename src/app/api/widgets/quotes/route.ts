import { NextRequest, NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { resolveWidgetSettings } from '@/lib/widgetData/resolve';
import { isDemoMode } from '@/lib/demoMode';
import { loadQuotes } from '@/lib/widgetData/quotes';
import { demoQuotes } from '@/lib/widgetData/demo';
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
  const resolved = resolveWidgetSettings(request, body.widgetId, 'quotes', body.draft);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status, headers });
  // Demo: fictional quotes, never a real provider (the browser asks only when its demo config has one).
  if (isDemoMode()) return NextResponse.json(demoQuotes(), { headers });
  try { return NextResponse.json(await loadQuotes(readConfig().settings?.quoteProviders ?? []), { headers }); }
  catch (error) {
    const failure = sourceError('', error);
    return NextResponse.json({ error: failure.error, parameters: failure.parameters }, { status: 502, headers });
  }
}
