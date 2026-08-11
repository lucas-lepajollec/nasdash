import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { preserveCorruptFile } from './corruptFileRecovery';

describe('corrupt file recovery', () => {
  it('preserves the exact invalid content beside the original file', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-corrupt-'));
    try {
      const configPath = path.join(directory, 'config.json');
      fs.writeFileSync(configPath, '{"broken":', 'utf8');

      const recoveryPath = preserveCorruptFile(configPath, new Date('2026-08-11T15:00:00.000Z'));

      expect(recoveryPath).toBe(`${configPath}.corrupt-2026-08-11T15-00-00-000Z`);
      expect(fs.readFileSync(configPath, 'utf8')).toBe('{"broken":');
      expect(fs.readFileSync(recoveryPath, 'utf8')).toBe('{"broken":');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('never overwrites an existing recovery copy', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-corrupt-'));
    try {
      const configPath = path.join(directory, 'config.json');
      const date = new Date('2026-08-11T15:00:00.000Z');
      fs.writeFileSync(configPath, 'invalid', 'utf8');
      preserveCorruptFile(configPath, date);

      expect(() => preserveCorruptFile(configPath, date)).toThrow();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
