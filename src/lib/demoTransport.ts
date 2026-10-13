import type { DashboardConfig } from './types';
import type { DemoWorkspace } from './demoSession';

const KEY = 'nasdash-demo-workspace-v1';
let workspace: DemoWorkspace | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Called only after the server explicitly identifies itself as the fictional demo. */
export function activateDemoTransport(config: DashboardConfig): boolean {
  if (!config.demoMode) { workspace = null; return false; }
  if (workspace) return true;
  try {
    const saved = sessionStorage.getItem(KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    workspace = parsed?.config?.demoMode === true ? parsed : { config };
  } catch { workspace = { config }; }
  return true;
}

export function demoFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const path = new URL(url, typeof location === 'undefined' ? 'http://localhost' : location.href);
  const supported = /^\/api\/(?:config(?:\/(?:calendar|topology))?|pages|devices\/[^/]+(?:\/history)?|docker\/[^/]+\/(?:containers(?:\/[^/]+(?:\/logs)?)?|images|volumes))$/.test(path.pathname);
  if (!workspace || !supported) return fetch(url, options);
  const run = async () => {
    const response = await fetch('/api/demo/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: options.signal,
      body: JSON.stringify({ path: `${path.pathname}${path.search}`, method: options.method ?? 'GET', ...(typeof options.body === 'string' ? { body: JSON.parse(options.body) } : {}), workspace }) });
    if (!response.ok) return response;
    const data = await response.json();
    workspace = data.workspace;
    try { sessionStorage.setItem(KEY, JSON.stringify(workspace)); } catch { /* In-memory state still survives worker changes. */ }
    return new Response(JSON.stringify(data.result.body), { status: data.result.status, headers: { 'Content-Type': 'application/json' } });
  };
  // Serialize changes and reads within the tab so old responses cannot lose later edits.
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

export async function resetDemoTransport(): Promise<void> {
  await queue.catch(() => undefined);
  workspace = null;
  try { sessionStorage.removeItem(KEY); } catch { /* Restricted browser storage. */ }
}
