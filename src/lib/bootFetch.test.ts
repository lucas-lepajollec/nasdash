import { afterEach, describe, expect, it } from 'vitest';
import { takeBoot } from './bootFetch';

const host = globalThis as unknown as { window?: { __ndBoot?: unknown } };

describe('takeBoot', () => {
  afterEach(() => { delete host.window; });

  it('hands an early request over once', () => {
    const request = Promise.resolve(new Response('{}'));
    host.window = { __ndBoot: { at: Date.now(), requests: { '/api/config': request } } };
    expect(takeBoot('/api/config')).toBe(request);
    expect(takeBoot('/api/config')).toBeUndefined();
  });

  it('ignores a stale one and works without any', () => {
    host.window = { __ndBoot: { at: Date.now() - 60_000, requests: { '/api/pages': Promise.resolve(new Response('{}')) } } };
    expect(takeBoot('/api/pages')).toBeUndefined();
    delete host.window;
    expect(takeBoot('/api/pages')).toBeUndefined();
  });
});
