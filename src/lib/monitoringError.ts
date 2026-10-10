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
      'Check the URL, port, username and token configured for this device.',
      false,
    );
  }

  if (error instanceof MonitoringInvalidResponseError || error instanceof SyntaxError) {
    return failure(
      'remote',
      'error',
      'invalid_response',
      error.message || 'The received response is invalid.',
      'Check that the URL points to the expected API, not an HTML page or another service.',
      false,
    );
  }

  if (error instanceof MonitoringHttpError) {
    if (error.status === 401 || error.status === 403) {
      return failure(
        'permission',
        'error',
        'access_denied',
        `${error.service} denied access (HTTP ${error.status}).`,
        'Check the token, user and permissions granted by the remote service.',
        false,
      );
    }

    if (error.status === 404) {
      return failure(
        'configuration',
        'error',
        'endpoint_not_found',
        `The configured ${error.service} endpoint was not found (HTTP 404).`,
        'Check the URL, API version and selected device type.',
        false,
      );
    }

    if ([408, 425, 429].includes(error.status)) {
      return failure(
        'unavailable',
        'warning',
        'temporarily_rejected',
        `${error.service} is temporarily unavailable (HTTP ${error.status}).`,
        'The service is reachable but asks to retry later. NasDash will retry automatically.',
        true,
      );
    }

    return failure(
      'remote',
      'error',
      'remote_http_error',
      `${error.service} returned HTTP ${error.status}.`,
      'Check the remote service logs; the connection works but its API reports an error.',
      error.status >= 500,
    );
  }

  const { name, message, code } = errorDetails(error);

  if (name === 'AbortError' || name === 'TimeoutError' || /aborted|timed?\s*out|timeout/i.test(message)) {
    return failure(
      'unavailable',
      'warning',
      'timeout',
      'The device did not respond before the timeout.',
      'It may be stopped, overloaded or temporarily unreachable. NasDash will retry automatically.',
      true,
    );
  }

  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) {
    return failure(
      'unavailable',
      'warning',
      'name_resolution',
      'The device hostname cannot currently be resolved.',
      'If this persists, check the hostname and DNS available inside the NasDash container.',
      true,
    );
  }

  if (/CERT_|TLS|SSL/i.test(code) || /certificate|tls|ssl/i.test(message)) {
    return failure(
      'configuration',
      'error',
      'tls_error',
      'The TLS connection to the device failed.',
      'Check the certificate, hostname and HTTPS configuration of the remote service.',
      false,
    );
  }

  if (/invalid url|failed to parse url/i.test(message)) {
    return failure(
      'configuration',
      'error',
      'invalid_url',
      'The configured monitoring URL is invalid.',
      'Enter a complete URL with the expected protocol, address and port.',
      false,
    );
  }

  if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT'].includes(code)
    || /fetch failed|socket hang up|connection (?:refused|reset)|network is unreachable/i.test(message)) {
    return failure(
      'unavailable',
      'warning',
      'host_unreachable',
      'The device is currently unreachable.',
      'It may be stopped or its port may be closed. If this persists, check the configured address and port.',
      true,
    );
  }

  return failure(
    'remote',
    'error',
    'unexpected_error',
    message || 'An unexpected monitoring error occurred.',
    'Check the technical details and the remote service logs.',
    false,
  );
}
