import http from 'http';
import https from 'https';
import type { DockerHost } from './types';
import { dockhandCall } from './dockhand';
import { dockerFailureLogText } from './dockerLog';
import type {
  DockerFailureCode,
  DockerFailurePayload,
} from './dockerErrorContract';

export class DockerApiHttpError extends Error {
  constructor(readonly status: number) {
    super(`Docker API HTTP ${status}`);
    this.name = 'DockerApiHttpError';
  }
}

export class DockerInvalidResponseError extends Error {
  constructor() {
    super('Docker API returned an invalid response');
    this.name = 'DockerInvalidResponseError';
  }
}

export class DockerHostConfigurationError extends Error {
  constructor(readonly code: 'invalid_url' | 'invalid_socket') {
    super('Invalid Docker host URL');
    this.name = 'DockerHostConfigurationError';
  }
}

export function validateDockerHostUrl(value: string): void {

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new DockerHostConfigurationError('invalid_url');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new DockerHostConfigurationError('invalid_url');
  }
}

/** Socket paths accepted for `socket` hosts: absolute, ending in `.sock`, no `..`. */
export function validateDockerSocketPath(value: string): void {
  if (!/^\/[A-Za-z0-9._\/-]+\.sock$/.test(value) || value.includes('..')) {
    throw new DockerHostConfigurationError('invalid_socket');
  }
}

/** Where and how to reach one engine (a stored `DockerHost`, or a bare URL). */
export type DockerTarget = string | Pick<DockerHost, 'type' | 'url' | 'socketPath' | 'allowSelfSigned' | 'target' | 'token'>;

/** Upper bound for answers read through the socket/self-signed transport. */
const MAX_NODE_RESPONSE_BYTES = 32 * 1024 * 1024;

/**
 * Transport for what `fetch` cannot do: a Unix socket, or HTTPS with a
 * self-signed certificate. Returns a standard `Response` so every route reads
 * it the same way.
 */
function nodeRequest(request: { url: string; socketPath?: string; allowSelfSigned?: boolean; headers?: Record<string, string> }, options: RequestInit, timeoutMs: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const target = new URL(request.url);
    const client = !request.socketPath && target.protocol === 'https:' ? https : http;
    const req = client.request({
      ...(request.socketPath ? { socketPath: request.socketPath } : { hostname: target.hostname.replace(/^\[|\]$/g, ''), port: target.port || undefined }),
      path: `${target.pathname}${target.search}`,
      method: options.method ?? 'GET',
      headers: { Host: request.socketPath ? 'docker' : target.host, ...request.headers },
      timeout: timeoutMs,
      ...(!request.socketPath && target.protocol === 'https:' ? { rejectUnauthorized: !request.allowSelfSigned } : {}),
    }, res => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_NODE_RESPONSE_BYTES) { req.destroy(new DockerInvalidResponseError()); return; }
        chunks.push(chunk);
      });
      res.on('end', () => {
        const status = res.statusCode ?? 500;
        const headers = new Headers();
        for (const [key, value] of Object.entries(res.headers)) if (typeof value === 'string') headers.set(key, value);
        // 204/304 carry no body in the Fetch API.
        resolve(new Response(status === 204 || status === 304 ? null : Buffer.concat(chunks), { status, headers }));
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new DOMException('Docker API timeout', 'AbortError')); });
    req.end();
  });
}

/** One HTTP(S) call: `fetch`, or Node's client when a self-signed certificate is accepted. */
async function send(url: string, options: RequestInit, timeoutMs: number, headers: Record<string, string> = {}, allowSelfSigned = false, redirects = 0): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = allowSelfSigned
      ? await nodeRequest({ url, headers: { ...(options.headers as Record<string, string> | undefined), ...headers }, allowSelfSigned: true }, options, timeoutMs)
      : await fetch(url, { ...options, headers: { ...(options.headers as Record<string, string> | undefined), ...headers }, signal: controller.signal, redirect: 'manual' });
    const location = response.headers.get('location');
    if ([301, 302, 303, 307, 308].includes(response.status) && location) {
      if (redirects >= 4) throw new DockerHostConfigurationError('invalid_url');
      const previous = new URL(url), next = new URL(location, previous);
      // Keep credentials and the self-signed opt-in bound to the configured host.
      if (!['http:', 'https:'].includes(next.protocol) || next.hostname !== previous.hostname || previous.protocol === 'https:' && next.protocol !== 'https:') throw new DockerHostConfigurationError('invalid_url');
      return await send(next.href, options, timeoutMs, headers, allowSelfSigned, redirects + 1);
    }
    return response;
  } finally { clearTimeout(timeout); }
}

/** Dockhand: the Docker endpoint is translated, then its answer shaped like Docker's. */
async function viaDockhand(host: Exclude<DockerTarget, string>, endpoint: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const call = dockhandCall(endpoint, options.method ?? 'GET', host.target ?? '');
  if (!call) return new Response(JSON.stringify({ message: 'Not supported by Dockhand' }), { status: 501 });
  const response = await send(`${host.url.replace(/\/$/, '')}${call.path}`, { method: call.method }, timeoutMs, { Authorization: `Bearer ${host.token ?? ''}`, Accept: 'application/json' }, host.allowSelfSigned);
  if (!response.ok) return response;
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { throw new DockerInvalidResponseError(); }
  const converted = call.convert(body);
  const status = converted.status ?? 200;
  if (status === 204) return new Response(null, { status });
  return converted.text !== undefined
    ? new Response(converted.text, { status, headers: { 'content-type': 'text/plain' } })
    : new Response(JSON.stringify(converted.json ?? null), { status, headers: { 'content-type': 'application/json' } });
}

export async function fetchDockerApi(
  target: DockerTarget,
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 5_000,
  acceptedStatuses: number[] = [],
): Promise<Response> {
  const host = typeof target === 'string' ? { type: 'tcp' as const, url: target } : target;
  let response: Response;
  if (host.type === 'socket') {
    validateDockerSocketPath(host.socketPath ?? '');
    response = await nodeRequest({ url: `http://docker${endpoint}`, socketPath: host.socketPath }, options, timeoutMs);
  } else if (host.type === 'portainer') {
    // Portainer relays the Docker Engine API of one environment.
    validateDockerHostUrl(host.url);
    const base = `${host.url.replace(/\/$/, '')}/api/endpoints/${encodeURIComponent(host.target ?? '')}/docker`;
    response = await send(`${base}${endpoint}`, options, timeoutMs, { 'X-API-Key': host.token ?? '' }, host.allowSelfSigned);
  } else if (host.type === 'dockhand') {
    validateDockerHostUrl(host.url);
    response = await viaDockhand(host, endpoint, options, timeoutMs);
  } else {
    validateDockerHostUrl(host.url);
    response = await send(`${host.url.replace(/\/$/, '')}${endpoint}`, options, timeoutMs, {}, host.allowSelfSigned);
  }
  if (!response.ok && !acceptedStatuses.includes(response.status)) {
    throw new DockerApiHttpError(response.status);
  }
  return response;
}

export async function readDockerJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new DockerInvalidResponseError();
  }
}

/** Reject malformed upstream payloads before normalisation, including valid JSON web pages. */
export function requireDockerArray<T>(value: unknown, identity: string): T[] {
  if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || typeof item[identity] !== 'string' || !item[identity])) throw new DockerInvalidResponseError();
  return value as T[];
}
export function requireDockerObject<T>(value: unknown, identity: string): T {
  if (!value || typeof value !== 'object' || typeof (value as Record<string, unknown>)[identity] !== 'string') throw new DockerInvalidResponseError();
  return value as T;
}
export function requireDockerFields(value: Record<string, unknown>, arrays: string[], objects: string[] = []): void {
  for (const key of arrays) if (value[key] != null && !Array.isArray(value[key])) throw new DockerInvalidResponseError();
  for (const key of objects) if (value[key] != null && (typeof value[key] !== 'object' || Array.isArray(value[key]))) throw new DockerInvalidResponseError();
}
export const canonicalDockerImageId = (id: string): string => id.replace(/^sha256:/, '');

function failure(
  code: DockerFailureCode,
  category: DockerFailurePayload['category'],
  error: string,
  hint: string,
  retryable: boolean,
): DockerFailurePayload {
  return { error, code, category, hint, retryable, isOffline: category === 'unavailable' };
}

export function classifyDockerError(error: unknown): DockerFailurePayload {
  if (error instanceof DockerHostConfigurationError) {
    return failure(error.code, 'configuration', error.code === 'invalid_socket' ? 'Invalid Docker socket path.' : 'Invalid Docker host address.', `docker.failure.${error.code}`, false);
  }

  if (error instanceof DockerApiHttpError) {
    if (error.status === 401 || error.status === 403) {
      return failure(
        'access_denied',
        'permission',
        'Docker API access denied.',
        'docker.failure.access_denied',
        false,
      );
    }
    if (error.status === 404) {
      return failure(
        'endpoint_not_found',
        'configuration',
        'Docker API endpoint not found.',
        'docker.failure.endpoint_not_found',
        false,
      );
    }
    return failure(
      'api_error',
      'remote',
      `Docker API returned HTTP ${error.status}.`,
      'docker.failure.api_error',
      error.status >= 500,
    );
  }

  if (error instanceof DockerInvalidResponseError || error instanceof SyntaxError) {
    return failure(
      'invalid_response',
      'remote',
      'Docker API returned an invalid response.',
      'docker.failure.invalid_response',
      false,
    );
  }

  const candidate = error as { name?: string; message?: string; code?: string; cause?: { code?: string } };
  const code = candidate?.cause?.code || candidate?.code || '';
  const message = candidate?.message || '';

  if (['EACCES', 'EPERM'].includes(code)) return failure('access_denied', 'permission', 'Docker socket access denied.', 'docker.failure.access_denied', false);
  if (code === 'ENOENT') return failure('socket_missing', 'configuration', 'Docker socket not found.', 'docker.failure.socket_missing', false);

  if (candidate?.name === 'AbortError' || candidate?.name === 'TimeoutError' || /aborted|timeout/i.test(message)) {
    return failure(
      'timeout',
      'unavailable',
      'Docker host did not respond before the timeout.',
      'docker.failure.timeout',
      true,
    );
  }

  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) {
    return failure(
      'name_resolution',
      'unavailable',
      'Docker hostname cannot currently be resolved.',
      'docker.failure.name_resolution',
      true,
    );
  }

  if (/CERT_|TLS|SSL/i.test(code) || /certificate|tls|ssl/i.test(message)) {
    return failure(
      'tls_error',
      'configuration',
      'Docker host TLS connection failed.',
      'docker.failure.tls_error',
      false,
    );
  }

  return failure(
    'host_unreachable',
    'unavailable',
    'Docker host is currently unreachable.',
    'docker.failure.host_unreachable',
    true,
  );
}

export function dockerFailureStatus(failurePayload: DockerFailurePayload): number {
  if (failurePayload.category === 'configuration') return 422;
  if (failurePayload.category === 'unavailable') return 503;
  return 502;
}

const globalDockerState = globalThis as typeof globalThis & {
  __nasdashDockerFailures?: Map<string, string>;
};
const loggedFailures = globalDockerState.__nasdashDockerFailures
  ?? (globalDockerState.__nasdashDockerFailures = new Map<string, string>());

export function reportDockerFailure(hostId: string, failurePayload: DockerFailurePayload): void {
  const signature = `${failurePayload.code}:${failurePayload.error}`;
  if (loggedFailures.get(hostId) === signature) return;

  const line = `[Docker:${hostId}] ${dockerFailureLogText(failurePayload)}`;
  if (failurePayload.category === 'unavailable') console.warn(`🟠 ${line}`);
  else console.error(`🔴 ${line}`);
  loggedFailures.set(hostId, signature);
}

export function reportDockerSuccess(hostId: string): void {
  if (!loggedFailures.has(hostId)) return;
  loggedFailures.delete(hostId);
  console.info(`🟢 [Docker:${hostId}] Host is reachable again.`);
}
