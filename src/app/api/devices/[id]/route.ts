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
