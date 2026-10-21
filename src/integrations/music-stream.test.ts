import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import http from 'node:http';
import https from 'node:https';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
import { serviceStream } from '@/lib/widgetData/services';
const instance: IntegrationInstance = { id: 'audio', type: 'jellyfin', name: 'Fictional Music', settings: { url: 'https://music.example.com', allowSelfSigned: 'true' } };
let status: number, responseHeaders: Record<string, string>, upstream: PassThrough, request: EventEmitter & { destroy(error?: Error): void; end(): void; setTimeout: ReturnType<typeof vi.fn> }, options: https.RequestOptions, sentUrl: URL, noHeaders: boolean;
beforeEach(() => {
  status = 206; responseHeaders = { 'content-type': 'audio/flac', 'content-length': '2', 'content-range': 'bytes 2-3/100', 'accept-ranges': 'bytes', location: 'https://secret.example.com/token', 'x-plex-token': 'secret', 'set-cookie': 'credential', 'content-disposition': 'https://secret.example.com' }; noHeaders = false;
  const fake = (url: URL, opts: https.RequestOptions) => {
    sentUrl = url; options = opts;
    request = Object.assign(new EventEmitter(), {
      end() { if (!noHeaders) queueMicrotask(() => { upstream = Object.assign(new PassThrough(), { statusCode: status, headers: responseHeaders }); request.emit('response', upstream); }); },
      destroy(error?: Error) { if (error) { request.emit('error', error); upstream?.destroy(error); } request.emit('close'); },
      setTimeout: vi.fn(),
    });
    return request as unknown as http.ClientRequest;
  };
  vi.spyOn(https, 'request').mockImplementation(fake as typeof https.request); vi.spyOn(http, 'request').mockImplementation(fake as typeof http.request);
});
afterEach(() => { upstream?.destroy(); vi.restoreAllMocks(); vi.useRealTimers(); });
it('returns headers before the body completes, preserves 206 ranges, TLS options and only safe headers', async () => {
  const response = await serviceStream(instance, '/Audio/song/universal', { Range: 'bytes=2-3', 'X-Emby-Token': 'fictional-key' });
  expect(response.status).toBe(206); expect(response.headers.get('content-range')).toBe('bytes 2-3/100'); expect(response.headers.get('accept-ranges')).toBe('bytes'); expect(response.headers.get('content-length')).toBe('2');
  expect([...response.headers.keys()].sort()).toEqual(['accept-ranges', 'cache-control', 'content-length', 'content-range', 'content-type', 'x-content-type-options']);
  expect(options).toMatchObject({ rejectUnauthorized: false, headers: { Range: 'bytes=2-3', 'X-Emby-Token': 'fictional-key' } }); expect(sentUrl.origin).toBe('https://music.example.com');
  const reader = response.body!.getReader(); upstream.write(Buffer.from([1])); expect((await reader.read()).value).toEqual(new Uint8Array([1]));
  upstream.end(Buffer.from([2])); expect((await reader.read()).value).toEqual(new Uint8Array([2])); expect((await reader.read()).done).toBe(true);
});
it('does not impose the image byte cap on complete audio responses', async () => {
  status = 200; responseHeaders = { 'content-type': 'audio/mpeg' };
  const response = await serviceStream({ ...instance, settings: { url: 'http://music.example.com' } }, '/track', {});
  expect(options.rejectUnauthorized).toBe(true); expect(http.request).toHaveBeenCalled();
  upstream.end(Buffer.alloc(9 * 1024 * 1024)); expect((await response.arrayBuffer()).byteLength).toBe(9 * 1024 * 1024); expect(response.status).toBe(200);
});
it('cancels the upstream when the browser cancels the stream', async () => {
  const response = await serviceStream(instance, '/track', {}); await response.body!.cancel(); expect(upstream.destroyed).toBe(true);
});
it.each([302, 401, 403, 500])('rejects upstream status %s without following or exposing redirects', async value => {
  status = value; await expect(serviceStream(instance, '/track', { 'X-Emby-Token': 'fictional-key' })).rejects.toMatchObject({ key: value === 401 || value === 403 ? 'integrations.error.authentication' : 'widgets.error.http' });
  expect(https.request).toHaveBeenCalledTimes(1); expect(upstream.destroyed).toBe(true);
});
it.each(['text/html', 'application/json', 'audio/flac; url=https://secret.example.com'])('validates or strips unsafe content type details (%s)', async value => {
  responseHeaders['content-type'] = value;
  if (value.startsWith('audio/')) { const response = await serviceStream(instance, '/track', {}); expect(response.headers.get('content-type')).toBe('audio/flac'); await response.body!.cancel(); }
  else await expect(serviceStream(instance, '/track', {})).rejects.toMatchObject({ key: 'widgets.error.parse' });
});
it('rejects malformed content-range and relays bounded 416 metadata only', async () => {
  responseHeaders['content-range'] = 'https://secret.example.com'; await expect(serviceStream(instance, '/track', {})).rejects.toMatchObject({ key: 'widgets.error.parse' });
  status = 416; responseHeaders['content-range'] = 'bytes */100'; const response = await serviceStream(instance, '/track', {}); expect(response.status).toBe(416); expect(response.headers.get('content-range')).toBe('bytes */100'); expect(response.headers.get('location')).toBeNull();
});
it('enforces a header deadline, socket idle timeout and request cancellation', async () => {
  vi.useFakeTimers(); noHeaders = true;
  const result = serviceStream(instance, '/track', {}); const failure = expect(result).rejects.toMatchObject({ key: 'widgets.error.timeout', status: 504 });
  await vi.advanceTimersByTimeAsync(6000); await failure;
  expect(request.setTimeout).toHaveBeenCalledWith(30000, expect.any(Function));
  const controller = new AbortController(), aborted = serviceStream(instance, '/track', {}, controller.signal);
  const abortFailure = expect(aborted).rejects.toMatchObject({ key: 'widgets.error.timeout' }); controller.abort(); await abortFailure;
});
