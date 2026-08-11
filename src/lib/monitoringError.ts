export type MonitoringFailureCategory = 'unavailable' | 'configuration' | 'permission' | 'remote';
export type MonitoringFailureSeverity = 'warning' | 'error';

export interface MonitoringFailure {
  category: MonitoringFailureCategory;
  severity: MonitoringFailureSeverity;
  code: string;
  message: string;
  hint: string;
  retryable: boolean;
}

export class MonitoringHttpError extends Error {
  constructor(
    public readonly service: string,
    public readonly status: number,
    statusText = '',
  ) {
    super(`${service} HTTP ${status}${statusText ? ` ${statusText}` : ''}`);
    this.name = 'MonitoringHttpError';
  }
}

export class MonitoringConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MonitoringConfigurationError';
  }
}

export class MonitoringInvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MonitoringInvalidResponseError';
  }
}

function failure(
  category: MonitoringFailureCategory,
  severity: MonitoringFailureSeverity,
  code: string,
  message: string,
  hint: string,
  retryable: boolean,
): MonitoringFailure {
  return { category, severity, code, message, hint, retryable };
}

function errorDetails(error: unknown) {
  const candidate = error as {
    name?: string;
    message?: string;
    code?: string;
    cause?: { code?: string; message?: string };
  };

  return {
    name: candidate?.name || '',
    message: candidate?.message || String(error),
    code: candidate?.cause?.code || candidate?.code || '',
  };
}

export function classifyMonitoringError(error: unknown): MonitoringFailure {
  if (error instanceof MonitoringConfigurationError) {
    return failure(
      'configuration',
      'error',
      'invalid_configuration',
      error.message,
      'Vérifiez les champs URL, port, identifiant et jeton configurés pour cet appareil.',
      false,
    );
  }

  if (error instanceof MonitoringInvalidResponseError || error instanceof SyntaxError) {
    return failure(
      'remote',
      'error',
      'invalid_response',
      error.message || 'La réponse reçue est invalide.',
      'Vérifiez que l’URL cible bien l’API attendue et non une page HTML ou un autre service.',
      false,
    );
  }

  if (error instanceof MonitoringHttpError) {
    if (error.status === 401 || error.status === 403) {
      return failure(
        'permission',
        'error',
        'access_denied',
        `${error.service} refuse l’accès (HTTP ${error.status}).`,
        'Vérifiez le jeton, l’utilisateur et les permissions accordées par le service distant.',
        false,
      );
    }

    if (error.status === 404) {
      return failure(
        'configuration',
        'error',
        'endpoint_not_found',
        `L’endpoint ${error.service} configuré est introuvable (HTTP 404).`,
        'Vérifiez l’URL, la version de l’API et le type d’appareil sélectionné.',
        false,
      );
    }

    if ([408, 425, 429].includes(error.status)) {
      return failure(
        'unavailable',
        'warning',
        'temporarily_rejected',
        `${error.service} est temporairement indisponible (HTTP ${error.status}).`,
        'Le service est joignable mais demande de réessayer plus tard. NasDash continuera automatiquement.',
        true,
      );
    }

    return failure(
      'remote',
      'error',
      'remote_http_error',
      `${error.service} répond avec une erreur HTTP ${error.status}.`,
      'Consultez les journaux du service distant ; la connexion fonctionne mais son API signale une erreur.',
      error.status >= 500,
    );
  }

  const { name, message, code } = errorDetails(error);

  if (name === 'AbortError' || name === 'TimeoutError' || /aborted|timed?\s*out|timeout/i.test(message)) {
    return failure(
      'unavailable',
      'warning',
      'timeout',
      'L’appareil ne répond pas dans le délai prévu.',
      'Il peut être arrêté, surchargé ou temporairement inaccessible. NasDash réessaiera automatiquement.',
      true,
    );
  }

  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) {
    return failure(
      'unavailable',
      'warning',
      'name_resolution',
      'Le nom de l’appareil ne peut pas être résolu pour le moment.',
      'Si l’état persiste, vérifiez le nom d’hôte et le DNS accessibles depuis le conteneur NasDash.',
      true,
    );
  }

  if (/CERT_|TLS|SSL/i.test(code) || /certificate|tls|ssl/i.test(message)) {
    return failure(
      'configuration',
      'error',
      'tls_error',
      'La connexion TLS avec l’appareil a échoué.',
      'Vérifiez le certificat, le nom d’hôte et la configuration HTTPS du service distant.',
      false,
    );
  }

  if (/invalid url|failed to parse url/i.test(message)) {
    return failure(
      'configuration',
      'error',
      'invalid_url',
      'L’URL de supervision configurée est invalide.',
      'Renseignez une URL complète avec le protocole, l’adresse et le port attendus.',
      false,
    );
  }

  if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT'].includes(code)
    || /fetch failed|socket hang up|connection (?:refused|reset)|network is unreachable/i.test(message)) {
    return failure(
      'unavailable',
      'warning',
      'host_unreachable',
      'L’appareil est actuellement inaccessible.',
      'Il peut être arrêté ou le port peut être fermé. Si l’état persiste, vérifiez l’adresse et le port configurés.',
      true,
    );
  }

  return failure(
    'remote',
    'error',
    'unexpected_error',
    message || 'Une erreur de supervision inattendue est survenue.',
    'Consultez le détail technique et les journaux du service distant.',
    false,
  );
}
