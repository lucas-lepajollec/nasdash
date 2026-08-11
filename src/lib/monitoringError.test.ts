import { describe, expect, it } from 'vitest';
import {
  classifyMonitoringError,
  MonitoringConfigurationError,
  MonitoringHttpError,
  MonitoringInvalidResponseError,
} from './monitoringError';

describe('monitoring failure classification', () => {
  it('treats timeouts and offline hosts as retryable warnings', () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    expect(classifyMonitoringError(timeout)).toMatchObject({
      category: 'unavailable', severity: 'warning', code: 'timeout', retryable: true,
    });

    const refused = Object.assign(new TypeError('fetch failed'), {
      cause: { code: 'ECONNREFUSED' },
    });
    expect(classifyMonitoringError(refused)).toMatchObject({
      category: 'unavailable', severity: 'warning', code: 'host_unreachable', retryable: true,
    });
  });

  it('keeps persistent DNS ambiguity as a warning with a configuration hint', () => {
    const dns = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    const result = classifyMonitoringError(dns);
    expect(result).toMatchObject({ category: 'unavailable', severity: 'warning', code: 'name_resolution' });
    expect(result.hint).toContain('DNS');
  });

  it('reports missing settings, permissions and bad endpoints as errors', () => {
    expect(classifyMonitoringError(new MonitoringConfigurationError('URL Glances manquante.')))
      .toMatchObject({ category: 'configuration', severity: 'error', code: 'invalid_configuration' });
    expect(classifyMonitoringError(new MonitoringHttpError('Proxmox', 403)))
      .toMatchObject({ category: 'permission', severity: 'error', code: 'access_denied' });
    expect(classifyMonitoringError(new MonitoringHttpError('Glances', 404)))
      .toMatchObject({ category: 'configuration', severity: 'error', code: 'endpoint_not_found' });

    const tls = Object.assign(new TypeError('fetch failed: certificate has expired'), {
      cause: { code: 'CERT_HAS_EXPIRED' },
    });
    expect(classifyMonitoringError(tls))
      .toMatchObject({ category: 'configuration', severity: 'error', code: 'tls_error' });
  });

  it('keeps invalid responses and remote server failures visible as errors', () => {
    expect(classifyMonitoringError(new MonitoringInvalidResponseError('Réponse HTML reçue.')))
      .toMatchObject({ category: 'remote', severity: 'error', code: 'invalid_response' });
    expect(classifyMonitoringError(new MonitoringHttpError('Proxmox', 500)))
      .toMatchObject({ category: 'remote', severity: 'error', code: 'remote_http_error', retryable: true });
  });
});
