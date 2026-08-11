import { afterEach, describe, expect, it } from 'vitest';
import { isDemoMode } from './demoMode';

const originalRuntimeValue = process.env.NASDASH_DEMO_MODE;

afterEach(() => {
  if (originalRuntimeValue === undefined) delete process.env.NASDASH_DEMO_MODE;
  else process.env.NASDASH_DEMO_MODE = originalRuntimeValue;
});

describe('public demo mode', () => {
  it('is disabled by default', () => {
    delete process.env.NASDASH_DEMO_MODE;
    expect(isDemoMode()).toBe(false);
  });

  it('can be enabled at server runtime', () => {
    process.env.NASDASH_DEMO_MODE = 'true';
    expect(isDemoMode()).toBe(true);
  });
});
