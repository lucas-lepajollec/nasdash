import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
import { collectNut, nutUps, nutUpsNames, nutVariables, toNut } from '../nut/collect';
import { apcFields, apcRecords, collectApcupsd, toApcupsd } from '../apcupsd/collect';
import { tcpTarget } from './socket';
import { untilShutdown } from '@/widgets/ups/CalmeUps';

const sample = (file: string) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const instance = (type: string, port: number | string, host = '127.0.0.1'): IntegrationInstance => ({ id: `${type}-1`, type, name: 'Fictional UPS', settings: { host, port: String(port) }, secrets: {} });
const servers: net.Server[] = [];
afterEach(() => { for (const server of servers.splice(0)) server.close(); });
/** A real local TCP server answering each connection with `respond(request so far)`. */
async function serve(respond: (request: string, socket: net.Socket) => void): Promise<number> {
  const server = net.createServer(socket => { let request = ''; socket.on('data', chunk => { request += chunk.toString('latin1'); respond(request, socket); }); });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as net.AddressInfo).port;
}
const frame = (text: string) => { const body = Buffer.from(text); return Buffer.concat([Buffer.from([body.length >> 8, body.length & 255]), body]); };

describe('NUT', () => {
  it('maps upsd variables: power source, charge, runtime, load in watts and line voltage', () => {
    const summary = toNut(instance('nut', 3493), 'epyc', nutVariables(sample('nut/samples/list-var.txt').split('\n')), nutUpsNames(sample('nut/samples/list-ups.txt').split('\n')));
    expect(summary).toMatchObject({ provider: 'nut', ups: 'epyc', devices: ['epyc', 'spare'], power: 'mains', charging: true, model: 'VP800ELCD', manufacturer: 'CPS',
      batteryPercent: 87, runtimeSeconds: 2520, loadPercent: 18, loadWatts: 86, nominalWatts: 480, inputVoltage: 231, outputVoltage: 230, batteryVoltage: 13.5 });
    expect(summary).not.toHaveProperty('lowBattery');
    expect(nutUps(sample('nut/samples/list-ups.txt').split('\n'))).toEqual([{ name: 'epyc', description: 'Fictional EPYC ION' }, { name: 'spare', description: '' }]);
    expect(toNut(instance('nut', 1), 'u', { 'ups.status': 'OB LB RB OVER', 'ups.realpower': '120', 'ups.load': '40' })).toMatchObject({ power: 'battery', lowBattery: true, replaceBattery: true, overload: true, loadWatts: 120 });
    expect(toNut(instance('nut', 1), 'u', { 'ups.status': 'OFF' })).toMatchObject({ power: 'unknown', offline: true });
    expect(nutVariables(['VAR u device.model "Back \\"Pro\\" \\\\ 900"'])['device.model']).toBe('Back "Pro" \\ 900');
    expect(() => toNut(instance('nut', 1), 'u', {})).toThrow();
  });
  it('talks to upsd over TCP: lists the UPS, reads the first or the chosen one, and always logs out', async () => {
    const requests: string[] = [];
    const port = await serve((request, socket) => {
      if (!request.endsWith('LOGOUT\n')) return;
      requests.push(request);
      const ups = /LIST VAR (\S+)/.exec(request)?.[1];
      socket.end(`${!ups ? sample('nut/samples/list-ups.txt') : ups === 'epyc' ? sample('nut/samples/list-var.txt') : 'ERR UNKNOWN-UPS\n'}OK Goodbye\n`);
    });
    expect(await collectNut(instance('nut', port))).toMatchObject({ ups: 'epyc', description: 'Fictional EPYC ION', batteryPercent: 87 });
    expect(requests).toEqual(['LIST UPS\nLOGOUT\n', 'LIST VAR epyc\nLOGOUT\n']);
    await expect(collectNut(instance('nut', port), 'gone')).rejects.toMatchObject({ key: 'widgets.ups.error.unknownUps' });
    await expect(collectNut(instance('nut', port), 'bad name\nFSD')).rejects.toMatchObject({ key: 'widgets.error.invalidSettings' });
  });
  it('tells a refused address and a lost driver apart', async () => {
    let answer = 'ERR ACCESS-DENIED\n';
    const port = await serve((request, socket) => { if (request.endsWith('LOGOUT\n')) socket.end(`${answer}OK Goodbye\n`); });
    await expect(collectNut(instance('nut', port))).rejects.toMatchObject({ key: 'widgets.ups.error.denied' });
    answer = 'UPS epyc ""\n';
    const second = await serve((request, socket) => { if (request.endsWith('LOGOUT\n')) socket.end(`${request.startsWith('LIST UPS') ? 'UPS epyc ""\n' : 'ERR DATA-STALE\n'}OK Goodbye\n`); });
    await expect(collectNut(instance('nut', second))).rejects.toMatchObject({ key: 'widgets.ups.error.stale' });
  });
});

describe('apcupsd', () => {
  const records = sample('apcupsd/samples/status.txt').split('\n').filter(Boolean).map(line => `${line}\n`);
  it('maps the NIS status: on battery for how long, runtime in seconds, load in watts and the last transfer', () => {
    expect(toApcupsd(instance('apcupsd', 3551), apcFields(records))).toMatchObject({ provider: 'apcupsd', ups: 'rack', model: 'Back-UPS XS 900U',
      power: 'battery', batteryPercent: 71, runtimeSeconds: 1110, loadPercent: 24, loadWatts: 130, nominalWatts: 540, inputVoltage: 0, outputVoltage: 230,
      batteryVoltage: 13.1, lastTransfer: 'Low line voltage', transfers: 3, onBatterySeconds: 102 });
    expect(toApcupsd(instance('apcupsd', 1), { STATUS: 'ONLINE LOWBATT REPLACEBATT', MODEL: 'APC Smart-UPS 1500' })).toMatchObject({ power: 'mains', lowBattery: true, replaceBattery: true, manufacturer: 'APC' });
    expect(toApcupsd(instance('apcupsd', 1), { STATUS: 'COMMLOST' })).toMatchObject({ power: 'unknown', offline: true });
    expect(() => toApcupsd(instance('apcupsd', 1), {})).toThrow();
  });
  it('waits for the closing empty record, across TCP chunks', async () => {
    const answer = Buffer.concat([...records.map(frame), Buffer.from([0, 0])]);
    expect(apcRecords(answer.subarray(0, 40))).toBeUndefined();
    const port = await serve((request, socket) => {
      if (request !== '\u0000\u0006status') return;
      // Sent in two pieces, the second after a pause.
      socket.write(answer.subarray(0, 100)); setTimeout(() => socket.end(answer.subarray(100)), 20);
    });
    expect(await collectApcupsd(instance('apcupsd', port))).toMatchObject({ power: 'battery', batteryPercent: 71 });
  });
  it('fails cleanly on a closed port', async () => {
    const port = await serve(() => undefined); servers.splice(0).forEach(server => server.close());
    await expect(collectApcupsd(instance('apcupsd', port))).rejects.toMatchObject({ key: 'widgets.error.network' });
  });
});

describe('time before the automatic shutdown', () => {
  it('takes whichever threshold comes first, at the present load', () => {
    const base = { provider: 'nut' as const, name: 'x', power: 'battery' as const, fetchedAt: 1 };
    // 37 min at 100 %: 35 % of charge is reached after ~24 min, 5 min of runtime after 32 min.
    expect(untilShutdown({ ...base, runtimeSeconds: 2220, batteryPercent: 100, shutdownPercent: 35, shutdownRuntimeSeconds: 300 })).toBe(1443);
    expect(untilShutdown({ ...base, runtimeSeconds: 2220, batteryPercent: 100, shutdownRuntimeSeconds: 300 })).toBe(1920);
    expect(untilShutdown({ ...base, runtimeSeconds: 200, batteryPercent: 30, shutdownPercent: 35, shutdownRuntimeSeconds: 300 })).toBe(0);
    expect(untilShutdown({ ...base, runtimeSeconds: 2220, batteryPercent: 100 })).toBeUndefined();
    expect(untilShutdown({ ...base, batteryPercent: 100, shutdownPercent: 35 })).toBeUndefined();
  });
  it('reads the thresholds from NUT and apcupsd', () => {
    expect(toNut(instance('nut', 1), 'u', { 'ups.status': 'OL', 'battery.charge.low': '35', 'battery.runtime.low': '300' })).toMatchObject({ shutdownPercent: 35, shutdownRuntimeSeconds: 300 });
    expect(toApcupsd(instance('apcupsd', 1), { STATUS: 'ONLINE', MBATTCHG: '5 Percent', MINTIMEL: '3 Minutes' })).toMatchObject({ shutdownPercent: 5, shutdownRuntimeSeconds: 180 });
  });
});

describe('TCP targets', () => {
  it('accepts a host and port, and refuses a pasted URL or a bad port', () => {
    expect(tcpTarget(instance('nut', ''), 3493)).toEqual({ host: '127.0.0.1', port: 3493 });
    expect(tcpTarget(instance('nut', '3494', '[fd00::5]'), 3493)).toEqual({ host: 'fd00::5', port: 3494 });
    for (const [host, port] of [['http://nas.example.com', '3493'], ['nas.example.com/x', ''], ['', ''], ['nas.example.com', '70000'], ['nas.example.com', 'x']]) {
      expect(() => tcpTarget(instance('nut', port, host), 3493)).toThrow();
    }
  });
});
