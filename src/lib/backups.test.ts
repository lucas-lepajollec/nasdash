import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { backupPath, createBackup, deleteBackup, isBackupDue, isBackupName, listBackups, pruneAutomaticBackups } from './backups';

const directories: string[] = [];
function dataDirectory() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-backups-'));
  directories.push(dir);
  fs.writeFileSync(path.join(dir, 'config.json'), '{"title":"test"}');
  fs.writeFileSync(path.join(dir, 'encryption.key'), 'key');
  fs.mkdirSync(path.join(dir, 'logos'));
  fs.writeFileSync(path.join(dir, 'logos', 'a.png'), Buffer.from([1, 2, 3]));
  return dir;
}
afterEach(() => { for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

describe('backups', () => {
  it('writes a tar.gz laid out like data:backup, without the backups folder', () => {
    const dir = dataDirectory();
    const first = createBackup({ dataDirectory: dir, now: new Date('2026-09-26T10:00:00.000Z') });
    const second = createBackup({ dataDirectory: dir, now: new Date('2026-09-26T11:00:00.000Z') });
    const listing = execFileSync('tar', ['-tzf', backupPath(second.name, dir)!], { encoding: 'utf8' }).split('\n').filter(Boolean).sort();
    expect(listing).toEqual(['data/config.json', 'data/encryption.key', 'data/logos/a.png', 'nasdash-backup.json']);
    expect(first.name).toBe('nasdash-backup-2026-09-26T10-00-00-000Z.tar.gz');
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-extract-'));
    directories.push(out);
    execFileSync('tar', ['-xzf', backupPath(second.name, dir)!, '-C', out]);
    expect(fs.readFileSync(path.join(out, 'data', 'config.json'), 'utf8')).toBe('{"title":"test"}');
    expect(JSON.parse(fs.readFileSync(path.join(out, 'nasdash-backup.json'), 'utf8')).formatVersion).toBe(1);
  });

  it('keeps the newest automatic backups only, never the manual ones', () => {
    const dir = dataDirectory();
    createBackup({ dataDirectory: dir, now: new Date('2026-09-20T00:00:00.000Z') });
    for (let day = 21; day <= 25; day++) {
      const info = createBackup({ dataDirectory: dir, automatic: true, now: new Date(`2026-09-${day}T00:00:00.000Z`) });
      fs.utimesSync(backupPath(info.name, dir)!, new Date(`2026-09-${day}`), new Date(`2026-09-${day}`));
    }
    expect(pruneAutomaticBackups(2, dir)).toHaveLength(3);
    const left = listBackups(dir);
    expect(left.filter(backup => backup.automatic).map(backup => backup.name.slice(15, 25))).toEqual(['2026-09-25', '2026-09-24']);
    expect(left.some(backup => !backup.automatic)).toBe(true);
  });

  it('only accepts its own file names and knows when one is due', () => {
    const dir = dataDirectory();
    expect(isBackupName('../config.json')).toBe(false);
    expect(backupPath('../../etc/passwd', dir)).toBeNull();
    expect(deleteBackup('config.json', dir)).toBe(false);
    expect(isBackupDue('daily', dir)).toBe(true);
    createBackup({ dataDirectory: dir, automatic: true });
    expect(isBackupDue('daily', dir)).toBe(false);
    expect(isBackupDue('daily', dir, Date.now() + 25 * 3_600_000)).toBe(true);
    expect(isBackupDue('off', dir)).toBe(false);
  });
});
