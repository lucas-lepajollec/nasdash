import { httpRequest, isCertificateError } from '@/integrations/http';

/**
 * Reachability check of one configured service URL (server side). A service
 * answering 2xx/3xx, or 401/403 (up but asking for a login), is online.
 *
 * HTTPS with a self-signed or otherwise untrusted certificate (Proxmox, a NAS
 * UI…) is retried without the certificate check: the ping sends no
 * credentials and reads nothing but the status, so it only proves the service
 * answers. The result says so (`selfSigned`).
 */

export interface PingResult {
  status: 'online' | 'offline';
  statusText: string;
  latency: number;
  /** Online, but its certificate is not trusted by the server. */
  selfSigned?: boolean;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Connection: 'close',
};

const isUp = (status: number) => status < 400 || status === 401 || status === 403;

/** Network error code, however deeply fetch wraps it (`cause`, `errors[]`). */
function errorCode(error: unknown, depth = 0): string | undefined {
  if (!error || typeof error !== 'object' || depth > 4) return undefined;
  const { code, cause, errors } = error as { code?: unknown; cause?: unknown; errors?: unknown[] };
  if (typeof code === 'string') return code;
  return errorCode(cause, depth + 1) ?? (Array.isArray(errors) ? errors.map(item => errorCode(item, depth + 1)).find(Boolean) : undefined);
}

function failureText(error: unknown): string {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'AbortError' || name === 'TimeoutError' || (error instanceof Error && error.message === 'Timeout')) return 'Timeout';
  return errorCode(error) === 'ECONNREFUSED' ? 'Refusé' : 'Offline';
}

/** Where an HTTP address redirects to (without following it), when it does. */
async function redirectTarget(url: string, timeoutMs: number): Promise<string | undefined> {
  try {
    const answer = await fetch(url, { method: 'GET', headers: HEADERS, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    const location = answer.headers.get('location');
    return answer.status >= 300 && answer.status < 400 && location ? new URL(location, url).toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function pingUrl(url: string, timeoutMs = 4000): Promise<PingResult> {
  const start = Date.now();
  try {
    // GET rather than HEAD: some small self-hosted servers reject HEAD.
    const answer = await httpRequest(url, { headers: HEADERS, timeoutMs });
    const latency = Date.now() - start;
    return isUp(answer.status) ? { status: 'online', statusText: 'OK', latency } : { status: 'offline', statusText: `Error ${answer.status}`, latency };
  } catch (error) {
    if (!isCertificateError(error)) return { status: 'offline', statusText: failureText(error), latency: 0 };
  }
  // The certificate was refused: on the address itself (https://…), or on the
  // HTTPS address an http:// one redirects to (Proxmox, NAS interfaces…).
  const secureUrl = url.startsWith('https:') ? url : await redirectTarget(url, timeoutMs);
  if (!secureUrl?.startsWith('https:')) return { status: 'offline', statusText: 'Offline', latency: 0 };
  const retry = Date.now();
  try {
    const answer = await httpRequest(secureUrl, { headers: HEADERS, timeoutMs, allowSelfSigned: true });
    const latency = Date.now() - retry;
    return isUp(answer.status)
      ? { status: 'online', statusText: 'OK', latency, selfSigned: true }
      : { status: 'offline', statusText: `Error ${answer.status}`, latency };
  } catch (error) {
    return { status: 'offline', statusText: failureText(error), latency: 0 };
  }
}
