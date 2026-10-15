import type { DashboardConfig } from '@/lib/types';
import type { WidgetSettings } from '@/lib/pages/types';

/**
 * Content sources are saved once, in Settings → Widgets (`config.settings`),
 * and each widget only lists the ids it shows (`feedIds`, `symbolIds`; none
 * means all). The server reads the addresses from the config, never from a
 * request: a widget can only make it fetch what an admin saved there.
 */
function chosen<T extends { id: string }>(items: T[] | undefined, ids: unknown): T[] {
  const list = items ?? [];
  if (!Array.isArray(ids)) return list;
  return ids.flatMap(id => list.filter(item => item.id === id));
}

export function widgetFeeds(settings: WidgetSettings, config: DashboardConfig): { url: string; title?: string }[] {
  return chosen(config.settings?.rssFeeds, settings.feedIds).map(({ url, title }) => ({ url, ...(title ? { title } : {}) }));
}

export function widgetSymbols(settings: WidgetSettings, config: DashboardConfig): string[] {
  return chosen(config.settings?.marketSymbols, settings.symbolIds).map(item => item.symbol);
}
