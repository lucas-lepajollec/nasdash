import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
import qb from './qbittorrent/samples/service.json';
import tr from './transmission/samples/service.json';
import de from './deluge/samples/service.json';
import sab from './sabnzbd/samples/service.json';
import nzb from './nzbget/samples/service.json';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceBytes: vi.fn() }));
import { serviceBytes, ServiceError } from '@/lib/widgetData/services';
import { clearQbittorrentSessions, collectQbittorrent, qbittorrentRequest, qbittorrentState, toQbittorrent } from './qbittorrent/collect';
import { clearTransmissionSessions, collectTransmission, transmissionRequest, transmissionState, toTransmission } from './transmission/collect';
import { clearDelugeSessions, collectDeluge, delugeState, toDeluge } from './deluge/collect';
import { collectSabnzbd, sabnzbdRequest, sabnzbdState, toSabnzbd } from './sabnzbd/collect';
import { collectNzbget, nzbgetState, toNzbget } from './nzbget/collect';
const instance = (type: string): IntegrationInstance => ({ id: `${type}-fictional`, type, name: 'Fictional downloads', settings: { url: 'https://downloads.example.com', username: 'fictional-user' }, secrets: { password: 'fictional-password', apiKey: 'fictional-key' } });
const bytes = vi.mocked(serviceBytes);
const answer = (value: unknown, status = 200, headers?: Record<string, string | string[]>) => ({ bytes: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)), status, contentType: 'application/json', headers });
beforeEach(() => { vi.resetAllMocks(); clearQbittorrentSessions(); clearTransmissionSessions(); clearDelugeSessions(); });

describe('download client mappings', () => {
  it('maps all five clients with correct units and busy downloads', () => {
    expect(toQbittorrent(instance('qbittorrent'), qb.transfer, qb.mode, qb.torrents, qb.sync)).toMatchObject({ downloadBps: 8000000, uploadBps: 320000, downloadLimitBps: 12000000, altSpeed: true, active: 2, freeBytes: 800000000000, items: [{ progress: 75, state: 'downloading', etaMs: 120000 }, { state: 'seeding', etaMs: undefined }] });
    expect(toTransmission(instance('transmission'), tr.stats, tr.session, tr.torrents)).toMatchObject({ downloadBps: 8000000, uploadBps: 320000, altSpeed: true, downloadLimitBps: 100000, uploadLimitBps: 20000, freeBytes: 800000000000, items: [{ progress: 75, etaMs: 120000 }, { state: 'seeding', etaMs: undefined }] });
    expect(toDeluge(instance('deluge'), de.update, de.free)).toMatchObject({ downloadBps: 8000000, uploadBps: 320000, freeBytes: 800000000000, active: 1, items: [{ progress: 75, state: 'downloading', etaMs: 120000 }] });
    expect(toSabnzbd(instance('sabnzbd'), sab)).toMatchObject({ downloadBps: 1049088, freeBytes: 107911053312, items: [{ progress: 75, state: 'downloading', etaMs: 120000, sizeBytes: 1073741824 }] });
    expect(toNzbget(instance('nzbget'), nzb.status, nzb.groups)).toMatchObject({ downloadBps: 8000000, downloadLimitBps: 12000000, freeBytes: 838860800000, items: [{ progress: 75, state: 'downloading', sizeBytes: 1073741824 }] });
  });
  it.each([
    ['downloading', 'downloading'], ['stalledDL', 'downloading'], ['forcedDL', 'downloading'], ['metaDL', 'downloading'], ['forcedMetaDL', 'downloading'], ['uploading', 'seeding'], ['stalledUP', 'seeding'], ['forcedUP', 'seeding'], ['pausedDL', 'paused'], ['stoppedUP', 'paused'], ['queuedDL', 'queued'], ['queuedUP', 'queued'], ['checkingDL', 'checking'], ['checkingUP', 'checking'], ['checkingResumeData', 'checking'], ['missingFiles', 'error'], ['error', 'error'], ['moving', 'checking'], ['allocating', 'checking'], ['unknown', 'error'],
  ])('maps qBittorrent %s', (raw, expected) => expect(qbittorrentState(raw)).toBe(expected));
  it.each([[0, 'paused'], [1, 'queued'], [2, 'checking'], [3, 'queued'], [4, 'downloading'], [5, 'queued'], [6, 'seeding']])('maps Transmission %s', (raw, expected) => expect(transmissionState(raw)).toBe(expected));
  it.each([['Downloading', 'downloading'], ['Seeding', 'seeding'], ['Paused', 'paused'], ['Queued', 'queued'], ['Checking', 'checking'], ['Error', 'error'], ['Finished', 'completed'], ['Moving', 'checking'], ['Allocating', 'checking']])('maps Deluge %s', (raw, expected) => expect(delugeState(raw)).toBe(expected));
  it.each([['Downloading', 'downloading'], ['Paused', 'paused'], ['Queued', 'queued'], ['Verifying', 'checking'], ['Repairing', 'checking'], ['Extracting', 'checking'], ['Moving', 'checking'], ['Failed', 'error'], ['Completed', 'completed']])('maps SABnzbd %s', (raw, expected) => expect(sabnzbdState(raw)).toBe(expected));
  it.each([['DOWNLOADING', 'downloading'], ['PAUSED', 'paused'], ['QUEUED', 'queued'], ['LOADING_PARS', 'checking'], ['VERIFYING_SOURCES', 'checking'], ['REPAIRING', 'checking'], ['UNPACKING', 'checking'], ['MOVING', 'checking'], ['PP_FINISHED', 'completed'], ['FAILURE', 'error']])('maps NZBGet %s', (raw, expected) => expect(nzbgetState(raw)).toBe(expected));
  it('respects global pauses and does not invent unavailable disk readings', () => {
    expect(toSabnzbd(instance('sabnzbd'), { queue: { ...sab.queue, paused: true } }).items[0].state).toBe('paused');
    expect(toNzbget(instance('nzbget'), { ...nzb.status, DownloadPaused: true }, nzb.groups).items[0].state).toBe('paused');
    expect(toDeluge(instance('deluge'), de.update).freeBytes).toBeUndefined();
    expect(toQbittorrent(instance('qbittorrent'), qb.transfer, 0, qb.torrents).freeBytes).toBeUndefined();
    expect(toTransmission(instance('transmission'), tr.stats, { 'speed-limit-down-enabled': true, 'speed-limit-down': 100 }, tr.torrents)).toMatchObject({ downloadLimitBps: 100000, uploadLimitBps: 0, altSpeed: false });
  });
  it('rejects malformed or unauthenticated success payloads', () => {
    expect(() => toQbittorrent(instance('qbittorrent'), {}, 0, [])).toThrow(ServiceError);
    expect(() => toTransmission(instance('transmission'), {}, {}, {})).toThrow(ServiceError);
    expect(() => toDeluge(instance('deluge'), {})).toThrow(ServiceError);
    expect(() => toSabnzbd(instance('sabnzbd'), { error: 'Invalid API key' })).toThrow(ServiceError);
    expect(() => toNzbget(instance('nzbget'), {}, [])).toThrow(ServiceError);
  });
});

describe('qBittorrent cookie login', () => {
  function mockQb() {
    bytes.mockImplementation(async (_instance, path) => path.endsWith('/auth/login') ? answer('Ok.', 200, { 'set-cookie': ['SID=fictional-session; HttpOnly; Path=/'] }) : path.endsWith('/transfer/info') ? answer(qb.transfer) : path.endsWith('/speedLimitsMode') ? answer(1) : path.includes('/torrents/info?') ? answer(qb.torrents) : answer(qb.sync));
  }
  it('shares login in flight, caches by credential/config identity, and keeps credentials out of URLs', async () => {
    mockQb(); const source = instance('qbittorrent'); await collectQbittorrent(source); await collectQbittorrent(source);
    expect(bytes.mock.calls.filter(([, path]) => path.endsWith('/auth/login'))).toHaveLength(1);
    const [, path, options] = bytes.mock.calls[0];
    expect(path).toBe('/api/v2/auth/login'); expect(options).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'username=fictional-user&password=fictional-password' });
    await qbittorrentRequest({ ...source, secrets: { password: 'changed-password' } }, '/api/v2/transfer/info');
    expect(bytes.mock.calls.filter(([, path]) => path.endsWith('/auth/login'))).toHaveLength(2);
    for (const [, path, options] of bytes.mock.calls) { expect(path).not.toMatch(/fictional-password|fictional-session|fictional-user/); if (!path.endsWith('/auth/login')) expect(options?.headers).toEqual({ Cookie: 'SID=fictional-session' }); }
  });
  it('relogs in once on 403 and propagates a second failure', async () => {
    let logins = 0, requests = 0;
    bytes.mockImplementation(async (_instance, path) => path.endsWith('/auth/login') ? answer('Ok.', 200, { 'set-cookie': [`SID=session-${++logins}; Path=/`] }) : answer({}, ++requests === 1 ? 403 : 200));
    await qbittorrentRequest(instance('qbittorrent'), '/api/v2/transfer/info');
    expect(logins).toBe(2); expect(requests).toBe(2);
    clearQbittorrentSessions(); bytes.mockImplementation(async (_instance, path) => path.endsWith('/auth/login') ? answer('Ok.', 200, { 'set-cookie': ['SID=always-expired; Path=/'] }) : answer({}, 403));
    await expect(qbittorrentRequest(instance('qbittorrent'), '/api/v2/transfer/info')).rejects.toMatchObject({ key: 'integrations.error.authentication' });
    expect(bytes.mock.calls.filter(([, path]) => path.endsWith('/auth/login'))).toHaveLength(4);
  });
  it('rejects login failures without persisting a session', async () => {
    bytes.mockResolvedValue(answer('Fails.'));
    await expect(qbittorrentRequest(instance('qbittorrent'), '/x')).rejects.toMatchObject({ key: 'integrations.error.authentication' });
    expect(bytes).toHaveBeenCalledTimes(1);
  });
});

describe('Transmission RPC negotiation', () => {
  it('handles 409 once, reuses the session id, uses basic headers, and never returns RPC metadata', async () => {
    bytes.mockResolvedValueOnce(answer('', 409, { 'x-transmission-session-id': 'fictional-session' })).mockResolvedValue(answer({ result: 'success', arguments: tr.session }));
    const source = instance('transmission'); expect(await transmissionRequest(source, 'session-get')).toEqual(tr.session); await transmissionRequest(source, 'session-get');
    expect(bytes).toHaveBeenCalledTimes(3); expect(bytes.mock.calls[0][2]?.headers).not.toHaveProperty('X-Transmission-Session-Id');
    expect(bytes.mock.calls[1][2]).toMatchObject({ method: 'POST', headers: { 'X-Transmission-Session-Id': 'fictional-session', Authorization: `Basic ${Buffer.from('fictional-user:fictional-password').toString('base64')}` }, json: { method: 'session-get', arguments: {} } });
    for (const [, path] of bytes.mock.calls) expect(path).toBe('/transmission/rpc');
  });
  it('stops after one retry and rejects a missing negotiation header', async () => {
    bytes.mockResolvedValue(answer('', 409, { 'x-transmission-session-id': 'retry-session' }));
    await expect(transmissionRequest(instance('transmission'), 'session-get')).rejects.toMatchObject({ key: 'widgets.error.http' }); expect(bytes).toHaveBeenCalledTimes(2);
    bytes.mockReset().mockResolvedValue(answer('', 409));
    await expect(transmissionRequest(instance('transmission'), 'session-get')).rejects.toMatchObject({ key: 'widgets.error.parse' }); expect(bytes).toHaveBeenCalledTimes(1);
  });
  it('collects the requested RPC fields without requiring credentials', async () => {
    bytes.mockImplementation(async (_instance, _path, options) => answer({ result: 'success', arguments: (options?.json as { method: string }).method === 'session-stats' ? tr.stats : (options?.json as { method: string }).method === 'session-get' ? tr.session : tr.torrents }));
    expect((await collectTransmission({ ...instance('transmission'), settings: { url: 'http://fixture.example.com' }, secrets: {} })).items).toHaveLength(2);
    expect(bytes.mock.calls[0][2]?.headers).toEqual({});
    expect(bytes.mock.calls[2][2]?.json).toEqual({ method: 'torrent-get', arguments: { fields: ['id', 'name', 'percentDone', 'status', 'rateDownload', 'eta', 'totalSize'] } });
  });
});

describe('Deluge, SABnzbd and NZBGet transports', () => {
  it('logs in to Deluge once and keeps the password in the JSON body and cookie in the header', async () => {
    bytes.mockImplementation(async (_instance, _path, options) => { const method = (options?.json as { method: string }).method; return method === 'auth.login' ? answer({ result: true, error: null }, 200, { 'set-cookie': ['_session_id=fictional-session; Path=/'] }) : answer({ result: method === 'web.update_ui' ? de.update : de.free, error: null }); });
    const result = await collectDeluge(instance('deluge')); await collectDeluge(instance('deluge'));
    expect(result.downloadBps).toBe(8000000); expect(bytes.mock.calls.filter(([, , options]) => (options?.json as { method: string }).method === 'auth.login')).toHaveLength(1);
    expect(bytes.mock.calls[0][2]?.json).toEqual({ method: 'auth.login', params: ['fictional-password'], id: 1 });
    for (const [, path, options] of bytes.mock.calls) { expect(path).toBe('/json'); if ((options?.json as { method: string }).method !== 'auth.login') expect(options?.headers).toEqual({ Cookie: '_session_id=fictional-session' }); }
  });
  it('adds the SABnzbd query key only server-side and returns only picked fields', async () => {
    bytes.mockResolvedValue(answer(sab)); const result = await collectSabnzbd(instance('sabnzbd')); await sabnzbdRequest(instance('sabnzbd'), 'version');
    expect(bytes.mock.calls[0][1]).toBe('/api?mode=queue&output=json&apikey=fictional-key'); expect(bytes.mock.calls[1][1]).toContain('mode=version');
    expect(JSON.stringify(result)).not.toMatch(/fictional-key|downloads.example.com|apikey|password/);
  });
  it('sends NZBGet basic auth in a header, and rejects RPC errors', async () => {
    bytes.mockImplementation(async (_instance, _path, options) => answer({ result: (options?.json as { method: string }).method === 'status' ? nzb.status : nzb.groups }));
    expect((await collectNzbget(instance('nzbget'))).items).toHaveLength(1);
    for (const [, path, options] of bytes.mock.calls) { expect(path).toBe('/jsonrpc'); expect(options?.headers?.Authorization).toMatch(/^Basic /); }
    bytes.mockResolvedValue(answer({ error: { message: 'private upstream error' } }));
    await expect(collectNzbget(instance('nzbget'))).rejects.toMatchObject({ key: 'widgets.error.http' });
  });
});

describe('qBittorrent API key', () => {
  it('sends the key as a bearer header and never logs in', async () => {
    bytes.mockResolvedValue(answer({ dl_info_speed: 0 }));
    const source = { ...instance('qbittorrent'), settings: { url: 'https://downloads.example.com', auth: 'apikey' }, secrets: { apiKey: 'fictional-key' } };
    await qbittorrentRequest(source, '/api/v2/transfer/info');
    expect(bytes).toHaveBeenCalledTimes(1);
    expect(bytes).toHaveBeenCalledWith(source, '/api/v2/transfer/info', { headers: { Authorization: 'Bearer fictional-key' } }, 2 * 1024 * 1024);
  });
  it('reads a refused key as an authentication error', async () => {
    bytes.mockResolvedValue(answer('Forbidden', 403));
    const source = { ...instance('qbittorrent'), settings: { url: 'https://downloads.example.com', auth: 'apikey' }, secrets: { apiKey: 'wrong' } };
    await expect(qbittorrentRequest(source, '/x')).rejects.toMatchObject({ key: 'integrations.error.authentication' });
  });
});
