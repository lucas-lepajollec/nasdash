import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { isDemoMode } from '@/lib/demoMode';
import { technitiumNodes } from '@/integrations/technitium/collect';
import { getServiceInstance, serviceFailure } from '@/lib/widgetData/services';
export const dynamic = 'force-dynamic';
/** GET ?integrationId=… (admin) → the nodes of a Technitium cluster, by name, for a widget's settings. */
export async function GET(request: NextRequest) {
  if (!isAdmin(request) && !isDemoMode()) return NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 401 });
  try {
    const instance = getServiceInstance(new URL(request.url).searchParams.get('integrationId'), ['technitium']);
    if (!instance) return NextResponse.json({ error: 'widgets.error.notFound' }, { status: 404 });
    if (isDemoMode()) return NextResponse.json({ cluster: true, nodes: ['dns1.demo.invalid', 'dns2.demo.invalid'] });
    return NextResponse.json(await technitiumNodes(instance), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return serviceFailure(error); }
}
