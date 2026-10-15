import { afterEach, expect, it, vi } from 'vitest';
import { fetchBytes, fetchJson, httpUrl, sourceError } from './outbound';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('rejects unsupported protocols and embedded credentials before fetching', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  for (const url of ['file:///etc/passwd', 'https://user:pass@example.com/']) {
    expect(() => httpUrl(url)).toThrow('widgets.error.parse');
    await expect(fetchBytes(url, 10)).rejects.toThrow('widgets.error.parse');
  }
  expect(fetch).not.toHaveBeenCalled();
});
it('follows bounded safe redirects without credentials and identifies http errors', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/next' } })).mockResolvedValueOnce(new Response('OK'));
  vi.stubGlobal('fetch', fetch);
  expect(new TextDecoder().decode((await fetchBytes('https://example.com/', 20)).bytes)).toBe('OK');
  expect(String(fetch.mock.calls[1][0])).toBe('https://example.com/next');
  expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'omit', redirect: 'manual', headers: { 'User-Agent': expect.stringContaining('NasDash') } });
  fetch.mockImplementation(async () => new Response(null, { status: 302, headers: { location: 'http://example.com/' } }));
  await expect(fetchBytes('https://example.com/', 20)).rejects.toThrow('widgets.error.http');
  fetch.mockImplementation(async () => new Response(null, { status: 302, headers: { location: 'file:///secret' } }));
  await expect(fetchBytes('https://example.com/', 20)).rejects.toThrow('widgets.error.parse');
});
it('bounds declared and streamed bodies and maps parse/network errors', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response('large', { headers: { 'content-length': '100' } })).mockResolvedValueOnce(new Response('large')).mockResolvedValueOnce(new Response('invalid json')).mockRejectedValueOnce(new Error('secret URL'));
  vi.stubGlobal('fetch', fetch);
  await expect(fetchBytes('https://example.com/', 2)).rejects.toThrow('widgets.error.tooLarge');
  await expect(fetchBytes('https://example.com/', 2)).rejects.toThrow('widgets.error.tooLarge');
  await expect(fetchJson('https://example.com/')).rejects.toThrow('widgets.error.parse');
  await expect(fetchBytes('https://example.com/', 20)).rejects.toThrow('widgets.error.network');
  expect(sourceError('source', new Error('secret'))).toEqual({ source: 'source', error: 'widgets.error.network' });
});
it('keeps the deadline active for streamed body reads', async () => {
  vi.useFakeTimers();
  const stream = new ReadableStream({ start() { /* Never completes. */ } });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(stream)));
  const pending = fetchBytes('https://example.com/', 20);
  const assertion = expect(pending).rejects.toThrow('widgets.error.timeout');
  await vi.advanceTimersByTimeAsync(8000);
  await assertion;
});
