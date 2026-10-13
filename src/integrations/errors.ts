import { MonitoringHttpError, MonitoringInvalidResponseError } from '@/lib/monitoringError';
import { CollectError } from './types';

/** Localizable interface diagnostics; the original failure stays available to operational logs. */
export function collectorFailure(service: string, error: unknown): CollectError {
  if (error instanceof CollectError) return error;
  if (error instanceof MonitoringHttpError) return new CollectError('integrations.error.http', error, false, { service, status: error.status });
  if (error instanceof MonitoringInvalidResponseError || error instanceof SyntaxError) return new CollectError('integrations.invalidResponse', error);
  return new CollectError('integrations.error.unavailable', error, false, { service });
}
