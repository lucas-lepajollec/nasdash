import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn(), serviceBytes: vi.fn() }));
import { serviceBytes, serviceJson, ServiceError } from '@/lib/widgetData/services';
import { collectUptime, slugOf, toUptime } from './uptimekuma/collect';
import { collectSeerr, requestStatus, seerrKit } from './seerr/collect';
import { ntfyKit, toNtfy, topicsOf } from './ntfy/collect';
import { priorityOf, toGotify } from './gotify/collect';
import { audiobookshelfKit, toItem } from './audiobookshelf/collect';
import { kavitaKit, toSeries } from './kavita/collect';
import { komgaKit, toBook } from './komga/collect';
import uptime from './uptimekuma/samples/service.json';
import seerr from './seerr/samples/service.json';
import ntfy from './ntfy/samples/service.json';
import gotify from './gotify/samples/service.json';

const json = vi.mocked(serviceJson), bytes = vi.mocked(serviceBytes);
const source = (type: string, settings: Record<string, string> = {}, secrets: Record<string, string> = { apiKey: 'fake-key', token: 'fake-token' }): IntegrationInstance => ({ id: `${type}-1`, type, name: 'Fictional', settings: { url: 'http://service.example.com', ...settings }, secrets });
beforeEach(() => vi.resetAllMocks());

describe('Uptime Kuma', () => {
  it('reads monitors, states, beats and 24-hour uptime from a status page, without credentials', async () => {
    json.mockImplementation(async (_instance, path) => path.includes('/heartbeat/') ? uptime.heartbeat : uptime.page);
    const summary = await collectUptime(source('uptimekuma', { slug: 'Homelab' }, {}));
    expect(json.mock.calls.map(([, path]) => path).sort()).toEqual(['/api/status-page/heartbeat/homelab', '/api/status-page/homelab']);
    expect(summary.title).toBe('Homelab');
    expect(summary.groups).toEqual([{ name: 'Services', monitors: [
      { id: '3', name: 'Jellyfin', status: 'up', uptime: 100, ping: 42, beats: ['up', 'up'], url: 'https://jellyfin.example.com' },
      // A failed check has no ping, and the address is kept private when the page does not show it.
      { id: '4', name: 'Immich', status: 'down', uptime: 96.54, beats: ['up', 'down'] },
      // No beat yet; a javascript: address is dropped.
      { id: '7', name: 'Old box', status: 'unknown', beats: [] },
    ] }]);
  });
  it('refuses a slug that is not one and a page that is not Uptime Kuma', () => {
    expect(() => slugOf(source('uptimekuma', { slug: '../admin' }))).toThrow(ServiceError);
    expect(() => toUptime(source('uptimekuma'), { error: 'x' }, {})).toThrow(ServiceError);
  });
});

describe('Seerr', () => {
  it('reads counts and requests with titles and TMDB posters, the API key in a header', async () => {
    json.mockImplementation(async (_instance, path) => ({ '/api/v1/request/count': seerr.count, '/api/v1/movie/101': seerr.movie101, '/api/v1/tv/202': seerr.tv202, '/api/v1/movie/303': seerr.movie303 } as Record<string, unknown>)[path] ?? (path.startsWith('/api/v1/request?') ? seerr.requests : {}));
    const summary = await collectSeerr(source('seerr'));
    expect(summary.counts).toEqual({ total: 12, pending: 2, approved: 3, processing: 2, available: 6, declined: 1 });
    expect(summary.requests.map(request => [request.id, request.title, request.kind, request.year, request.poster, request.requestedBy, request.status])).toEqual([
      ['41', 'The Quiet Orbit', 'movie', 2026, 'https://image.tmdb.org/t/p/w185/quiet.jpg', 'Alex', 'pending'],
      ['40', 'Harbour Lights', 'tv', 2025, undefined, 'sam', 'processing'],
      ['39', 'Northbound', 'movie', 2024, undefined, undefined, 'available'],
    ]);
    for (const [, , options] of json.mock.calls) expect(options?.headers).toEqual({ 'X-Api-Key': 'fake-key' });
  });
  it('maps statuses and approves only a request Seerr lists as pending', async () => {
    expect(requestStatus({ status: 3, media: { status: 5 } })).toBe('declined');
    expect(requestStatus({ status: 2, media: { status: 2 } })).toBe('approved');
    json.mockImplementation(async (_instance, path) => path.includes('filter=pending') ? { results: [{ id: 41 }] } : {});
    await expect(seerrKit.actions!.approve.run(source('seerr'), '40')).rejects.toMatchObject({ key: 'widgets.requests.error.notPending' });
    await expect(seerrKit.actions!.decline.run(source('seerr'), '../1')).rejects.toMatchObject({ key: 'widgets.error.invalidRequest' });
    await seerrKit.actions!.approve.run(source('seerr'), '41');
    expect(json.mock.calls.at(-1)?.[1]).toBe('/api/v1/request/41/approve');
    expect(json.mock.calls.at(-1)?.[2]).toMatchObject({ method: 'POST' });
  });
});

describe('ntfy and Gotify', () => {
  it('keeps messages only, newest first, safe links, and asks with the token', async () => {
    const summary = toNtfy(source('ntfy', { topics: 'backups, alerts' }), ntfy.lines.join('\n'));
    expect(summary.messages.map(message => [message.id, message.source, message.priority, message.link])).toEqual([['m2', 'alerts', 5, undefined], ['m1', 'backups', 3, 'https://backup.example.com']]);
    bytes.mockResolvedValue({ bytes: Buffer.from(ntfy.lines.join('\n')), contentType: 'application/x-ndjson', status: 200 });
    await ntfyKit.collect(source('ntfy', { topics: 'backups, alerts' }, { token: 'tk_fake' }));
    expect(bytes.mock.calls[0][1]).toBe('/backups,alerts/json?poll=1&since=24h');
    expect(bytes.mock.calls[0][2]?.headers).toEqual({ Authorization: 'Bearer tk_fake' });
    expect(() => topicsOf(source('ntfy', { topics: 'a/b' }))).toThrow(ServiceError);
  });
  it('names Gotify messages after their application and maps priorities', () => {
    const summary = toGotify(source('gotify'), gotify.messages, gotify.applications);
    expect(summary.messages.map(message => [message.source, message.priority, message.link])).toEqual([['Monitoring', 4, undefined], ['Backups', 3, 'https://backup.example.com']]);
    expect([0, 2, 5, 8, 10].map(priorityOf)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('Reading servers', () => {
  it('maps Audiobookshelf, Kavita and Komga items with progress and cover ids', () => {
    expect(toItem({ id: 'li_1', mediaType: 'book', media: { metadata: { title: 'Salt', authorName: 'J. Okafor' } } }, new Map([['li_1', 0.4349]]))).toEqual({ id: 'li_1', title: 'Salt', subtitle: 'J. Okafor', kind: 'audiobook', progress: 43.5, cover: 'abs-li_1' });
    expect(toSeries({ id: 7, name: 'Saga', libraryName: 'Comics', format: 1, pages: 200, pagesRead: 50 })).toEqual({ id: '7', title: 'Saga', subtitle: 'Comics', kind: 'comic', progress: 25, cover: 'kavita-7' });
    expect(toBook({ id: 'B1', name: 'Vol 1', seriesTitle: 'Saga', media: { pagesCount: 40 }, readProgress: { page: 10, completed: false }, metadata: { title: 'Volume 1' } })).toEqual({ id: 'B1', title: 'Volume 1', subtitle: 'Saga', kind: 'comic', progress: 25, cover: 'komga-B1' });
    expect(toBook({ id: '../x' })).toBeUndefined();
  });
  it('serves only covers its own answers listed, with the connection credentials', async () => {
    json.mockImplementation(async (_instance, path) => path === '/api/v1/books/latest?size=12' ? { content: [{ id: 'B1', name: 'Vol 1' }] } : { content: [] });
    bytes.mockResolvedValue({ bytes: Buffer.from('img'), contentType: 'image/jpeg', status: 200 });
    const instance = source('komga');
    await expect(komgaKit.image!(instance, 'komga-B1')).rejects.toMatchObject({ key: 'widgets.error.notFound' });
    await komgaKit.collect(instance);
    expect(await komgaKit.image!(instance, 'komga-B1')).toMatchObject({ contentType: 'image/jpeg' });
    expect(bytes.mock.calls[0][1]).toBe('/api/v1/books/B1/thumbnail');
    expect(bytes.mock.calls[0][2]?.headers).toEqual({ 'X-API-Key': 'fake-key' });
    await expect(audiobookshelfKit.image!(instance, 'abs-li_1')).rejects.toMatchObject({ key: 'widgets.error.notFound' });
    await expect(kavitaKit.image!(instance, 'kavita-7')).rejects.toMatchObject({ key: 'widgets.error.notFound' });
  });
});
