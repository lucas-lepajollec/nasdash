import { afterEach, describe, expect, it } from 'vitest';
import robots from './robots';

const originalRuntimeValue = process.env.NASDASH_DEMO_MODE;

afterEach(() => {
  if (originalRuntimeValue === undefined) delete process.env.NASDASH_DEMO_MODE;
  else process.env.NASDASH_DEMO_MODE = originalRuntimeValue;
});

describe('robots route', () => {
  it('allows indexing for a normal self-hosted instance', () => {
    delete process.env.NASDASH_DEMO_MODE;
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/' },
    });
  });

  it('blocks indexing for the public demo', () => {
    process.env.NASDASH_DEMO_MODE = 'true';
    expect(robots()).toEqual({
      rules: { userAgent: '*', disallow: '/' },
    });
  });
});
