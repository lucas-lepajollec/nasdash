import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDataBackup, getDefaultDataDirectory, restoreDataBackup } from './data-snapshot.mjs';

const previousDataDirectory = process.env.NASDASH_DATA_DIR;

afterEach(() => {
  if (previousDataDirectory === undefined) delete process.env.NASDASH_DATA_DIR;
  else process.env.NASDASH_DATA_DIR = previousDataDirectory;
});

function withTemporaryDirectory(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-snapshot-'));
  try {
    run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

describe('data backup and restore', () => {
  it('uses the configured isolated data directory by default', () => {
    process.env.NASDASH_DATA_DIR = path.join('.e2e', 'backup-target');
    expect(getDefaultDataDirectory()).toBe(path.resolve('.e2e', 'backup-target'));
  });

  it('backs up and restores JSON, secrets, and uploaded logos', () => {
    withTemporaryDirectory(directory => {
      const data = path.join(directory, 'data');
      const backup = path.join(directory, 'backup');
      fs.mkdirSync(path.join(data, 'logos'), { recursive: true });
      fs.writeFileSync(path.join(data, 'config.json'), '{"title":"before"}', 'utf8');
      fs.writeFileSync(path.join(data, 'jwt.secret'), 'local-secret', 'utf8');
      fs.writeFileSync(path.join(data, 'logos', 'nas.png'), 'fake-image', 'utf8');

      createDataBackup({ source: data, output: backup, appVersion: '0.1.0' });
      fs.writeFileSync(path.join(data, 'config.json'), '{"title":"after"}', 'utf8');
      const result = restoreDataBackup({ backup, target: data, force: true });

      expect(fs.readFileSync(path.join(data, 'config.json'), 'utf8')).toContain('before');
      expect(fs.readFileSync(path.join(data, 'jwt.secret'), 'utf8')).toBe('local-secret');
      expect(fs.readFileSync(path.join(data, 'logos', 'nas.png'), 'utf8')).toBe('fake-image');
      expect(result.recovery).not.toBeNull();
      expect(fs.readFileSync(path.join(result.recovery, 'config.json'), 'utf8')).toContain('after');
    });
  });

  it('refuses to overwrite data without explicit confirmation', () => {
    expect(() => restoreDataBackup({ backup: 'backup', target: 'data' })).toThrow('--force');
  });
});
