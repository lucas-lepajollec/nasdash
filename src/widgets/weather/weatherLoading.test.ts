import { describe, expect, it } from 'vitest';
import { retryDelay, weatherStatus } from './useWeather';

describe('weather loading', () => {
  it('keeps the last forecast on screen when a refresh fails', () => {
    expect(weatherStatus(true, true)).toEqual({ error: false, stale: true });
    expect(weatherStatus(true, false)).toEqual({ error: true, stale: false });
    expect(weatherStatus(false, true)).toEqual({ error: false, stale: false });
  });
  it('retries soon after a failure, then less often, never waiting for the 30 min refresh', () => {
    expect([0, 1, 2, 3, 9].map(retryDelay)).toEqual([30_000, 120_000, 300_000, 300_000, 300_000]);
  });
});
