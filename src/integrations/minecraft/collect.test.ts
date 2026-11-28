import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
import { chatText, minecraftKit, readVarint, statusJson, statusRequest, varint } from './collect';
import sample from './samples/service.json';

const servers: net.Server[] = [];
afterEach(() => { for (const server of servers.splice(0)) server.close(); });

/** A local server answering the status request like Minecraft does. */
async function fakeServer(status: unknown): Promise<number> {
  const server = net.createServer(socket => socket.once('data', () => {
    const json = Buffer.from(JSON.stringify(status), 'utf8');
    const body = Buffer.concat([varint(0), varint(json.length), json]);
    socket.end(Buffer.concat([varint(body.length), body]));
  }));
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as net.AddressInfo).port;
}
const instance = (port: number): IntegrationInstance => ({ id: 'mc-1', type: 'minecraft', name: 'Survival', settings: { host: '127.0.0.1', port: String(port) } });

describe('Minecraft server', () => {
  it('reads the status a server answers', async () => {
    const summary = await minecraftKit.collect(instance(await fakeServer(sample)));
    expect(summary.servers[0]).toMatchObject({ id: 'server', name: 'Survival', state: 'online', motd: 'A fictional world', version: 'Paper 1.21.4', players: 2, maxPlayers: 20, playerNames: ['Alex', 'Sam'] });
    expect(summary.servers[0].latencyMs).toBeGreaterThanOrEqual(0);
    // Its icon is served from what the server sent, and only that.
    const icon = summary.servers[0].icon!;
    expect(icon).toMatch(/^icon-server-[0-9a-f]{12}$/);
    expect((await minecraftKit.image!(instance(1), icon)).contentType).toBe('image/png');
    await expect(minecraftKit.image!(instance(1), 'icon-server-000000000000')).rejects.toThrow();
  });
  it('shows a server that does not answer as offline', async () => {
    const closed = net.createServer(); await new Promise<void>(resolve => closed.listen(0, '127.0.0.1', resolve));
    const port = (closed.address() as net.AddressInfo).port; closed.close();
    const summary = await minecraftKit.collect(instance(port));
    expect(summary.servers).toEqual([{ id: 'server', name: 'Survival', state: 'offline' }]);
    await expect(minecraftKit.test(instance(port))).rejects.toThrow();
  });
  it('writes and reads the protocol', () => {
    expect([...varint(300)]).toEqual([0xac, 0x02]);
    expect(readVarint(Buffer.from([0xac, 0x02]), 0)).toEqual({ value: 300, next: 2 });
    expect(readVarint(Buffer.from([0xac]), 0)).toBeUndefined();
    const request = statusRequest('mc.example.com', 25565);
    expect(request.includes(Buffer.from('mc.example.com'))).toBe(true);
    expect(statusJson(Buffer.from([0x05, 0x00]))).toBeUndefined();
    expect(chatText({ text: 'A', extra: ['B', { text: 'C' }] })).toBe('ABC');
  });
  it('refuses an address that is a URL', async () => {
    await expect(minecraftKit.test({ ...instance(25565), settings: { host: 'http://mc.example.com' } })).rejects.toThrow();
  });
});
