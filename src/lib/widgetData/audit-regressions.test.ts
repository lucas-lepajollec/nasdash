import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
import { publicJson } from './publicJson';
import { TtlCache } from './cache';
import { pacedJson } from '@/integrations/catalog/shared';

afterEach(() => vi.unstubAllGlobals());

it('bounds chunked public JSON before parsing and cancels an oversized body', async () => {
  const cancel = vi.fn();
  const response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(1025)); }, cancel,
  }));
  await expect(publicJson(response, 1024)).rejects.toMatchObject({ key: 'widgets.error.tooLarge' });
  expect(cancel).toHaveBeenCalledOnce();
  await expect(publicJson(new Response('{bad'))).rejects.toMatchObject({ key: 'widgets.error.parse' });
  expect(await publicJson(Response.json({ ok: true }))).toEqual({ ok: true });
});

it('applies the public response bound to catalogue transport and rejects redirects', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(' '.repeat(2 * 1024 * 1024 + 1)));
  vi.stubGlobal('fetch', fetcher);
  await expect(pacedJson(0).request('https://catalog.example.com')).rejects.toMatchObject({ key: 'widgets.error.tooLarge' });
  expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error', signal: expect.any(AbortSignal) });
});

it('does not restore an invalidated in-flight read after a control action', async () => {
  const cache = new TtlCache<string>(60000);
  let resolve!: (value: string) => void;
  const old = cache.get('instance', () => new Promise<string>(done => { resolve = done; }));
  cache.delete('instance');
  expect(await cache.get('instance', async () => 'paused')).toBe('paused');
  resolve('playing');
  expect(await old).toBe('playing');
  expect(await cache.get('instance', async () => 'unexpected')).toBe('paused');
});

it('bounds pending cache keys as well as completed ones', async () => {
  const cache = new TtlCache<number>(60000, 1);
  let resolve!: (value: number) => void;
  const first = cache.get('first', () => new Promise<number>(done => { resolve = done; }));
  expect(await cache.get('second', async () => 2)).toBe(2);
  resolve(1); await first;
  expect(await cache.get('second', async () => 3)).toBe(2);
});

it('bounds public catalogue concurrency while deduplicated watchlist jobs run', async () => {
  let active = 0, peak = 0;
  vi.stubGlobal('fetch', vi.fn(async () => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    return Response.json({ ok: true });
  }));
  const transport = pacedJson(0);
  await Promise.all(Array.from({ length: 12 }, () => transport.request('https://catalog.example.com')));
  expect(peak).toBe(4);
});
