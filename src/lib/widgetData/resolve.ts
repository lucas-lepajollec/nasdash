import type { NextRequest } from 'next/server';
import { readConfig } from '@/lib/config';
import { resolveAccessPrincipal, type AccessPrincipal } from '@/lib/access';
import { pagesForViewer, readPagesDocument } from '@/lib/pages/store';
import type { WidgetSettings } from '@/lib/pages/types';
import { sanitizeSettings } from '@/lib/pages/validation';

/**
 * The settings a content widget's data route works from. The widget is looked
 * up in the saved pages *as the requester may see them*: a visitor can only
 * make the server fetch what an admin saved in a widget visible to them. An
 * admin may preview unsaved settings (`draft`), sanitized like saved ones.
 */
export type WidgetLookup =
  | { ok: true; settings: WidgetSettings; principal: AccessPrincipal; draft: boolean }
  | { ok: false; status: 400 | 401 | 404; error: string };

const ID = /^[A-Za-z0-9_-]{1,128}$/;

export function resolveWidgetSettings(request: NextRequest | Request, widgetId: unknown, type: string, draft?: unknown): WidgetLookup {
  if (typeof widgetId !== 'string' || !ID.test(widgetId)) return { ok: false, status: 400, error: 'widgets.error.invalidWidget' };
  const config = readConfig();
  const principal = resolveAccessPrincipal(request as NextRequest, config.settings?.securityMode || 'public');
  if (!principal) return { ok: false, status: 401, error: 'widgets.error.unauthorized' };
  if (principal.role === 'admin' && draft && typeof draft === 'object' && !Array.isArray(draft)) {
    try {
      return { ok: true, settings: sanitizeSettings(draft, 'draft'), principal, draft: true };
    } catch {
      return { ok: false, status: 400, error: 'widgets.error.invalidSettings' };
    }
  }
  const widget = pagesForViewer(readPagesDocument(), principal)
    .flatMap(page => page.widgets)
    .find(candidate => candidate.id === widgetId && candidate.type === type);
  if (!widget) return { ok: false, status: 404, error: 'widgets.error.notFound' };
  return { ok: true, settings: widget.settings ?? {}, principal, draft: false };
}
