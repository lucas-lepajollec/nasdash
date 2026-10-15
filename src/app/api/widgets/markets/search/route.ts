import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { isDemoMode } from '@/lib/demoMode';
import { searchMarkets, type MarketSearchResult } from '@/lib/widgetData/markets';
import { sourceError } from '@/lib/widgetData/outbound';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

/** Fictional matches for the public demo (no outbound request). */
const DEMO: MarketSearchResult[] = [
  { symbol: 'DEMO', name: 'Fictional Cloud Cooperative', kind: 'stock', exchange: 'Example Exchange' },
  { symbol: 'ACME', name: 'Acme Example Robotics', kind: 'stock', exchange: 'Example Exchange' },
  { symbol: 'ORBT', name: 'Orbit Sample Networks', kind: 'stock', exchange: 'Example Exchange' },
  { symbol: 'NOVA-USD', name: 'Nova Example Token', kind: 'crypto', exchange: 'Example Crypto' },
  { symbol: '^EXMPL', name: 'Example Market Index', kind: 'index', exchange: 'Example Exchange' },
];

/** GET ?q=… → symbols matching a name or a ticker, for the watchlist editor (admins only). */
export async function GET(request: NextRequest) {
  if (!isDemoMode() && !isAdmin(request)) return NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 401, headers });
  const query = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (!query || query.length > 40) return NextResponse.json({ error: 'widgets.error.invalidRequest' }, { status: 400, headers });
  if (isDemoMode()) {
    const q = query.toLowerCase();
    return NextResponse.json({ results: DEMO.filter(item => item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)) }, { headers });
  }
  try { return NextResponse.json({ results: await searchMarkets(query) }, { headers }); }
  catch (error) {
    const failure = sourceError('', error);
    return NextResponse.json({ error: failure.error, parameters: failure.parameters }, { status: 502, headers });
  }
}
