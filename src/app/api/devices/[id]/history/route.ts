import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import { isDemoMode } from '@/lib/demoMode';
import { devicesStatusCache } from '@/integrations/runtime';
import { readHistory, type HistoryRange } from '@/integrations/history';
import { demoDeviceHistory, demoDeviceMetrics, demoDeviceVitals } from '@/lib/demoDevices';

export const dynamic = 'force-dynamic';

/**
 * A device's current reading and its history:
 * `GET /api/devices/<id>/history?range=1h|24h&since=<ms>` →
 * `{ online, error?, updatedAt, metrics, vitals, series: { <id>: [[t, v], …] } }`.
 * With `since`, only the newer points are returned (the widget appends them).
 */
export async function GET(request: Request, segmentData: { params: Promise<{ id: string }> }) {
  try {
    const config = readConfig();
    const access = checkReadAccess(request, config.settings?.securityMode || 'public', READ_ACCESS.devices);
    if (access.error) return access.error;

    const { id } = await segmentData.params;
    const url = new URL(request.url);
    const range: HistoryRange = url.searchParams.get('range') === '24h' ? '24h' : '1h';
    const since = Math.max(0, Number(url.searchParams.get('since')) || 0);

    if (isDemoMode() || id.includes('demo') || id.includes('mock')) {
      const now = Date.now();
      return NextResponse.json({
        online: true, updatedAt: now,
        metrics: demoDeviceMetrics(id, now), vitals: demoDeviceVitals(id, now),
        series: demoDeviceHistory(id, range, since, now),
      });
    }

    if (!(config.devices ?? []).some(device => device.id === id)) return NextResponse.json({ error: 'Unknown device' }, { status: 404 });
    const cached = devicesStatusCache[id];
    return NextResponse.json({
      online: cached ? cached.online : true,
      ...(cached?.error ? { error: cached.error } : {}),
      updatedAt: cached?.updatedAt ?? 0,
      metrics: cached?.metrics ?? [],
      ...(cached?.stats ? { stats: cached.stats } : {}),
      vitals: cached?.vitals ?? {},
      series: readHistory(id, range, since),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to read device history' }, { status: 500 });
  }
}
