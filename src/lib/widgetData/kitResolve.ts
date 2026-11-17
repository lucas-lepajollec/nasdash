/** The widget, its connection and its kit server for a kit route (server only). */
import { NextResponse } from 'next/server';
import { kitFamilyOfWidget } from '@/integrations/kit';
import { kitServer } from '@/integrations/kitServer';
import { resolveWidgetSettings } from './resolve';
import { demoVisitorInstance, getServiceInstance, ServiceError } from './services';

const headers = { 'Cache-Control': 'private, no-store' };

export function resolveKitWidget(request: Request, widget: unknown, widgetId: unknown, draft: unknown) {
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
