import type { IntegrationInstance } from '@/lib/types';
import type { GameServer, GameServersSummary } from '@/lib/widgetData/contracts';
import { createHash } from 'node:crypto';
import { array, assertStatus, number, object, serviceBytes, serviceJson, string, ServiceError } from '@/lib/widgetData/services';
import type { KitServer } from '../kitServer';

/**
 * Crafty Controller 4, API v2 (`docs.craftycontrol.com` OpenAPI spec and
 * `app/classes/web/routes/api/servers`, checked 2026-11-26). An API key made in
 * the panel (or a login token) goes as `Authorization: Bearer`. Servers:
 * `GET /api/v2/servers` (`data[]`: `server_id`, `server_name`, `type`), their
 * latest statistics `GET /api/v2/servers/{id}/stats` (`data`: `running`,
 * `crashed`, `updating`, `waiting_start`, `cpu`, `mem`, `mem_percent`,
 * `online`, `max`, `players`, `desc`, `version`, `started`, `world_size`, and
 * `icon`, the server's `server-icon.png` in base64). Start, stop and restart:
 * `POST /api/v2/servers/{id}/action/{start_server|stop_server|restart_server}`,
 * which needs the Commands permission on that server.
 */
const MAX_SERVERS = 24;
const headers = (instance: IntegrationInstance) => ({ Authorization: `Bearer ${instance.secrets?.apiKey ?? ''}` });
export const craftyRequest = <T = unknown>(instance: IntegrationInstance, path: string) => serviceJson<T>(instance, path, { headers: headers(instance) });

/** Crafty answers `{ status: 'ok', data }`, or `{ status: 'error', error }` with a 200 on some routes. */
function data(answer: unknown): unknown {
  const body = object(answer);
  if (body.status === 'error') throw new ServiceError('integrations.error.authentication', 502);
  if (!('data' in body)) throw new ServiceError('widgets.error.parse');
  return body.data;
}

/** "42.2MB", "1.5 GB" or a plain number (megabytes) → bytes. */
export function memoryBytes(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value * 1024 * 1024);
  const match = /^\s*([\d.]+)\s*([KMGT]?)i?B?\s*$/i.exec(typeof value === 'string' ? value : '');
  if (!match) return undefined;
  const amount = Number(match[1]);
  const power = ['', 'K', 'M', 'G', 'T'].indexOf(match[2].toUpperCase());
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 1024 ** Math.max(0, power)) : undefined;
}
const percent = (value: unknown) => { const n = typeof value === 'string' ? Number(value) : value; return typeof n === 'number' && Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n * 10) / 10)) : undefined; };
/** Crafty stores the player list as text (`"['Alex', 'Sam']"` or JSON). */
export function playerNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => string(typeof item === 'object' ? object(item).name : item)).filter(Boolean).slice(0, 50);
  const text = typeof value === 'string' ? value : '';
  return [...text.matchAll(/'([^']{1,40})'|"([^"]{1,40})"/g)].map(match => match[1] ?? match[2]).slice(0, 50);
}
/** Minecraft formatting codes (`§a`) and extra spaces out of a message of the day. */
export const plainMotd = (value: unknown) => string(value).replace(/§[0-9a-fk-or]/gi, '').replace(/\s+/g, ' ').trim().slice(0, 200);

const SERVER_ID = /^[A-Za-z0-9-]{1,64}$/;
const known = new Map<string, Set<string>>();

/**
 * Server icons (`server-icon.png`, 64×64), kept per connection so the image
 * route serves only what the server itself sent; the id changes with the picture.
 */
const icons = new Map<string, Buffer>();
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export function rememberIcon(instance: IntegrationInstance, server: string, value: unknown): string | undefined {
  const base64 = string(value).replace(/^data:image\/png;base64,/, '').replace(/\s+/g, '');
  if (!base64 || base64.length > 90_000 || !/^[A-Za-z0-9+/]+=*$/.test(base64)) return undefined;
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.subarray(0, 8).equals(PNG)) return undefined;
  const id = `icon-${server}-${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}`;
  icons.delete(`${instance.id}:${id}`);
  icons.set(`${instance.id}:${id}`, bytes);
  while (icons.size > 500) icons.delete(icons.keys().next().value!);
  return id;
}
export async function iconImage(instance: IntegrationInstance, id: string) {
  const bytes = icons.get(`${instance.id}:${id}`);
  if (!bytes) throw new ServiceError('widgets.error.notFound', 404);
  return { bytes, contentType: 'image/png' };
}
/** Crafty writes when a server started as local time (`2026-11-26 08:00:11`). */
function startedAt(value: unknown, now: number): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(string(value));
  if (!match) return undefined;
  const time = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])).getTime();
  return Number.isFinite(time) && time <= now + 60_000 ? Math.min(time, now) : undefined;
}

export function toGameServer(server: unknown, stats: unknown, instance?: IntegrationInstance, now = Date.now()): GameServer | undefined {
  const item = object(server), live = object(stats);
  const id = String(item.server_id ?? '');
  if (!SERVER_ID.test(id)) return undefined;
  const state: GameServer['state'] = live.crashed === true ? 'crashed' : live.updating === true ? 'updating' : live.waiting_start === true ? 'starting' : live.running === true ? 'online' : 'offline';
  const online = state === 'online';
  const names = online ? playerNames(live.players) : [];
  const motd = online ? plainMotd(live.desc) : '';
  const icon = instance ? rememberIcon(instance, id, live.icon) : undefined;
  const started = online ? startedAt(live.started, now) : undefined;
  const world = memoryBytes(live.world_size);
  return {
    id, name: string(item.server_name).slice(0, 120) || id, state,
    ...(motd && motd !== 'Unable to Connect' ? { motd } : {}),
    ...(string(live.version) ? { version: string(live.version).slice(0, 40) } : {}),
    ...(online ? { players: number(live.online), maxPlayers: number(live.max) } : {}),
    ...(names.length ? { playerNames: names } : {}),
    ...(online && percent(live.cpu) !== undefined ? { cpuPercent: percent(live.cpu) } : {}),
    ...(online && percent(live.mem_percent) !== undefined ? { memoryPercent: percent(live.mem_percent) } : {}),
    ...(online && memoryBytes(live.mem) ? { memoryBytes: memoryBytes(live.mem) } : {}),
    ...(icon ? { icon } : {}),
    ...(started ? { startedAt: started } : {}),
    ...(world ? { worldBytes: world } : {}),
    controllable: true,
  };
}

export async function collectCrafty(instance: IntegrationInstance): Promise<GameServersSummary> {
  const list = data(await craftyRequest(instance, '/api/v2/servers'));
  if (!Array.isArray(list)) throw new ServiceError('widgets.error.parse');
  const servers = array(list).slice(0, MAX_SERVERS);
  const stats = await Promise.all(servers.map(server => {
    const id = String(object(server).server_id ?? '');
    return SERVER_ID.test(id) ? craftyRequest(instance, `/api/v2/servers/${encodeURIComponent(id)}/stats`).then(data).catch(() => undefined) : undefined;
  }));
  const mapped = servers.map((server, index) => toGameServer(server, stats[index], instance)).filter((server): server is GameServer => !!server);
  known.set(instance.id, new Set(mapped.map(server => server.id)));
  return { provider: 'crafty', name: instance.name, servers: mapped, fetchedAt: Date.now() };
}

/** Only a server Crafty listed for this connection can be started, stopped or restarted. */
async function serverAction(instance: IntegrationInstance, target: string | undefined, action: 'start_server' | 'stop_server' | 'restart_server') {
  if (!target || !SERVER_ID.test(target) || !known.get(instance.id)?.has(target)) throw new ServiceError('widgets.error.notFound', 404);
  const answer = await serviceBytes(instance, `/api/v2/servers/${encodeURIComponent(target)}/action/${action}`, { method: 'POST', headers: headers(instance) }, 65536);
  assertStatus(answer.status);
  if (object((() => { try { return JSON.parse(answer.bytes.toString('utf8')); } catch { return {}; } })()).status === 'error') throw new ServiceError('integrations.error.authentication', 502);
}

/** The public demo: two fictional servers; an action changes the state shown for a minute (shared by every visitor). */
const demoStates = new Map<string, { state: GameServer['state']; until: number }>();
const demoState = (id: string, fallback: GameServer['state']) => { const chosen = demoStates.get(id); return chosen && chosen.until > Date.now() ? chosen.state : fallback; };
export function demoGameServers(instance: IntegrationInstance, provider: GameServersSummary['provider']): GameServersSummary {
  const minute = Math.floor(Date.now() / 60_000);
  const players = ['Alex', 'Sam', 'Robin', 'Charlie'].slice(0, 2 + (minute % 3));
  const survival: GameServer = {
    id: 'survival', name: provider === 'minecraft' ? instance.name : 'Survival', state: demoState('survival', 'online'),
    motd: 'A fictional world for the NasDash demo', version: '1.21.4', players: players.length, maxPlayers: 20, playerNames: players, icon: 'icon-demo-survival',
    ...(provider === 'crafty'
      ? { cpuPercent: 18 + (minute % 7), memoryPercent: 42, memoryBytes: 3.4 * 1024 ** 3, startedAt: (minute - 197) * 60_000, worldBytes: 1.4 * 1024 ** 3, controllable: true }
      : { latencyMs: 24 + (minute % 9) }),
  };
  const creative: GameServer = { id: 'creative', name: 'Creative', state: demoState('creative', 'offline'), version: '1.21.4', icon: 'icon-demo-creative', worldBytes: 380 * 1024 ** 2, controllable: true };
  if (creative.state === 'online') Object.assign(creative, { players: 0, maxPlayers: 10, cpuPercent: 4, memoryPercent: 18, memoryBytes: 1.5 * 1024 ** 3, startedAt: Date.now() - 30_000 });
  for (const server of [survival, creative]) if (server.state !== 'online') { delete server.players; delete server.playerNames; delete server.cpuPercent; delete server.memoryPercent; delete server.memoryBytes; delete server.motd; delete server.startedAt; }
  return { provider, name: instance.name, servers: provider === 'crafty' ? [survival, creative] : [survival], fetchedAt: Date.now() };
}
const demoAction = (state: GameServer['state']) => (_instance: IntegrationInstance, target?: string) => { if (target === 'survival' || target === 'creative') demoStates.set(target, { state, until: Date.now() + 60_000 }); };

export const craftyKit: KitServer<GameServersSummary> = {
  ttlMs: 20_000,
  collect: collectCrafty,
  test: async instance => { const list = data(await craftyRequest(instance, '/api/v2/servers')); if (!Array.isArray(list)) throw new ServiceError('widgets.error.parse'); },
  demo: instance => demoGameServers(instance, 'crafty'),
  image: iconImage,
  actions: {
    start: { run: (instance, target) => serverAction(instance, target, 'start_server'), demo: demoAction('online') },
    stop: { run: (instance, target) => serverAction(instance, target, 'stop_server'), demo: demoAction('offline') },
    restart: { run: (instance, target) => serverAction(instance, target, 'restart_server'), demo: demoAction('online') },
  },
};
