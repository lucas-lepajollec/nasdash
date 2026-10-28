import http from 'http';
import https from 'https';

/**
 * Requests made by collectors. Plain `fetch`, except when the device accepts a
 * self-signed certificate: then Node's https client skips the certificate
 * check for that request only (never globally).
 */

export interface HttpAnswer {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
}

export interface HttpOptions {
  method?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  /** Sent as JSON (`Content-Type: application/json`). */
  json?: unknown;
  timeoutMs?: number;
  allowSelfSigned?: boolean;
}

export async function httpRequest(url: string, options: HttpOptions = {}): Promise<HttpAnswer> {
  const timeoutMs = options.timeoutMs ?? 4000;
  const method = options.method ?? 'GET';
  const body = options.json === undefined ? undefined : JSON.stringify(options.json);
  const headers = { 'User-Agent': 'NasDash', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
  const original = new URL(url);
  const deadline = Date.now() + timeoutMs;
  // The certificate exception belongs to this configured host only. Redirects
  // must not export credentials or silently downgrade HTTPS to HTTP.
  async function visit(current: URL, requestMethod: 'GET' | 'POST' | 'PUT', requestBody: string | undefined, requestHeaders: Record<string, string>, redirects: number): Promise<HttpAnswer> {
    if (!['http:', 'https:'].includes(current.protocol)) throw new Error('Unsupported redirect protocol');
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Timeout');
    let answer: { answer: HttpAnswer; location?: string };
    if (!options.allowSelfSigned) {
      const response = await fetch(current.toString(), { method: requestMethod, headers: requestHeaders, body: requestBody, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(remaining) });
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      if (reader) {
        try {
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            bytes += next.value.byteLength;
            if (bytes > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('Monitoring response exceeds 2 MiB'); }
            chunks.push(next.value);
          }
        } finally { reader.releaseLock(); }
      }
      const text = Buffer.concat(chunks).toString('utf8');
      answer = { answer: { ok: response.ok, status: response.status, statusText: response.statusText, text: async () => text }, location: response.headers.get('location') ?? undefined };
    } else answer = await new Promise<{ answer: HttpAnswer; location?: string }>((resolve, reject) => {
      const req = (current.protocol === 'https:' ? https : http).request(current, {
        method: requestMethod,
        headers: requestBody !== undefined ? { ...requestHeaders, 'Content-Length': String(Buffer.byteLength(requestBody)) } : requestHeaders,
        rejectUnauthorized: !options.allowSelfSigned || current.hostname !== original.hostname,
      }, response => {
        const timer = setTimeout(() => req.destroy(new Error('Timeout')), Math.max(1, deadline - Date.now()));
        let text = '';
        let bytes = 0;
        response.setEncoding('utf8');
        response.on('data', chunk => {
          bytes += Buffer.byteLength(chunk);
          if (bytes > 2 * 1024 * 1024) { req.destroy(new Error('Monitoring response exceeds 2 MiB')); return; }
          text += chunk;
        });
        response.on('error', error => { clearTimeout(timer); reject(error); });
        response.on('end', () => {
          clearTimeout(timer);
          const status = response.statusCode ?? 500;
          resolve({ answer: { ok: status >= 200 && status < 300, status, statusText: response.statusMessage ?? '', text: async () => text }, location: response.headers.location });
        });
      });
      const timer = setTimeout(() => req.destroy(new Error('Timeout')), remaining);
      req.on('close', () => clearTimeout(timer));
      req.on('error', reject);
      req.end(requestBody);
    });
    if (![301, 302, 303, 307, 308].includes(answer.answer.status) || !answer.location) return answer.answer;
    if (redirects >= 5) throw new Error('Too many redirects');
    const next = new URL(answer.location, current);
    if (current.protocol === 'https:' && next.protocol === 'http:') throw new Error('HTTPS redirect downgrade rejected');
    const nextHeaders = { ...requestHeaders };
    const toGet = answer.answer.status === 303 || requestMethod === 'POST' && [301, 302].includes(answer.answer.status);
    if (next.origin !== current.origin) {
      if (requestBody !== undefined && !toGet) throw new Error('Cross-origin request-body redirect rejected');
      for (const key of Object.keys(nextHeaders)) if (/^(authorization|cookie|proxy-authorization)$/i.test(key)) delete nextHeaders[key];
    }
    if (toGet) for (const key of Object.keys(nextHeaders)) if (/^content-(type|length)$/i.test(key)) delete nextHeaders[key];
    return visit(next, toGet ? 'GET' : requestMethod, toGet ? undefined : requestBody, nextHeaders, redirects + 1);
  }
  return visit(original, method, body, headers, 0);
}

export const httpGet = (url: string, options: Omit<HttpOptions, 'method' | 'json'> = {}) => httpRequest(url, options);

/** `Basic` header from a stored `user:password` token (none when empty). */
export function basicAuthHeader(token: string | undefined): Record<string, string> {
  if (!token || token.trim() === '' || token === ':') return {};
  return { Authorization: `Basic ${Buffer.from(token).toString('base64')}` };
}

const CERTIFICATE_ERRORS = new Set(['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID']);

/** True when the failure is an untrusted HTTPS certificate (whatever wraps it). */
export function isCertificateError(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 4) return false;
  const { code, cause, reason } = error as { code?: unknown; cause?: unknown; reason?: unknown };
  return (typeof code === 'string' && CERTIFICATE_ERRORS.has(code)) || isCertificateError(cause, depth + 1) || isCertificateError(reason, depth + 1);
}
