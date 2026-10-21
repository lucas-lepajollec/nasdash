import { expect, it, vi } from 'vitest';
import { TtlCache } from './cache';

it('answers an expired value at once within revalidateMs and refreshes it behind', async () => {
  const cache = new TtlCache<number>(1000, 10, 0, 5000);
  await cache.get('k', async () => 1, 0);
  let release!: (value: number) => void;
  const load = vi.fn(() => new Promise<number>(resolve => { release = resolve; }));
  // Expired, still within the revalidation window: the old value, and one refresh started.
  expect(await cache.get('k', load, Date.now() + 2000)).toBe(1);
  expect(await cache.get('k', load, Date.now() + 2000)).toBe(1);
  expect(load).toHaveBeenCalledTimes(1);
  release(2); await Promise.resolve(); await Promise.resolve();
  expect(await cache.get('k', async () => 3)).toBe(2);
});

it('keeps the old value when a background refresh fails, and waits once past the window', async () => {
  const cache = new TtlCache<number>(1000, 10, 0, 5000);
  await cache.get('k', async () => 1, 0);
  const stored = Date.now();
  expect(await cache.get('k', async () => { throw new Error('down'); }, stored + 2000)).toBe(1);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(await cache.get('k', async () => 4, stored + 2000)).toBe(1);
  // Without a revalidation window an expired value is reloaded and awaited.
  const plain = new TtlCache<number>(1000);
  await plain.get('k', async () => 1, 0);
  expect(await plain.get('k', async () => 2, Date.now() + 2000)).toBe(2);
});
