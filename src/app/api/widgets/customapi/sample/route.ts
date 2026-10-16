import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { isDemoMode } from '@/lib/demoMode';
import { CUSTOM_API_TYPES, type CustomApiSample } from '@/lib/widgetData/contracts';
import { customApiRequest, customApiSample } from '@/lib/widgetData/customApi';
import { customApiDemo } from '@/lib/widgetData/customApiDemo';
import { getServiceInstance, serviceFailure } from '@/lib/widgetData/services';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (!isAdmin(request) && !isDemoMode()) return NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 401 });
  try {
    const instance = getServiceInstance(new URL(request.url).searchParams.get('integrationId'), CUSTOM_API_TYPES);
    if (!instance) return NextResponse.json({ error: 'widgets.error.notFound' }, { status: 404 });
    const json = isDemoMode() ? customApiDemo : await customApiRequest(instance);
    const response: CustomApiSample = { ...customApiSample(json), fetchedAt: Date.now() };
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return serviceFailure(error); }
}
