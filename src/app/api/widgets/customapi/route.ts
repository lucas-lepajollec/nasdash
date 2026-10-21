import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { TtlCache } from '@/lib/widgetData/cache';
import type { CustomApiResponse } from '@/lib/widgetData/contracts';
import { customApiRequest, customApiSpec, extractCustomApi } from '@/lib/widgetData/customApi';
import { customApiDemo } from '@/lib/widgetData/customApiDemo';
import { queryDraft, resolveServiceWidget, serviceFailure, serviceIdentity } from '@/lib/widgetData/services';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const answers = new TtlCache<{ json: unknown; fetchedAt: number }>(60_000, 200);
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const resolved = resolveServiceWidget(request, url.searchParams.get('widgetId'), 'customapi', queryDraft(url));
    if (resolved.response) { resolved.response.headers.set('Cache-Control', headers['Cache-Control']); return resolved.response; }
    const { instance, settings } = resolved;
    const spec = customApiSpec(settings);
    const answer = isDemoMode() ? { json: customApiDemo, fetchedAt: Date.now() }
      : await answers.get(serviceIdentity(instance), async () => ({ json: await customApiRequest(instance), fetchedAt: Date.now() }), Date.now(), Math.min(spec.refresh, 60) * 1000);
    const response: CustomApiResponse = { name: instance.name, ...extractCustomApi(answer.json, spec), fetchedAt: answer.fetchedAt };
    return NextResponse.json(response, { headers });
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
