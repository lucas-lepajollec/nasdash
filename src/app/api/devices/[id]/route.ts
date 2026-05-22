import { NextResponse } from 'next/server';
import { devicesStatusCache } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, segmentData: { params: Promise<{ id: string }> }) {
  try {
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
