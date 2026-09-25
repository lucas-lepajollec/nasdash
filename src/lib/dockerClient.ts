import http from 'http';
import https from 'https';
import type { DockerHost } from './types';
import { dockhandCall } from './dockhand';
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
  constructor(readonly code: 'invalid_url') {
    super('Invalid Docker host URL');
    this.name = 'DockerHostConfigurationError';
  }
}

export function validateDockerHostUrl(value: string): void {
  if (value === 'mock' || value.startsWith('mock-')) return;

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
    throw new DockerHostConfigurationError('invalid_url');
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
      ...(request.socketPath ? { socketPath: request.socketPath } : { hostname: target.hostname, port: target.port || undefined }),
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
        if (size > MAX_NODE_RESPONSE_BYTES) { req.destroy(new Error('Docker API response too large')); return; }
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
async function send(url: string, options: RequestInit, timeoutMs: number, headers: Record<string, string> = {}, allowSelfSigned = false): Promise<Response> {
  if (allowSelfSigned && url.startsWith('https:')) return nodeRequest({ url, headers, allowSelfSigned: true }, options, timeoutMs);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, headers: { ...(options.headers as Record<string, string> | undefined), ...headers }, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
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
    return failure(
      'invalid_url',
      'configuration',
      'L’adresse de l’hôte Docker est invalide.',
      'Renseignez une URL complète en http:// ou https:// avec le bon port Docker.',
      false,
    );
  }

  if (error instanceof DockerApiHttpError) {
    if (error.status === 401 || error.status === 403) {
      return failure(
        'access_denied',
        'permission',
        'L’API Docker refuse l’accès.',
        'Vérifiez l’authentification, le proxy et les permissions de l’API Docker.',
        false,
      );
    }
    if (error.status === 404) {
      return failure(
        'endpoint_not_found',
        'configuration',
        'L’endpoint attendu de l’API Docker est introuvable.',
        'Vérifiez l’adresse, le port et que la cible expose bien l’API Docker Engine.',
        false,
      );
    }
    return failure(
      'api_error',
      'remote',
      `L’API Docker répond avec une erreur HTTP ${error.status}.`,
      'Consultez les journaux Docker ou du proxy sur l’hôte distant.',
      error.status >= 500,
    );
  }

  if (error instanceof DockerInvalidResponseError || error instanceof SyntaxError) {
    return failure(
      'invalid_response',
      'remote',
      'La réponse reçue n’est pas une réponse Docker valide.',
      'Vérifiez que l’adresse cible bien l’API Docker et non une page web ou un proxy incorrect.',
      false,
    );
  }

  const candidate = error as { name?: string; message?: string; code?: string; cause?: { code?: string } };
  const code = candidate?.cause?.code || candidate?.code || '';
  const message = candidate?.message || '';

  if (candidate?.name === 'AbortError' || candidate?.name === 'TimeoutError' || /aborted|timeout/i.test(message)) {
    return failure(
      'timeout',
      'unavailable',
      'L’hôte Docker ne répond pas dans le délai prévu.',
      'L’hôte peut être arrêté, surchargé ou temporairement inaccessible. NasDash réessaiera automatiquement.',
      true,
    );
  }

  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) {
    return failure(
      'name_resolution',
      'unavailable',
      'Le nom de l’hôte Docker ne peut pas être résolu pour le moment.',
      'La résolution DNS peut être temporairement indisponible. Si l’état persiste, vérifiez le nom saisi et le DNS accessible depuis NasDash.',
      true,
    );
  }

  if (/CERT_|TLS|SSL/i.test(code) || /certificate|tls|ssl/i.test(message)) {
    return failure(
      'tls_error',
      'configuration',
      'La connexion TLS à l’hôte Docker a échoué.',
      'Vérifiez le certificat, le nom d’hôte et la configuration HTTPS du proxy Docker.',
      false,
    );
  }

  return failure(
    'host_unreachable',
    'unavailable',
    'L’hôte Docker est actuellement inaccessible.',
    'Il peut être arrêté ou le port peut être fermé. Si l’état persiste, vérifiez l’adresse et le port configurés.',
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

  const line = `[Docker:${hostId}] ${failurePayload.error} ${failurePayload.hint}`;
  if (failurePayload.category === 'unavailable') console.warn(`🟠 ${line}`);
  else console.error(`🔴 ${line}`);
  loggedFailures.set(hostId, signature);
}

export function reportDockerSuccess(hostId: string): void {
  if (!loggedFailures.has(hostId)) return;
  loggedFailures.delete(hostId);
  console.info(`🟢 [Docker:${hostId}] Hôte de nouveau accessible.`);
}
