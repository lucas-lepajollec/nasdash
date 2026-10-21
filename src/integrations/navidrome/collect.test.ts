import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
import samples from './samples/service.json';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceBytes: vi.fn() }));
import { serviceBytes, ServiceError } from '@/lib/widgetData/services';
import { collectNavidromeHistory, collectNavidromeLibrary, collectNavidromeNowPlaying, collectNavidromeRecent, collectNavidromeTop, navidromeCoverBytes, navidromeRequest, toNavidromeAlbum } from './collect';
const instance: IntegrationInstance = { id: 'music', type: 'navidrome', name: 'Fictional Music', settings: { url: 'https://music.example.com', username: 'alex' }, secrets: { password: 'fictional-password' } };
const bytes = vi.mocked(serviceBytes);
function answer(value: unknown) { return { bytes: Buffer.from(JSON.stringify(value)), status: 200, contentType: 'application/json' }; }
beforeEach(() => {
  vi.resetAllMocks(); vi.useRealTimers();
  bytes.mockImplementation(async (_instance, path) => {
    const url = new URL(path, 'http://fixture'), method = url.pathname.split('/').at(-1);
    const key = method === 'getAlbumList2' ? url.searchParams.get('type') : method;
    return answer(samples[key as keyof typeof samples]);
  });
});

describe('Subsonic transport and mappings', () => {
  it('uses a fresh salt and MD5(password + salt) per request, with credentials only inside the no-redirect transport', async () => {
    await navidromeRequest(instance, 'ping'); await navidromeRequest(instance, 'ping');
    const salts = new Set<string>();
    for (const [source, path, options] of bytes.mock.calls) {
      const query = new URL(path, 'http://fixture').searchParams, salt = query.get('s')!;
      expect(source).toBe(instance); expect(options).toEqual({}); expect(query.get('u')).toBe('alex');
      expect(query.get('t')).toBe(createHash('md5').update('fictional-password' + salt).digest('hex'));
      expect(query.get('v')).toBe('1.16.1'); expect(query.get('c')).toBe('NasDash'); expect(query.get('f')).toBe('json');
      expect(salt).toMatch(/^[a-f0-9]{32}$/); expect(path).not.toContain('fictional-password'); salts.add(salt);
    }
    expect(salts.size).toBe(2);
  });
  it('maps albums, seconds, scan counts, genres, indexed artists, recent history and frequent lists', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    expect((await collectNavidromeRecent(instance, 12)).albums[0]).toMatchObject({ id: 'album-1', title: 'Signals from the Garden', artist: 'The Paper Satellites', trackCount: 10, plays: 24, year: 2025, cover: '/rest/getCoverArt?id=album-1&size=600', addedAt: Date.parse('2026-01-15T12:00:00Z') });
    expect((await collectNavidromeTop(instance, 6)).albums[0].plays).toBe(24);
    expect((await collectNavidromeHistory(instance))[0]).toMatchObject({ id: 'album-2', playedAt: Date.parse('2026-01-14T11:00:00Z') });
    const library = await collectNavidromeLibrary(instance);
    expect(library).toMatchObject({ server: 'navidrome', artists: 2, albums: 2, tracks: 18, weekCount: 1, week: [{ id: 'album-1' }], genres: [{ name: 'Ambient', count: 2 }, { name: 'Electronic', count: 1 }] });
    expect(library.durationMs).toBeUndefined();
    expect(JSON.stringify(library)).not.toMatch(/fictional-password|[?&](u|t|s|v|c|f)=/);
    expect(toNavidromeAlbum({})).toBeUndefined();
  });
  it('only attaches a saved queue for the connected user when the current track matches', async () => {
    const result = await collectNavidromeNowPlaying(instance);
    expect(result.sessions[0]).toMatchObject({ track: { title: 'The Glass Meridian', durationMs: 234000 }, user: 'alex', player: 'Music Web', state: 'playing', next: [{ id: 'track-2', durationMs: 198000 }] });
    expect(result.sessions[1].next).toBeUndefined();
    expect(result.sessions[0].positionMs).toBeUndefined(); // minutesAgo is not a playback position.
    expect(JSON.stringify(result)).not.toMatch(/fictional-password|[?&](u|t|s)=/);
    bytes.mockImplementation(async (_source, path) => answer(path.includes('getPlayQueue') ? { 'subsonic-response': { status: 'ok', playQueue: { current: 'stale', entry: [] } } } : samples.getNowPlaying));
    expect((await collectNavidromeNowPlaying(instance)).sessions[0].next).toBeUndefined();
  });
  it('does not read another account queue and tolerates unsupported queues', async () => {
    const other = { ...instance, settings: { ...instance.settings, username: 'sam' } };
    expect((await collectNavidromeNowPlaying(other)).sessions.every(session => !session.next)).toBe(true);
    expect(bytes.mock.calls.some(([, path]) => path.includes('getPlayQueue'))).toBe(false);
    bytes.mockImplementation(async (_source, path) => { if (path.includes('getPlayQueue')) throw new ServiceError('widgets.error.http'); return answer(samples.getNowPlaying); });
    expect((await collectNavidromeNowPlaying(instance)).sessions[0].next).toBeUndefined();
  });
  it('authenticates cover fetches only at transport time', async () => {
    bytes.mockResolvedValue({ bytes: Buffer.from('raster'), status: 200, contentType: 'image/png' });
    await navidromeCoverBytes(instance, '/rest/getCoverArt?id=album%26x&size=600');
    const query = new URL(bytes.mock.calls[0][1], 'http://fixture').searchParams;
    expect(query.get('id')).toBe('album&x'); expect(query.get('t')).toMatch(/^[a-f0-9]{32}$/);
    expect(() => navidromeCoverBytes(instance, '/rest/getCoverArt?id=a&size=600&t=bad')).toThrow(ServiceError);
  });
  it.each([40, 50, 70])('discards API error messages (%s), even if they echo credentials', async code => {
    bytes.mockResolvedValue(answer({ 'subsonic-response': { status: 'failed', error: { code, message: 'fictional-password /rest/ping?u=alex&t=secret&s=salt' } } }));
    await expect(navidromeRequest(instance, 'ping')).rejects.toMatchObject({ message: code === 70 ? 'widgets.error.http' : 'integrations.error.authentication' });
  });
  it('rejects malformed JSON and missing envelopes instead of forwarding upstream data', async () => {
    bytes.mockResolvedValue({ bytes: Buffer.from('{secret'), status: 200, contentType: 'application/json' });
    await expect(navidromeRequest(instance, 'ping')).rejects.toMatchObject({ key: 'widgets.error.parse' });
    bytes.mockResolvedValue(answer({}));
    await expect(navidromeRequest(instance, 'ping')).rejects.toMatchObject({ key: 'widgets.error.parse' });
  });
});
