import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn() }));
import { serviceJson, ServiceError } from '@/lib/widgetData/services';
import { messages } from '@/i18n/messages';
import { WIDGET_DEFINITIONS } from '@/widgets/definitions';
import { WIDGET_VIEWS } from '@/widgets/views';
import { getServiceIntegration } from './registry';
import { KIT_FAMILIES } from './kit';
import { kitServer } from './kitServer';
import { collectSyncthing, toSyncthing } from './syncthing/collect';
import { resultTime, toSpeedtest } from './speedtest/collect';
import { collectWud, toUpdates } from './wud/collect';
import syncthing from './syncthing/samples/service.json';
import results from './speedtest/samples/results.json';
import containers from './wud/samples/containers.json';

const json = vi.mocked(serviceJson);
const source = (type: string, settings: Record<string, string> = {}, secrets: Record<string, string> = {}): IntegrationInstance => ({ id: `${type}-1`, type, name: 'Fictional', settings: { url: 'http://service.example.com', ...settings }, secrets });
beforeEach(() => vi.resetAllMocks());

describe('integration kit', () => {
  it('gives every family a manifest, a server, a widget, its view and its interface texts in every language', () => {
    for (const family of KIT_FAMILIES) {
      const widget = WIDGET_DEFINITIONS.find(definition => definition.type === family.widget);
      expect(widget, family.widget).toBeDefined();
      expect(WIDGET_VIEWS[family.widget], family.widget).toBeDefined();
      for (const type of family.types) {
        expect(type).toMatch(/^[a-z]+$/);
        expect(getServiceIntegration(type), type).toBeDefined();
        const server = kitServer(type)!;
        expect(server, type).toBeDefined();
        // The demo never reaches a service and invents its own data.
        expect(server.demo(source(type))).toMatchObject({ provider: type, name: 'Fictional' });
      }
      const keys = [
        `integrations.${family.section}`, `integrations.${family.section}Hint`, `integrations.${family.section}Empty`,
        `setup.${family.section}.title`, `setup.${family.section}.connect`, `setup.${family.section}.connectAction`,
        widget!.nameKey, widget!.descriptionKey, ...family.types.map(type => `integrations.info.${type}`),
        ...family.types.flatMap(type => getServiceIntegration(type)!.fields.map(field => field.label)),
      ];
      for (const language of Object.keys(messages) as (keyof typeof messages)[]) {
        for (const key of keys) expect(messages[language][key], `${language}: ${key}`).toBeTruthy();
      }
    }
  });
  it('has no unknown server and no two families on one type', () => {
    expect(kitServer('toString')).toBeUndefined();
    const types = KIT_FAMILIES.flatMap(family => family.types);
    expect(new Set(types).size).toBe(types.length);
  });
});

describe('Syncthing', () => {
  it('reads folders, the other devices and the transfer rate with the API key', async () => {
    json.mockImplementation(async (_instance, path) => {
      if (path.startsWith('/rest/db/status?folder=')) return (syncthing.folderStatus as Record<string, unknown>)[decodeURIComponent(path.split('=')[1])] ?? {};
      return { '/rest/system/status': syncthing.status, '/rest/system/version': syncthing.version, '/rest/config/folders': syncthing.folders, '/rest/config/devices': syncthing.devices, '/rest/system/connections': syncthing.connections }[path];
    });
    const summary = await collectSyncthing(source('syncthing', {}, { apiKey: 'fake-key' }));
    expect(summary).toMatchObject({ provider: 'syncthing', version: 'v2.0.10', uptimeSeconds: 86400 });
    expect(summary.folders).toEqual([
      { id: 'abcd-1234', label: 'Documents', state: 'idle', completion: 100, needBytes: 0, globalBytes: 1000, errors: 0 },
      { id: 'efgh-5678', label: 'Photos', state: 'syncing', completion: 75, needBytes: 1000, globalBytes: 4000, errors: 2 },
      { id: 'ijkl-9012', label: 'ijkl-9012', state: 'paused', completion: 100, needBytes: 0, globalBytes: 0, errors: 0 },
    ]);
    // This device is left out; connected ones first.
    expect(summary.devices).toEqual([{ id: 'LAPTOPX', name: 'laptop', connected: true, paused: false }, { id: 'PHONEXX', name: 'phone', connected: false, paused: false }]);
    for (const [, , options] of json.mock.calls) expect(options?.headers).toEqual({ 'X-API-Key': 'fake-key' });
  });
  it('computes the rate from two readings, never a negative one after a restart', () => {
    const instance = source('syncthing');
    const answers = (inBytesTotal: number) => ({ ...syncthing, folderStatus: syncthing.folderStatus, connections: { ...syncthing.connections, total: { inBytesTotal, outBytesTotal: 0 } } });
    expect(toSyncthing(instance, answers(1_000_000), 1_000)).not.toHaveProperty('inRate');
    expect(toSyncthing(instance, answers(3_000_000), 3_000)).toMatchObject({ inRate: 1_000_000, outRate: 0 });
    expect(toSyncthing(instance, answers(10), 5_000)).not.toHaveProperty('inRate');
  });
  it('fails clearly on something that is not Syncthing', () => {
    expect(() => toSyncthing(source('syncthing'), { status: {}, version: {}, folders: [], devices: [], connections: {}, folderStatus: {} })).toThrow(ServiceError);
  });
});

describe('Speedtest Tracker', () => {
  it('keeps bits per second, the newest finished test and the completed history', () => {
    const now = Date.parse('2026-11-08T10:06:00Z');
    const summary = toSpeedtest(source('speedtest'), results, now);
    expect(summary.latest).toEqual({ at: Date.parse('2026-11-08T10:00:00Z'), downloadBps: 880_000_000, uploadBps: 410_000_000, pingMs: 8.2, jitterMs: 1.3, server: 'Fictional Transit · Amsterdam', isp: 'Example Fibre' });
    // Without the `_bits` fields, bytes per second are turned into bits; a name holding its place is not repeated.
    expect(summary.history.map(result => [result.downloadBps, result.server])).toEqual([[840_000_000, 'Fictional Transit Amsterdam'], [880_000_000, 'Fictional Transit · Amsterdam']]);
    expect(summary.running).toBe(true);
    expect(toSpeedtest(source('speedtest'), results, now + 30 * 60_000).running).toBe(false);
  });
  it('tells a failed latest test, and reads both date formats', () => {
    const failed = { data: [{ ...results.data[2], created_at: '2026-11-08 11:00:00' }, results.data[1]] };
    expect(toSpeedtest(source('speedtest'), failed).latest).toMatchObject({ failed: true });
    expect(resultTime('2026-11-08T10:00:00+01:00')).toBe(Date.parse('2026-11-08T09:00:00Z'));
    expect(resultTime('not a date')).toBeUndefined();
    expect(() => toSpeedtest(source('speedtest'), { message: 'Unauthenticated.' })).toThrow(ServiceError);
  });
});

describe("What's Up Docker", () => {
  it('lists updates, biggest jumps first, with safe links and short digests', async () => {
    json.mockResolvedValue(containers);
    const summary = await collectWud(source('wud', { auth: 'basic', username: 'reader' }, { password: 'fake-password' }));
    expect(summary).toMatchObject({ provider: 'wud', total: 5, errors: 1 });
    expect(summary.updates).toEqual([
      { name: 'postgres', image: 'library/postgres', current: '16.4', latest: '17.2', kind: 'tag', level: 'major' },
      { name: 'jellyfin', image: 'jellyfin/jellyfin', current: '10.10.3', latest: '10.11.0', kind: 'tag', level: 'minor', link: 'https://github.com/jellyfin/jellyfin/releases/tag/v10.11.0' },
      { name: 'Pi-hole', image: 'pihole/pihole', current: '0123456789ab', latest: 'fedcba987654', kind: 'digest' },
    ]);
    expect(json.mock.calls[0][2]?.headers).toEqual({ Authorization: `Basic ${Buffer.from('reader:fake-password').toString('base64')}` });
  });
  it('sends no credentials without authentication and refuses a non-list', () => {
    expect(toUpdates(source('wud'), { data: containers }).total).toBe(5);
    expect(() => toUpdates(source('wud'), { error: 'x' })).toThrow(ServiceError);
  });
});
