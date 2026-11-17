/**
 * The dashboard's first requests, started by an inline script of the page's
 * HTML (see `BOOT_SCRIPT`) while the JavaScript is still loading: by the time
 * React asks for them, they are often already there.
 */
const MAX_AGE_MS = 10_000;

type Boot = { at: number; requests: Record<string, Promise<Response>> };

/** The early request for this path, once (a response body is read only once), if it is still fresh. */
export function takeBoot(path: string): Promise<Response> | undefined {
  if (typeof window === 'undefined') return undefined;
  const boot = (window as Window & { __ndBoot?: Boot }).__ndBoot;
  const request = boot?.requests[path];
  if (!boot || !request) return undefined;
  delete boot.requests[path];
  return Date.now() - boot.at < MAX_AGE_MS ? request : undefined;
}

/** Runs in the HTML, before React: only on the dashboard, only GET requests the dashboard makes anyway. */
export const BOOT_SCRIPT = `
  (function() {
    try {
      if (location.pathname !== '/' || typeof fetch !== 'function') return;
      var requests = {};
      var start = function(path, options) { var request = fetch(path, options); request.catch(function() {}); requests[path] = request; };
      start('/api/auth/me', { cache: 'no-store' });
      start('/api/config');
      start('/api/pages');
      window.__ndBoot = { at: Date.now(), requests: requests };
    } catch (e) {}
  })();
`;
