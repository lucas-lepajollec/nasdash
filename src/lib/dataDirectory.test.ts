import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { getDataDirectory, getDataPath } from './dataDirectory';

const previousDataDirectory = process.env.NASDASH_DATA_DIR;

afterEach(() => {
  if (previousDataDirectory === undefined) {
    delete process.env.NASDASH_DATA_DIR;
  } else {
    process.env.NASDASH_DATA_DIR = previousDataDirectory;
  }
});

describe('data directory', () => {
  it('keeps the historical project data directory by default', () => {
    delete process.env.NASDASH_DATA_DIR;
    expect(getDataDirectory()).toBe(path.join(process.cwd(), 'data'));
  });

  it('supports an isolated absolute or relative data directory', () => {
    process.env.NASDASH_DATA_DIR = path.join('.e2e', 'data');
    expect(getDataDirectory()).toBe(path.resolve('.e2e', 'data'));
    expect(getDataPath('users.json')).toBe(path.resolve('.e2e', 'data', 'users.json'));
  });
});
