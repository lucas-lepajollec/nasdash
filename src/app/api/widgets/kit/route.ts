import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { isDemoMode } from '@/lib/demoMode';
import { kitFamilyOfWidget } from '@/integrations/kit';
import { kitServer } from '@/integrations/kitServer';
import { TtlCache } from '@/lib/widgetData/cache';
import type { KitSummaryBase } from '@/lib/widgetData/contracts';
import { resolveWidgetSettings } from '@/lib/widgetData/resolve';
import { boundedJson, demoVisitorInstance, getServiceInstance, queryDraft, serviceFailure, serviceIdentity, ServiceError } from '@/lib/widgetData/services';

/**
 * The integration kit's data route: one route for every kit widget
 * (`src/integrations/kit.ts`). GET answers the summary of the widget's
 * connection, shared for the integration's `ttlMs` by every widget reading the
 * same connection; POST runs one of its actions (administrators). Like the
 * other widget routes, the widget must be one the requester can see, and an
 * admin may preview unsaved settings.
 */
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const summaries = new TtlCache<KitSummaryBase>(60_000, 300, 10 * 60_000);

function resolve(request: Request, widget: unknown, widgetId: unknown, draft: unknown) {
  const family = typeof widget === 'string' ? kitFamilyOfWidget(widget) : undefined;
  if (!family) throw new ServiceError('widgets.error.invalidWidget', 400);
  const lookup = resolveWidgetSettings(request, widgetId, family.widget, draft);
  if (!lookup.ok) return { response: NextResponse.json({ error: lookup.error }, { status: lookup.status, headers }) };
  const chosen = lookup.settings.integrationId;
  if (chosen != null && (typeof chosen !== 'string' || !chosen)) throw new ServiceError('widgets.error.invalidSettings', 400);
  const instance = getServiceInstance(chosen, family.types) ?? demoVisitorInstance(chosen, family.types);
  if (!instance) return { response: NextResponse.json({ error: 'widgets.error.notFound' }, { status: 404, headers }) };
  const server = kitServer(instance.type);
  if (!server) throw new ServiceError('widgets.error.notFound', 404);
  return { instance, server, principal: lookup.principal };
}

const failure = (error: unknown) => { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; };
const key = (instance: Parameters<typeof serviceIdentity>[0], server: NonNullable<ReturnType<typeof kitServer>>) => `${serviceIdentity(instance)}:${server.revision?.(instance) ?? 0}`;
const read = async (instance: Parameters<typeof serviceIdentity>[0], server: NonNullable<ReturnType<typeof kitServer>>) => {
  const summary = await summaries.get(key(instance, server), () => server.collect(instance), Date.now(), server.ttlMs);
  return server.decorate ? server.decorate(instance, summary) : summary;
};
/** What an action is about (a container id…): a short plain identifier, or nothing. */
const TARGET = /^[A-Za-z0-9_.:-]{1,128}$/;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const resolved = resolve(request, url.searchParams.get('widget'), url.searchParams.get('widgetId'), queryDraft(url));
    if (resolved.response) return resolved.response;
    const { instance, server, principal } = resolved;
    const summary = isDemoMode() ? (server.decorate ? server.decorate(instance, server.demo(instance)) : server.demo(instance)) : await read(instance, server);
    const canControl = !!server.actions && (principal.role === 'admin' || isDemoMode());
    return NextResponse.json({ ...summary, canControl }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  const denied = checkAdmin(request);
  if (denied) return NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 403, headers });
  try {
    const body = await boundedJson(request);
    const resolved = resolve(request, body.widget, body.widgetId, body.draft);
    if (resolved.response) return resolved.response;
    const { instance, server } = resolved;
    const action = typeof body.action === 'string' && server.actions && Object.prototype.hasOwnProperty.call(server.actions, body.action) ? server.actions[body.action] : undefined;
    if (!action) throw new ServiceError('widgets.error.invalidRequest', 400);
    if (body.target !== undefined && (typeof body.target !== 'string' || !TARGET.test(body.target))) throw new ServiceError('widgets.error.invalidRequest', 400);
    const target = body.target as string | undefined;
    if (isDemoMode()) {
      action.demo?.(instance, target);
      const demo = server.demo(instance);
      return NextResponse.json({ ...(server.decorate ? server.decorate(instance, demo) : demo), canControl: true }, { headers });
    }
    try { await action.run(instance, target); }
    finally { summaries.delete(key(instance, server)); }
    return NextResponse.json({ ...await read(instance, server), canControl: true }, { headers });
  } catch (error) { return failure(error); }
}
