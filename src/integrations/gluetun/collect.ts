import type { IntegrationInstance } from '@/lib/types';
import type { VpnTunnelSummary } from '@/lib/widgetData/contracts';
import { array, object, serviceJson, string, ServiceError } from '@/lib/widgetData/services';
import { basicHeaders } from '../downloads/shared';

/**
 * Gluetun's control server (port 8000). Only these routes are read: `/v1/vpn/settings` is never requested, since it
 * answers with the WireGuard private key and the OpenVPN password.
 */
export function gluetunHeaders(instance: IntegrationInstance): Record<string, string> {
  const auth = instance.settings.auth || 'apikey';
  if (auth === 'basic') return basicHeaders(instance);
  return auth === 'apikey' && instance.secrets?.apiKey ? { 'X-API-Key': instance.secrets.apiKey } : {};
}
export const gluetunRequest = <T = unknown>(instance: IntegrationInstance, path: string, options: { method?: 'PUT'; json?: unknown } = {}) =>
  serviceJson<T>(instance, path, { ...options, headers: gluetunHeaders(instance) });

const STATUSES = ['running', 'starting', 'stopping', 'stopped', 'crashed'] as const;
const text = (value: unknown, max = 120) => { const result = string(value).trim(); return result ? result.slice(0, max) : undefined; };
/** A role may leave out the public IP or the forwarded port: their part of the widget stays empty. */
const optional = <T>(request: Promise<T>) => request.catch((error: unknown) => {
  if (error instanceof ServiceError && [401, 403, 404].includes(Number(error.parameters?.status))) return undefined;
  throw error;
});

export function toGluetun(instance: IntegrationInstance, status: unknown, ip?: unknown, forward?: unknown): VpnTunnelSummary {
  const state = string(object(status).status).toLowerCase();
  if (!state) throw new ServiceError('widgets.error.parse');
  const where = object(ip), publicIp = text(where.public_ip, 64);
  const ports = [...array(object(forward).ports), object(forward).port].filter((port): port is number => Number.isInteger(port) && Number(port) > 0 && Number(port) < 65536);
  return {
    provider: 'gluetun', name: instance.name,
    status: (STATUSES as readonly string[]).includes(state) ? state as VpnTunnelSummary['status'] : 'unknown',
    // Gluetun keeps the last address while the tunnel restarts: it only describes a running tunnel.
    ...(publicIp && state === 'running' ? { publicIp, country: text(where.country), region: text(where.region), city: text(where.city), organization: text(where.organization) } : {}),
    ...(ports.length ? { forwardedPorts: [...new Set(ports)].sort((a, b) => a - b) } : {}),
    fetchedAt: Date.now(),
  };
}

export async function collectGluetun(instance: IntegrationInstance): Promise<VpnTunnelSummary> {
  const [status, ip, forward] = await Promise.all([
    gluetunRequest(instance, '/v1/vpn/status'),
    optional(gluetunRequest(instance, '/v1/publicip/ip')),
    optional(gluetunRequest(instance, '/v1/portforward')),
  ]);
  return toGluetun(instance, status, ip, forward);
}

/** Stop then start the VPN loop: a new connection, on a server chosen again by Gluetun. */
export async function restartGluetun(instance: IntegrationInstance): Promise<void> {
  await gluetunRequest(instance, '/v1/vpn/status', { method: 'PUT', json: { status: 'stopped' } });
  await gluetunRequest(instance, '/v1/vpn/status', { method: 'PUT', json: { status: 'running' } });
}
