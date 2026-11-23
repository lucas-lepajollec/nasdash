/**
 * Public demo: the bookmarks are real sites, and the demo never fetches from
 * the internet, so their own icons ship in `public/demo/sites/<host>.png`
 * (each one the site's published icon). Only these hosts are served.
 */
export const DEMO_SITE_ICON_HOSTS: ReadonlySet<string> = new Set([
  'en.wikipedia.org', 'archive.org', 'www.openstreetmap.org',
  'www.debian.org', 'kde.org', 'f-droid.org', 'www.mozilla.org', 'www.eff.org',
]);

/** The bundled icon of a demo bookmark's site, or null. */
export function demoSiteIcon(url: string | null): string | null {
  try {
    const host = new URL(url ?? '').hostname;
    return DEMO_SITE_ICON_HOSTS.has(host) ? `/demo/sites/${host}.png` : null;
  } catch { return null; }
}
