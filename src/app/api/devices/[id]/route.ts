import { NextResponse } from 'next/server';
import { devicesStatusCache, readConfig } from '@/lib/config';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import { isDemoMode } from '@/lib/demoMode';

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
      const seed = Array.from(id).reduce((value, char) => value + char.charCodeAt(0), 0);
      const cpuVal = 18 + (seed % 11);
      const ramVal = 39 + (seed % 8);

      if (id === 'demo-device-1') {
        return NextResponse.json([
          { label: 'CPU', value: `${cpuVal}%`, percent: cpuVal, color: 'var(--nd-accent)' },
          { label: 'RAM', value: `${ramVal}% (5.6 Go / 16 Go)`, percent: ramVal, color: 'var(--nd-purple)' },
          { label: 'Disque (Données)', value: '42% (210 Go / 500 Go)', percent: 42, color: 'var(--nd-green)' },
          { label: 'Disque (Système)', value: '28% (36 Go / 128 Go)', percent: 28, color: 'var(--nd-orange)' }
        ]);
      } else if (id === 'demo-device-2') {
        const cpuPve = 31;
        const ramPve = 64;
        return NextResponse.json([
          { label: 'CPU', value: `${cpuPve}%`, percent: cpuPve, color: 'var(--nd-accent)' },
          { label: 'RAM', value: `${ramPve}% (39.6 Go / 64 Go)`, percent: ramPve, color: 'var(--nd-purple)' },
          { label: 'Stockage', value: '58% (5.8 To / 10 To)', percent: 58, color: 'var(--nd-green)' },
          { label: 'GPU', value: '24% (3.8 Go / 16 Go)', percent: 24, color: 'var(--nd-purple)' }
        ]);
      } else {
        return NextResponse.json([
          { label: 'CPU', value: `${cpuVal}%`, percent: cpuVal, color: 'var(--nd-accent)' },
          { label: 'RAM', value: `${ramVal}% (2.8 Go / 8 Go)`, percent: ramVal, color: 'var(--nd-purple)' }
        ]);
      }
    }
    
    // Retourne les données en cache ultra rapidement sans aucun ping/calcul
    const cached = devicesStatusCache[id];
    
    if (cached) {
      if (!cached.online) {
        return NextResponse.json({ error: cached.error, isOffline: true }, { status: 200 });
      }
      return NextResponse.json(cached.stats || []);
    }
    
    // Si pas de données dans le cache, on retourne vide en attendant le prochain polling (20s)
    return NextResponse.json([]);
    
  } catch {
    return NextResponse.json({ error: 'Failed to read device cache' }, { status: 500 });
  }
}
