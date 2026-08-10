import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { safeWriteFileSync } from './config';

function withTemporaryDirectory(run: (directory: string) => void) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-persistence-'));
  try {
    run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

describe('atomic JSON persistence', () => {
  it('replaces an existing file without leaving a temporary file', () => {
    withTemporaryDirectory(directory => {
      const target = path.join(directory, 'config.json');
      fs.writeFileSync(target, 'old', 'utf8');

      safeWriteFileSync(target, 'new', 'utf8');

      expect(fs.readFileSync(target, 'utf8')).toBe('new');
      expect(fs.readdirSync(directory)).toEqual(['config.json']);
    });
  });

  it('cleans its temporary file when the final rename fails', () => {
    withTemporaryDirectory(directory => {
      const targetDirectory = path.join(directory, 'occupied');
      fs.mkdirSync(targetDirectory);

      expect(() => safeWriteFileSync(targetDirectory, 'data', 'utf8')).toThrow();
      expect(fs.readdirSync(directory)).toEqual(['occupied']);
    });
  });
});
