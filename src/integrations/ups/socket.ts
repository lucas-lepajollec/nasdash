import net from 'node:net';
import type { IntegrationInstance } from '@/lib/types';
import { ServiceError } from '@/lib/widgetData/services';

/** `host` (name or address, IPv6 in brackets or bare) and `port` of a TCP service saved on a connection. */
export function tcpTarget(instance: IntegrationInstance, fallbackPort: number): { host: string; port: number } {
  const host = (instance.settings.host ?? '').trim().replace(/^\[(.*)\]$/, '$1');
  const rawPort = (instance.settings.port ?? '').trim();
  const port = rawPort ? Number(rawPort) : fallbackPort;
  // A plain host: no scheme, path, credentials or spaces (those would mean a URL was pasted).
  if (!host || host.length > 253 || /[\s/@?#]/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) throw new ServiceError('integrations.error.invalidUrl');
  return { host, port };
}

/**
 * One short TCP conversation: send `request`, collect the answer until `done` says it is complete, then close.
 * Bounded like the HTTP services: 6 s in all and 256 KiB of answer.
 */
export function tcpExchange(instance: IntegrationInstance, fallbackPort: number, request: Buffer, done: (received: Buffer) => boolean): Promise<Buffer> {
  const { host, port } = tcpTarget(instance, fallbackPort);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0, settled = false;
    const socket = net.createConnection({ host, port });
    const finish = (error?: ServiceError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error); else resolve(Buffer.concat(chunks));
    };
    const timer = setTimeout(() => finish(new ServiceError('widgets.error.timeout', 504)), 6000);
    socket.on('connect', () => socket.write(request));
    socket.on('data', chunk => {
      size += chunk.length;
      if (size > 256 * 1024) return finish(new ServiceError('widgets.error.tooLarge', 502));
      chunks.push(chunk);
      if (done(Buffer.concat(chunks))) finish();
    });
    socket.on('end', () => finish(done(Buffer.concat(chunks)) ? undefined : new ServiceError('widgets.error.parse')));
    socket.on('error', () => finish(new ServiceError('widgets.error.network', 502)));
  });
}
