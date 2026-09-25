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
  method?: 'GET' | 'POST';
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
  const headers = { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
  if (!(options.allowSelfSigned && url.startsWith('https:'))) {
    return fetch(url, { method, headers, body, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  }
  return new Promise((resolve, reject) => {
    const req = (url.startsWith('https:') ? https : http).request(url, {
      method,
      headers: body !== undefined ? { ...headers, 'Content-Length': String(Buffer.byteLength(body)) } : headers,
      timeout: timeoutMs,
      rejectUnauthorized: false,
    }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => {
        const status = response.statusCode ?? 500;
        resolve({ ok: status >= 200 && status < 300, status, statusText: response.statusMessage ?? '', text: async () => text });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end(body);
  });
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
