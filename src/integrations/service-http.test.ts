import { EventEmitter } from 'node:events';
import http from 'node:http';
import https from 'node:https';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
vi.mock('@/lib/config', () => ({ readConfig: vi.fn(() => ({ integrations: [] })) }));
vi.mock('@/integrations/http', async original => ({ ...await original<typeof import('@/integrations/http')>(), httpRequest: vi.fn() }));
import { httpRequest } from './http';
import { boundedJson, serviceBytes, serviceJson, ServiceError } from '@/lib/widgetData/services';
const source: IntegrationInstance = { id: 'fixture-transport', type: 'pihole', name: 'Fictional DNS', settings: { url: 'https://fixture.example.com', allowSelfSigned: 'true' }, secrets: { password: 'fake-password' } };
let nextStatus = 200, payload = Buffer.from('{"ok":true}'), delay = false;
let sentOptions: https.RequestOptions, sentBody: unknown, sentUrl: URL;
function fakeRequest(url: URL, options: https.RequestOptions, callback: (response: EventEmitter) => void) {
  sentUrl = url; sentOptions = options;
  const req = new EventEmitter() as EventEmitter & { end(body: unknown): void; destroy(error: Error): void };
  req.destroy = error => { req.emit('error', error); req.emit('close'); };
  req.end = body => {
    sentBody = body;
    if (delay) return;
    queueMicrotask(() => {
      const response = Object.assign(new EventEmitter(), { statusCode: nextStatus, headers: { 'content-type': 'application/json' } });
      callback(response); response.emit('data', payload); response.emit('end'); req.emit('close');
    });
  };
  return req as unknown as http.ClientRequest;
}
beforeEach(() => {
  nextStatus = 200; payload = Buffer.from('{"ok":true}'); delay = false;
  vi.spyOn(https, 'request').mockImplementation(fakeRequest as typeof https.request);
  vi.spyOn(http, 'request').mockImplementation(fakeRequest as typeof http.request);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.mocked(httpRequest).mockReset(); });
it('uses bounded, no-redirect transport for JSON bodies, including credentials', async () => {
  expect(await serviceJson(source, '/api/auth', { method: 'POST', json: { password: 'fake-password' } })).toEqual({ ok: true });
  expect(httpRequest).not.toHaveBeenCalled();
  expect(sentOptions).toMatchObject({ method: 'POST', rejectUnauthorized: false });
  expect(sentBody).toBe('{"password":"fake-password"}');
});
it.each(['x-nd-authorization', 'X-Custom-Token', 'Accept', 'X-FTL-SID', 'x-api-key', 'X-Emby-Token', 'X-Plex-Token', 'x-emby-token', 'x-plex-token', 'X-Transmission-Session-Id', 'cookie', 'Authorization'])('keeps %s on a transport that never follows redirects', async header => {
  nextStatus = 302;
  await expect(serviceJson(source, '/api/stats/summary', { headers: { [header]: 'fictional-sid' } })).rejects.toMatchObject({ key: 'widgets.error.http', parameters: { status: 302 } });
  expect(httpRequest).not.toHaveBeenCalled();
  expect(https.request).toHaveBeenCalledTimes(1);
  expect(sentUrl.origin).toBe('https://fixture.example.com');
  expect(sentOptions).toMatchObject({ rejectUnauthorized: false, headers: { [header]: 'fictional-sid' } });
});
it('enforces certificate checks unless explicitly opted in, and serializes bounded toggle bodies', async () => {
  await serviceBytes({ ...source, settings: { ...source.settings, allowSelfSigned: 'false' } }, '/api/dns/blocking', { method: 'POST', json: { blocking: false, timer: 60 } });
  expect(sentOptions.rejectUnauthorized).toBe(true);
  expect(sentBody).toBe('{"blocking":false,"timer":60}');
});
it('stops image responses larger than 8 MiB and custom-header JSON larger than 2 MiB', async () => {
  payload = Buffer.alloc(8 * 1024 * 1024 + 1);
  await expect(serviceBytes(source, '/image')).rejects.toMatchObject({ key: 'widgets.error.tooLarge' });
  payload = Buffer.alloc(2 * 1024 * 1024 + 1);
  await expect(serviceJson(source, '/api/stats/summary', { headers: { 'X-FTL-SID': 'fictional-sid' } })).rejects.toMatchObject({ key: 'widgets.error.tooLarge' });
});
it('uses a total request deadline of at most 6 seconds', async () => {
  vi.useFakeTimers(); delay = true;
  const result = serviceBytes(source, '/image', { timeoutMs: 60000 });
  const assertion = expect(result).rejects.toMatchObject({ key: 'widgets.error.timeout', status: 504 });
  await vi.advanceTimersByTimeAsync(6000);
  await assertion;
});
it('rejects non-HTTP URLs, embedded credentials, invalid JSON and oversized inbound bodies', async () => {
  await expect(serviceBytes({ ...source, settings: { url: 'file:///etc/passwd' } }, '/x')).rejects.toBeInstanceOf(ServiceError);
  await expect(serviceBytes({ ...source, settings: { url: 'http://user:password@example.com' } }, '/x')).rejects.toBeInstanceOf(ServiceError);
  payload = Buffer.from('<html>');
  await expect(serviceJson(source, '/x', { headers: { 'x-api-key': 'fake-key' } })).rejects.toMatchObject({ key: 'widgets.error.parse' });
  await expect(boundedJson(new Request('http://fictional', { method: 'POST', body: 'x'.repeat(17000) }))).rejects.toMatchObject({ status: 400 });
  await expect(boundedJson(new Request('http://fictional', { method: 'POST', body: 'null' }))).rejects.toMatchObject({ status: 400 });
});
it('names its client (some APIs refuse anonymous requests), unless the caller sets its own', async () => {
  await serviceBytes(source, '/api/status');
  expect(sentOptions.headers).toMatchObject({ 'User-Agent': 'NasDash' });
  await serviceBytes(source, '/api/status', { headers: { 'User-Agent': 'Custom' } });
  expect(sentOptions.headers).toMatchObject({ 'User-Agent': 'Custom' });
});
