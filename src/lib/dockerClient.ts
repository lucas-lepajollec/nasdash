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

function dockerApiUrl(hostUrl: string, endpoint: string): string {
  validateDockerHostUrl(hostUrl);
  return `${hostUrl.replace(/\/$/, '')}${endpoint}`;
}

export async function fetchDockerApi(
  hostUrl: string,
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 5_000,
  acceptedStatuses: number[] = [],
): Promise<Response> {
  const url = dockerApiUrl(hostUrl, endpoint);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok && !acceptedStatuses.includes(response.status)) {
      throw new DockerApiHttpError(response.status);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
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
