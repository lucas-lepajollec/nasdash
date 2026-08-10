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
  | 'invalid_response';

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

export async function dockerJsonFetcher(url: string) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const failure = payload && typeof payload === 'object'
      && typeof payload.error === 'string'
      && typeof payload.code === 'string'
      && typeof payload.category === 'string'
      && typeof payload.hint === 'string'
      ? payload as DockerFailurePayload
      : {
          error: 'Impossible de contacter le service Docker.',
          code: 'api_error' as const,
          category: 'remote' as const,
          hint: 'Consultez les journaux du serveur pour plus de détails.',
          retryable: true,
          isOffline: false,
        };

    throw new DockerRequestError(response.status, failure);
  }

  return payload;
}

export function getDockerErrorPresentation(error: unknown) {
  if (!(error instanceof DockerRequestError)) {
    return {
      title: 'État Docker indisponible',
      hint: 'La réponse du serveur n’a pas pu être interprétée.',
      tone: 'error' as const,
    };
  }

  if (error.category === 'configuration') {
    return { title: 'Configuration Docker invalide', hint: error.hint, tone: 'error' as const };
  }
  if (error.category === 'permission') {
    return { title: 'Accès Docker refusé', hint: error.hint, tone: 'error' as const };
  }
  if (error.category === 'unavailable') {
    if (error.code === 'name_resolution') {
      return { title: 'Nom d’hôte Docker introuvable', hint: error.hint, tone: 'warning' as const };
    }
    if (error.code === 'timeout') {
      return { title: 'Délai d’attente Docker dépassé', hint: error.hint, tone: 'warning' as const };
    }
    return { title: 'Hôte Docker indisponible', hint: error.hint, tone: 'warning' as const };
  }

  return { title: 'Erreur de l’API Docker', hint: error.hint, tone: 'error' as const };
}
