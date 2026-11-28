import { promises as dns } from 'node:dns';
import type { IntegrationInstance } from '@/lib/types';
import type { GameServersSummary } from '@/lib/widgetData/contracts';
import { array, number, object, string, ServiceError } from '@/lib/widgetData/services';
import type { KitServer } from '../kitServer';
import { tcpExchange } from '../ups/socket';
import { demoGameServers, iconImage, plainMotd, rememberIcon } from '../crafty/collect';

/**
 * A Minecraft Java server asked directly, without any panel: the "Server List
 * Ping" every game client sends (wiki.vg / minecraft.wiki "Java Edition
 * protocol › Server List Ping", checked 2026-11-26). Handshake (packet 0x00:
 * protocol version, address, port, next state 1) then status request (0x00);
 * the answer is one packet holding a JSON status: `version.name`,
 * `players.online|max|sample[].name`, `description` (text or a chat
 * component) and `favicon` (a PNG data URL). No account; a server that does
 * not answer is shown offline.
 * With no port saved, the `_minecraft._tcp` SRV record is followed, like the game.
 */
const DEFAULT_PORT = 25565;

export function varint(value: number): Buffer {
  const bytes: number[] = [];
  let rest = value >>> 0;
  do { let byte = rest & 0x7f; rest >>>= 7; if (rest) byte |= 0x80; bytes.push(byte); } while (rest);
  return Buffer.from(bytes);
}
/** A varint at `offset`: its value and the offset after it, or undefined when the buffer stops before its end. */
export function readVarint(buffer: Buffer, offset: number): { value: number; next: number } | undefined {
  let value = 0;
  for (let index = 0; index < 5; index++) {
    if (offset + index >= buffer.length) return undefined;
    const byte = buffer[offset + index];
    value |= (byte & 0x7f) << (7 * index);
    if (!(byte & 0x80)) return { value: value >>> 0, next: offset + index + 1 };
  }
  throw new ServiceError('widgets.error.parse');
}
const packet = (...parts: Buffer[]) => { const body = Buffer.concat(parts); return Buffer.concat([varint(body.length), body]); };
const text = (value: string) => { const bytes = Buffer.from(value, 'utf8'); return Buffer.concat([varint(bytes.length), bytes]); };

/** Handshake then status request, for this address and port. */
export function statusRequest(host: string, port: number): Buffer {
  const portBytes = Buffer.alloc(2); portBytes.writeUInt16BE(port);
  // Protocol -1: "any", what launchers send when they only ask for the status.
  return Buffer.concat([packet(varint(0), varint(-1 >>> 0), text(host), portBytes, varint(1)), packet(varint(0))]);
}
/** The JSON of a complete status answer, or undefined while it is still arriving. */
export function statusJson(buffer: Buffer): unknown | undefined {
  const length = readVarint(buffer, 0);
  if (!length || buffer.length < length.next + length.value) return undefined;
  const id = readVarint(buffer, length.next);
  if (!id || id.value !== 0) throw new ServiceError('widgets.error.parse');
  const size = readVarint(buffer, id.next);
  if (!size || size.next + size.value > length.next + length.value) throw new ServiceError('widgets.error.parse');
  try { return JSON.parse(buffer.subarray(size.next, size.next + size.value).toString('utf8')); } catch { throw new ServiceError('widgets.error.parse'); }
}
/** A chat component (`{ text, extra[] }`) or plain text → the words, without formatting. */
export function chatText(value: unknown, depth = 0): string {
  if (typeof value === 'string') return value;
  if (depth > 8) return '';
  if (Array.isArray(value)) return value.map(item => chatText(item, depth + 1)).join('');
  const part = object(value);
  return `${typeof part.text === 'string' ? part.text : ''}${array(part.extra).map(item => chatText(item, depth + 1)).join('')}`;
}

/** The saved address, or the game's SRV record when no port is saved. */
async function target(instance: IntegrationInstance): Promise<IntegrationInstance> {
  if ((instance.settings.port ?? '').trim()) return instance;
  const host = (instance.settings.host ?? '').trim();
  try {
    const [record] = await dns.resolveSrv(`_minecraft._tcp.${host}`);
    if (record?.name && record.port) return { ...instance, settings: { ...instance.settings, host: record.name, port: String(record.port) } };
  } catch { /* No SRV record: the address itself, on the default port. */ }
  return instance;
}

export function toMinecraft(instance: IntegrationInstance, status: unknown, latencyMs: number): GameServersSummary {
  const body = object(status), players = object(body.players), version = object(body.version);
  if (!('players' in body) && !('version' in body)) throw new ServiceError('widgets.error.parse');
  const names = array(players.sample).map(item => string(object(item).name).slice(0, 40)).filter(name => name && !/§/.test(name)).slice(0, 50);
  const motd = plainMotd(chatText(body.description));
  const icon = rememberIcon(instance, 'server', body.favicon);
  return {
    provider: 'minecraft', name: instance.name,
    servers: [{
      id: 'server', name: instance.name, state: 'online',
      ...(motd ? { motd } : {}),
      ...(string(version.name) ? { version: plainMotd(version.name).slice(0, 40) } : {}),
      players: number(players.online), maxPlayers: number(players.max),
      ...(names.length ? { playerNames: names } : {}),
      latencyMs: Math.round(latencyMs),
      ...(icon ? { icon } : {}),
    }],
    fetchedAt: Date.now(),
  };
}

async function ping(instance: IntegrationInstance): Promise<GameServersSummary> {
  const resolved = await target(instance);
  const host = (resolved.settings.host ?? '').trim().replace(/^\[(.*)\]$/, '$1');
  const port = Number((resolved.settings.port ?? '').trim() || DEFAULT_PORT);
  const started = performance.now();
  const answer = await tcpExchange(resolved, DEFAULT_PORT, statusRequest(host, Number.isInteger(port) ? port : DEFAULT_PORT), received => statusJson(received) !== undefined);
  return toMinecraft(instance, statusJson(answer), performance.now() - started);
}

export const minecraftKit: KitServer<GameServersSummary> = {
  ttlMs: 30_000,
  // An address that answers nothing is a server that is down, not a broken widget.
  collect: instance => ping(instance).catch(error => {
    if (error instanceof ServiceError && ['widgets.error.network', 'widgets.error.timeout'].includes(error.message)) {
      return { provider: 'minecraft', name: instance.name, servers: [{ id: 'server', name: instance.name, state: 'offline' }], fetchedAt: Date.now() } satisfies GameServersSummary;
    }
    throw error;
  }),
  test: async instance => { await ping(instance); },
  demo: instance => demoGameServers(instance, 'minecraft'),
  image: iconImage,
};
