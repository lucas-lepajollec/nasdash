import type { Category } from '@/lib/types';

/** Counts shown by the overview widget (Classic and Calme). */
export function quickStats(categories: Category[]) {
  const ports = new Set<string>();
  let links = 0;
  for (const category of categories) {
    for (const service of category.services) {
      for (const url of [service.localUrl, service.tailscaleUrl]) {
        if (!url) continue;
        links++;
        try { const port = new URL(url).port; if (port) ports.add(port); } catch { /* not a full address */ }
      }
    }
  }
  return {
    services: categories.reduce((total, category) => total + category.services.length, 0),
    categories: categories.length,
    links,
    ports: ports.size,
  };
}
