import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { getDataDirectory, getDataPath } from './dataDirectory';

const previousDataDirectory = process.env.NASDASH_DATA_DIR;
const previousDemoMode = process.env.NASDASH_DEMO_MODE;

afterEach(() => {
  if (previousDataDirectory === undefined) {
    delete process.env.NASDASH_DATA_DIR;
  } else {
    process.env.NASDASH_DATA_DIR = previousDataDirectory;
  }
  if (previousDemoMode === undefined) {
    delete process.env.NASDASH_DEMO_MODE;
  } else {
    process.env.NASDASH_DEMO_MODE = previousDemoMode;
  }
});

describe('data directory', () => {
  it('keeps the historical project data directory by default', () => {
    delete process.env.NASDASH_DATA_DIR;
    delete process.env.NASDASH_DEMO_MODE;
    expect(getDataDirectory()).toBe(path.join(process.cwd(), 'data'));
  });

  it('supports an isolated absolute or relative data directory', () => {
    delete process.env.NASDASH_DEMO_MODE;
    process.env.NASDASH_DATA_DIR = path.join('.e2e', 'data');
    expect(getDataDirectory()).toBe(path.resolve('.e2e', 'data'));
    expect(getDataPath('users.json')).toBe(path.resolve('.e2e', 'data', 'users.json'));
  });

  it('uses tracked fictional fixtures in public demo mode', () => {
    process.env.NASDASH_DATA_DIR = path.join('.e2e', 'must-not-be-used');
    process.env.NASDASH_DEMO_MODE = 'true';
    expect(getDataDirectory()).toBe(path.join(process.cwd(), 'demo', 'fixtures'));
  });
});
