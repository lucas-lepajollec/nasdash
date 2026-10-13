import { demoFetch } from '@/lib/demoTransport';
export type DockerFailureCategory =
  | 'unavailable'
  | 'configuration'
  | 'permission'
  | 'remote';

export type DockerFailureCode =
  | 'host_unreachable'
  | 'timeout'
  | 'name_resolution'
  | 'invalid_url'
  | 'tls_error'
  | 'access_denied'
  | 'endpoint_not_found'
  | 'api_error'
  | 'invalid_response'
  | 'invalid_socket'
  | 'socket_missing';

export interface DockerFailurePayload {
  error: string;
  code: DockerFailureCode;
  category: DockerFailureCategory;
  hint: string;
  retryable: boolean;
  isOffline: boolean;
}

export class DockerRequestError extends Error {
  readonly status: number;
  readonly code: DockerFailureCode;
  readonly category: DockerFailureCategory;
  readonly hint: string;
  readonly retryable: boolean;
  readonly isOffline: boolean;

  constructor(status: number, payload: DockerFailurePayload) {
    super(payload.error);
    this.name = 'DockerRequestError';
    this.status = status;
    this.code = payload.code;
    this.category = payload.category;
    this.hint = payload.hint;
    this.retryable = payload.retryable;
    this.isOffline = payload.isOffline;
  }
}

export async function readDockerResponse(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const structured = payload && typeof payload === 'object' && typeof payload.code === 'string' && typeof payload.hint === 'string';
    throw new DockerRequestError(response.status, structured ? payload : {
      error: payload?.error || 'Docker request failed.',
      code: response.status === 401 || response.status === 403 ? 'access_denied' : 'api_error',
      category: response.status === 401 || response.status === 403 ? 'permission' : 'remote',
      hint: 'docker.failure.api_error', retryable: response.status >= 500, isOffline: false,
    });
  }
  if (payload === null || typeof payload !== 'object') throw new DockerRequestError(response.status, {
    error: 'Docker API returned an invalid response.', code: 'invalid_response', category: 'remote',
    hint: 'docker.failure.invalid_response', retryable: false, isOffline: false,
  });
  return payload;
}

export async function dockerJsonFetcher(url: string) {
  const payload = await readDockerResponse(await demoFetch(url));
  // Lists are arrays, detail is an object. A valid JSON web/error page is not an empty list.
  if (/\/(containers|images|volumes)(?:\?|$)/.test(url) && !Array.isArray(payload)) throw new DockerRequestError(200, {
    error: 'Docker API returned an invalid response.', code: 'invalid_response', category: 'remote',
    hint: 'docker.failure.invalid_response', retryable: false, isOffline: false,
  });
  return payload;
}

export function dockerActionError(error: unknown, t: (key: string) => string): string {
  if (error instanceof DockerRequestError) {
    if ((error.status === 401 || error.status === 403) && error.code === 'access_denied') return t('errors.adminSessionRequired');
    if (error.status === 409) return t('docker.failure.resource_in_use');
    if (error.status === 404) return t('docker.failure.resource_not_found');
    const presentation = getDockerErrorPresentation(error);
    return `${t(presentation.title)}: ${t(presentation.hint)}`;
  }
  return t('errors.dockerAction');
}

export function getDockerErrorPresentation(error: unknown) {
  if (!(error instanceof DockerRequestError)) {
    return {
      title: 'État Docker indisponible',
      hint: 'docker.failure.invalid_response',
      tone: 'error' as const,
    };
  }

  if (error.category === 'configuration') {
    return { title: 'Configuration Docker invalide', hint: `docker.failure.${error.code}`, tone: 'error' as const };
  }
  if (error.category === 'permission') {
    return { title: 'Accès Docker refusé', hint: `docker.failure.${error.code}`, tone: 'error' as const };
  }
  if (error.category === 'unavailable') {
    if (error.code === 'name_resolution') {
      return { title: 'Nom d’hôte Docker introuvable', hint: `docker.failure.${error.code}`, tone: 'warning' as const };
    }
    if (error.code === 'timeout') {
      return { title: 'Délai d’attente Docker dépassé', hint: `docker.failure.${error.code}`, tone: 'warning' as const };
    }
    return { title: 'Hôte Docker indisponible', hint: `docker.failure.${error.code}`, tone: 'warning' as const };
  }

  return { title: 'Erreur de l’API Docker', hint: `docker.failure.${error.code}`, tone: 'error' as const };
}
