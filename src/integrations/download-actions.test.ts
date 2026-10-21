import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
import type { DownloadClientType } from '@/lib/widgetData/contracts';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceBytes: vi.fn() }));
import { serviceBytes } from '@/lib/widgetData/services';
import { clearQbittorrentSessions } from './qbittorrent/collect';
import { clearTransmissionSessions } from './transmission/collect';
import { clearDelugeSessions } from './deluge/collect';
import { controlDownloadClient, validDownloadItemId } from './downloads/action';
const bytes = vi.mocked(serviceBytes), hash = 'a'.repeat(40);
const source = (type: string): IntegrationInstance => ({ id: type, type, name: 'Fictional downloads', settings: { url: 'https://downloads.example.com', auth: 'apikey' }, secrets: { apiKey: 'fictional-key', password: 'fictional-password' } });
const answer = (value: unknown, status = 200, headers?: Record<string, string | string[]>) => ({ bytes: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)), status, contentType: 'application/json', headers });
beforeEach(() => { vi.resetAllMocks(); clearQbittorrentSessions(); clearTransmissionSessions(); clearDelugeSessions(); });

describe('download action transports', () => {
  it.each(['pause', 'resume'] as const)('sends qBittorrent %s as a POST form, with API-key authentication and all hashes when omitted', async action => {
    bytes.mockResolvedValue(answer(''));
    for (const itemId of [hash, undefined]) {
      await controlDownloadClient(source('qbittorrent'), action, itemId);
      expect(bytes).toHaveBeenLastCalledWith(source('qbittorrent'), `/api/v2/torrents/${action === 'pause' ? 'stop' : 'start'}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Bearer fictional-key' }, body: `hashes=${itemId ?? 'all'}` }, 2 * 1024 * 1024);
    }
  });
  it.each(['pause', 'resume'] as const)('falls back to qBittorrent v4 %s only on 404 and reuses the login session', async action => {
    const instance = source('qbittorrent'); instance.settings.auth = 'password';
    bytes.mockImplementation(async (_instance, path) => path.endsWith('/auth/login') ? answer('Ok.', 200, { 'set-cookie': ['SID=fictional-session; Path=/'] }) : answer('', path.endsWith('/stop') || path.endsWith('/start') ? 404 : 200));
    await controlDownloadClient(instance, action, hash);
    expect(bytes.mock.calls.at(-1)?.slice(1, 3)).toEqual([`/api/v2/torrents/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: 'SID=fictional-session' }, body: `hashes=${hash}` }]);
    expect(bytes.mock.calls.filter(([, path]) => path.endsWith('/auth/login'))).toHaveLength(1);
    bytes.mockReset().mockResolvedValue(answer('', 500));
    await expect(controlDownloadClient(source('qbittorrent'), action)).rejects.toMatchObject({ key: 'widgets.error.http' });
    expect(bytes).toHaveBeenCalledTimes(1);
  });
  it('preserves the POST form when qBittorrent refreshes an expired cookie', async () => {
    const instance = source('qbittorrent'); instance.settings.auth = 'password';
    let logins = 0, actions = 0;
    bytes.mockImplementation(async (_instance, path) => path.endsWith('/auth/login') ? answer('Ok.', 200, { 'set-cookie': [`SID=session-${++logins}; Path=/`] }) : answer('', ++actions === 1 ? 403 : 200));
    await controlDownloadClient(instance, 'pause', hash);
    const requests = bytes.mock.calls.filter(([, path]) => !path.endsWith('/auth/login'));
    expect(logins).toBe(2); expect(requests).toHaveLength(2);
    for (const [, path, options] of requests) {
      expect(path).toBe('/api/v2/torrents/stop');
      expect(options).toMatchObject({ method: 'POST', body: `hashes=${hash}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    }
    expect(requests[1][2]?.headers?.Cookie).toBe('SID=session-2');
  });
  it.each(['pause', 'resume'] as const)('sends Transmission %s ids or omits them for the entire client', async action => {
    bytes.mockResolvedValueOnce(answer('', 409, { 'x-transmission-session-id': 'fictional-session' })).mockResolvedValue(answer({ result: 'success', arguments: {} }));
    for (const itemId of ['71', undefined]) {
      await controlDownloadClient(source('transmission'), action, itemId);
      expect(bytes.mock.calls.at(-1)?.[2]).toMatchObject({ method: 'POST', headers: { 'X-Transmission-Session-Id': 'fictional-session' }, json: { method: action === 'pause' ? 'torrent-stop' : 'torrent-start', arguments: itemId ? { ids: [71] } : {} } });
    }
  });
  it.each(['pause', 'resume'] as const)('sends Deluge %s with a list of torrent hashes or a whole-session command', async action => {
    bytes.mockImplementation(async (_instance, _path, options) => (options?.json as { method: string }).method === 'auth.login' ? answer({ result: true }, 200, { 'set-cookie': ['_session_id=fictional-session; Path=/'] }) : answer({ result: null, error: null }));
    for (const itemId of [hash, undefined]) {
      await controlDownloadClient(source('deluge'), action, itemId);
      expect(bytes.mock.calls.at(-1)?.[2]).toEqual({ method: 'POST', headers: { Cookie: '_session_id=fictional-session' }, json: { method: `core.${action}_${itemId ? 'torrent' : 'session'}`, params: itemId ? [[hash]] : [], id: 1 } });
    }
  });
  it.each(['pause', 'resume'] as const)('sends SABnzbd %s with queue/item parameters or a whole-client mode', async action => {
    bytes.mockResolvedValue(answer({ status: true }));
    for (const itemId of ['SABnzbd_71', undefined]) {
      await controlDownloadClient(source('sabnzbd'), action, itemId);
      const url = new URL(bytes.mock.calls.at(-1)![1], 'https://fixture');
      expect(Object.fromEntries(url.searchParams)).toEqual({ mode: itemId ? 'queue' : action, output: 'json', apikey: 'fictional-key', ...(itemId ? { name: action, value: itemId } : {}) });
    }
    bytes.mockResolvedValue(answer({ status: false, error: 'private' }));
    await expect(controlDownloadClient(source('sabnzbd'), action)).rejects.toMatchObject({ key: 'widgets.error.http' });
  });
  it.each(['pause', 'resume'] as const)('sends NZBGet %s with editqueue or a whole-client command', async action => {
    bytes.mockResolvedValue(answer({ result: true }));
    for (const itemId of ['71', undefined]) {
      await controlDownloadClient(source('nzbget'), action, itemId);
      expect(bytes.mock.calls.at(-1)?.[2]).toMatchObject({ method: 'POST', json: { method: itemId ? 'editqueue' : `${action}download`, params: itemId ? [action === 'pause' ? 'GroupPause' : 'GroupResume', '', [71]] : [], id: 1 } });
    }
    bytes.mockResolvedValue(answer({ result: false }));
    await expect(controlDownloadClient(source('nzbget'), action)).rejects.toMatchObject({ key: 'widgets.error.http' });
  });
});

describe('native id validation', () => {
  it.each<DownloadClientType>(['qbittorrent', 'transmission', 'deluge', 'sabnzbd', 'nzbget'])('rejects malformed %s ids', type => {
    const valid = type === 'qbittorrent' || type === 'deluge' ? hash : type === 'sabnzbd' ? 'SABnzbd_71' : '71';
    expect(validDownloadItemId(type, valid)).toBe(true);
    for (const id of ['', '../private', '-1', '1.5', '1&x=2', null, 71, {}, '9'.repeat(200)]) expect(validDownloadItemId(type, id)).toBe(false);
    if (type === 'qbittorrent' || type === 'deluge') { expect(validDownloadItemId(type, hash.toUpperCase())).toBe(true); expect(validDownloadItemId(type, 'g'.repeat(40))).toBe(false); }
  });
});
