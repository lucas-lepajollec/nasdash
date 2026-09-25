import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { devicesStatusCache } from '@/integrations/runtime';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import { isDemoMode } from '@/lib/demoMode';
import { demoDeviceMetrics } from '@/lib/demoDevices';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, segmentData: { params: Promise<{ id: string }> }) {
  try {
    const config = readConfig();
    const access = checkReadAccess(
      request,
      config.settings?.securityMode || 'public',
      READ_ACCESS.devices
    );
    if (access.error) return access.error;

    const { id } = await segmentData.params;

    if (isDemoMode() || id.includes('demo') || id.includes('mock')) {
      const metrics = demoDeviceMetrics(id);
      return NextResponse.json(metrics);
    }
    
    // Retourne les données en cache ultra rapidement sans aucun ping/calcul
    const cached = devicesStatusCache[id];
    
    if (cached) {
      if (!cached.online) {
        return NextResponse.json({ error: cached.error, isOffline: true }, { status: 200 });
      }
      // Metrics for integrations, hand-written stats for the other devices.
      return NextResponse.json(cached.metrics ?? cached.stats ?? []);
    }
    
    // Si pas de données dans le cache, on retourne vide en attendant le prochain polling (20s)
    return NextResponse.json([]);
    
  } catch {
    return NextResponse.json({ error: 'Failed to read device cache' }, { status: 500 });
  }
}
