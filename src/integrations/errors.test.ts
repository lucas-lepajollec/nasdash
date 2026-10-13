import { describe, expect, it } from 'vitest';
import { MonitoringHttpError, MonitoringInvalidResponseError } from '@/lib/monitoringError';
import { CollectError } from './types';
import { collectorFailure } from './errors';

describe('localized monitoring diagnostics', () => {
  it('carries HTTP status and integration name as translation parameters', () => {
    const reason = new MonitoringHttpError('Glances', 404, 'Not Found');
    const failure = collectorFailure('Glances', reason);
    expect(failure.message).toBe('integrations.error.http');
    expect(failure.parameters).toEqual({ service: 'Glances', status: 404 });
    expect(failure.reason).toBe(reason);
    expect(reason.message).toBe('Glances HTTP 404 Not Found');
  });
  it('keeps detailed operational failures separate from localized interface copy', () => {
    const reason = new Error('connect ECONNREFUSED fictional-host');
    const failure = collectorFailure('Beszel', reason);
    expect(failure.message).toBe('integrations.error.unavailable');
    expect(failure.parameters).toEqual({ service: 'Beszel' });
    expect(failure.reason).toBe(reason);
    expect(collectorFailure('LHM', new SyntaxError('Unexpected token')).message).toBe('integrations.invalidResponse');
    expect(collectorFailure('Proxmox', new MonitoringInvalidResponseError('Invalid JSON')).message).toBe('integrations.invalidResponse');
  });
  it('preserves expected silent failures and their parameters', () => {
    const failure = new CollectError('integrations.error.targetNotFound', undefined, true, { target: 'fictional-node' });
    expect(collectorFailure('Beszel', failure)).toBe(failure);
  });
});
