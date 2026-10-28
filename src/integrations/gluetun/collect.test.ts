import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn() }));
import { serviceJson, ServiceError } from '@/lib/widgetData/services';
import { collectGluetun, gluetunHeaders, restartGluetun, toGluetun } from './collect';
import sample from './samples/service.json';

const bytes = vi.mocked(serviceJson);
// serviceJson's own failures: 401/403 as an authentication error, others as HTTP errors, both with the status.
const refused = (status: number) => new ServiceError(status === 401 || status === 403 ? 'integrations.error.authentication' : 'widgets.error.http', 502, { status });
const answer = (value: unknown, status = 200) => status === 200 ? Promise.resolve(value) : Promise.reject(refused(status));
const source = (settings: Record<string, string> = {}, secrets: Record<string, string> = { apiKey: 'fictional-key' }): IntegrationInstance => ({ id: 'gluetun-1', type: 'gluetun', name: 'Gluetun', settings: { url: 'http://gluetun.example.com:8000', ...settings }, secrets });
const routes = (map: Record<string, unknown>) => bytes.mockImplementation((_instance, path) => path in map ? answer(map[path]) : answer('Unauthorized', 401));
beforeEach(() => vi.resetAllMocks());

describe('Gluetun control server', () => {
  it('reads the tunnel state, exit location and forwarded port, never the settings route that holds private keys', async () => {
    routes({ '/v1/vpn/status': sample.status, '/v1/publicip/ip': sample.publicip, '/v1/portforward': sample.portforward });
    expect(await collectGluetun(source())).toMatchObject({ provider: 'gluetun', name: 'Gluetun', status: 'running', publicIp: '198.51.100.24', country: 'Netherlands', region: 'North Holland', city: 'Amsterdam', organization: 'Fictional Transit B.V.', forwardedPorts: [51413] });
    expect(bytes.mock.calls.map(([, path]) => path).sort()).toEqual(['/v1/portforward', '/v1/publicip/ip', '/v1/vpn/status']);
    for (const [, , options] of bytes.mock.calls) expect(options?.headers).toEqual({ 'X-API-Key': 'fictional-key' });
  });
  it('shows a running tunnel without an exit address yet as such, with no port', () => {
    const summary = toGluetun(source(), sample.starting.status, sample.starting.publicip, sample.starting.portforward);
    expect(summary).toMatchObject({ status: 'running' });
    expect(summary).not.toHaveProperty('publicIp'); expect(summary).not.toHaveProperty('forwardedPorts');
  });
  it('drops the last address of a tunnel that is not running and maps unknown states', () => {
    expect(toGluetun(source(), { status: 'stopped' }, sample.publicip)).not.toHaveProperty('publicIp');
    expect(toGluetun(source(), { status: 'crashed' }).status).toBe('crashed');
    expect(toGluetun(source(), { status: 'something-new' }).status).toBe('unknown');
    expect(() => toGluetun(source(), {})).toThrow();
    expect(toGluetun(source(), sample.status, undefined, { port: 0, ports: [6881, 6881, 70000, 'x', 51413] }).forwardedPorts).toEqual([6881, 51413]);
  });
  it('keeps the state when the role leaves out the address or the port, and fails when the state itself is refused', async () => {
    routes({ '/v1/vpn/status': sample.status });
    expect(await collectGluetun(source())).toMatchObject({ status: 'running' });
    bytes.mockReset().mockImplementation(() => answer('Unauthorized', 401));
    await expect(collectGluetun(source())).rejects.toMatchObject({ key: 'integrations.error.authentication' });
    bytes.mockReset().mockImplementation((_instance, path) => path === '/v1/vpn/status' ? answer(sample.status) : answer('', 500));
    await expect(collectGluetun(source())).rejects.toMatchObject({ key: 'widgets.error.http' });
  });
  it('authenticates with an API key, a user and password, or nothing', () => {
    expect(gluetunHeaders(source())).toEqual({ 'X-API-Key': 'fictional-key' });
    expect(gluetunHeaders(source({ auth: 'basic', username: 'fictional-user' }, { password: 'fictional-password' }))).toEqual({ Authorization: `Basic ${Buffer.from('fictional-user:fictional-password').toString('base64')}` });
    expect(gluetunHeaders(source({ auth: 'none' }))).toEqual({});
    expect(gluetunHeaders(source({}, {}))).toEqual({});
  });
  it('restarts by stopping then starting the VPN loop', async () => {
    bytes.mockResolvedValue({ outcome: 'ok' });
    await restartGluetun(source());
    expect(bytes.mock.calls.map(([, path, options]) => [path, options?.method, options?.json])).toEqual([['/v1/vpn/status', 'PUT', { status: 'stopped' }], ['/v1/vpn/status', 'PUT', { status: 'running' }]]);
  });
});
