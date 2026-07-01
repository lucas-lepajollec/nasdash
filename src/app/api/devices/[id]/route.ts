import { NextResponse } from 'next/server';
import { devicesStatusCache, readConfig } from '@/lib/config';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, segmentData: { params: Promise<{ id: string }> }) {
  try {
    const config = readConfig();

    // Bloquer l'accès en mode privé si non authentifié
    if (config.settings?.securityMode === 'private') {
      const session = getSessionFromRequest(request);
      if (!session) {
        return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
      }
    }

    const { id } = await segmentData.params;

    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || id.includes('demo') || id.includes('mock')) {
      const t = Date.now();
      const cpuVal = Math.round(15 + Math.sin(t / 10000) * 8 + (Math.random() * 2));
      const ramVal = Math.round(35 + Math.cos(t / 15000) * 5);
      const tempVal = Math.round(38 + Math.sin(t / 8000) * 3);

      if (id === 'demo-device-1') {
        return NextResponse.json([
          { label: 'CPU', value: `${cpuVal}%`, percent: cpuVal, color: 'var(--nd-accent)' },
          { label: 'RAM', value: `${ramVal}% (5.6 Go / 16 Go)`, percent: ramVal, color: 'var(--nd-purple)' },
          { label: 'Disque (/)', value: '42% (210 Go / 500 Go)', percent: 42, color: 'var(--nd-green)' },
          { label: 'Température', value: `${tempVal}°C`, percent: tempVal, color: 'var(--nd-orange)' }
        ]);
      } else if (id === 'demo-device-2') {
        const cpuPve = Math.round(25 + Math.cos(t / 9000) * 12 + (Math.random() * 3));
        const ramPve = Math.round(62 + Math.sin(t / 14000) * 4);
        return NextResponse.json([
          { label: 'CPU', value: `${cpuPve}%`, percent: cpuPve, color: 'var(--nd-accent)' },
          { label: 'RAM', value: `${ramPve}% (39.6 Go / 64 Go)`, percent: ramPve, color: 'var(--nd-purple)' },
          { label: 'Stockage Ceph', value: '58% (5.8 To / 10 To)', percent: 58, color: 'var(--nd-green)' }
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
    
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read device cache' }, { status: 500 });
  }
}
