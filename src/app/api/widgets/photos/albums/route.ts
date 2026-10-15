import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { isDemoMode } from '@/lib/demoMode';
import { immichAlbums } from '@/integrations/immich/collect';
import { photoprismAlbums } from '@/integrations/photoprism/collect';
import { getServiceInstance, serviceFailure } from '@/lib/widgetData/services';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (!isAdmin(request) && !isDemoMode()) return NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 401 });
  try {
    const instance = getServiceInstance(new URL(request.url).searchParams.get('integrationId'), ['immich', 'photoprism']);
    if (!instance) return NextResponse.json({ error: 'widgets.error.notFound' }, { status: 404 });
    if (isDemoMode()) return NextResponse.json({ albums: [{ id: instance.type === 'immich' ? '00000000-0000-4000-8000-000000000001' : 'ademo00000000001', name: 'Summer Trails', count: 24 }] });
    return NextResponse.json({ albums: await (instance.type === 'immich' ? immichAlbums(instance) : photoprismAlbums(instance)) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return serviceFailure(error); }
}
