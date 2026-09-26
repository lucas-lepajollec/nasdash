import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { getDataDirectory } from './dataDirectory';

/**
 * Backups made from the app: one `.tar.gz` of the whole data directory
 * (configuration, accounts, encryption key and session secret, logos), laid
 * out like `npm run data:backup` (`nasdash-backup.json` + `data/`), so that
 * `npm run data:restore -- --from <extracted folder> --force` restores it.
 * They live in `data/backups/`, which is itself never included.
 */

export const BACKUP_DIRECTORY_NAME = 'backups';
const FORMAT_VERSION = 1;
/** `nasdash-backup-2026-09-26T10-15-00-000Z(-auto).tar.gz` */
const NAME_PATTERN = /^nasdash-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(-auto)?\.tar\.gz$/;

export interface BackupInfo {
  name: string;
  size: number;
  createdAt: number;
  automatic: boolean;
}

export function backupsDirectory(dataDirectory = getDataDirectory()): string {
  return path.join(/* turbopackIgnore: true */ dataDirectory, BACKUP_DIRECTORY_NAME);
}

export function isBackupName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

export function listBackups(dataDirectory = getDataDirectory()): BackupInfo[] {
  const directory = backupsDirectory(dataDirectory);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter(isBackupName)
    .map(name => {
      const stat = fs.statSync(path.join(directory, name));
      return { name, size: stat.size, createdAt: stat.mtimeMs, automatic: name.endsWith('-auto.tar.gz') };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Path of a backup file, only for a valid name inside the backups folder. */
export function backupPath(name: string, dataDirectory = getDataDirectory()): string | null {
  if (!isBackupName(name)) return null;
  const file = path.join(backupsDirectory(dataDirectory), name);
  return fs.existsSync(file) ? file : null;
}

/** Every file of the data directory except the backups themselves and temporary files. */
function collectFiles(dataDirectory: string): string[] {
  const files: string[] = [];
  const walk = (relative: string) => {
    const absolute = path.join(dataDirectory, relative);
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      if (!relative && entry.name === BACKUP_DIRECTORY_NAME) continue;
      if (entry.name.endsWith('.tmp')) continue;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) files.push(child);
    }
  };
  walk('');
  return files.sort();
}

/** One ustar header (512 bytes) for a regular file. */
function tarHeader(name: string, size: number, mtime: number): Buffer {
  const header = Buffer.alloc(512);
  let prefix = '';
  let base = name;
  if (Buffer.byteLength(name) > 100) {
    const cut = name.lastIndexOf('/', 155);
    if (cut <= 0 || Buffer.byteLength(name.slice(cut + 1)) > 100) throw new Error(`Nom trop long pour l’archive : ${name}`);
    prefix = name.slice(0, cut);
    base = name.slice(cut + 1);
  }
  const write = (value: string, offset: number, length: number) => header.write(value, offset, length, 'utf8');
  const octal = (value: number, length: number) => value.toString(8).padStart(length - 1, '0') + '\0';
  write(base, 0, 100);
  write(octal(0o644, 8), 100, 8);
  write(octal(0, 8), 108, 8);
  write(octal(0, 8), 116, 8);
  write(octal(size, 12), 124, 12);
  write(octal(Math.floor(mtime / 1000), 12), 136, 12);
  header.fill(' ', 148, 156);
  write('0', 156, 1);
  write('ustar\0', 257, 6);
  write('00', 263, 2);
  write(prefix, 345, 155);
  let sum = 0;
  for (const byte of header) sum += byte;
  write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return header;
}

function tarOf(entries: { name: string; data: Buffer; mtime: number }[]): Buffer {
  const parts: Buffer[] = [];
  for (const entry of entries) {
    parts.push(tarHeader(entry.name, entry.data.length, entry.mtime), entry.data);
    const padding = (512 - (entry.data.length % 512)) % 512;
    if (padding) parts.push(Buffer.alloc(padding));
  }
  parts.push(Buffer.alloc(1024));
  return Buffer.concat(parts);
}

/** Creates a backup now; returns its description. */
export function createBackup({ automatic = false, appVersion = 'unknown', dataDirectory = getDataDirectory(), now = new Date() } = {}): BackupInfo {
  const directory = backupsDirectory(dataDirectory);
  fs.mkdirSync(directory, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const name = `nasdash-backup-${stamp}${automatic ? '-auto' : ''}.tar.gz`;
  const entries = collectFiles(dataDirectory).map(relative => {
    const absolute = path.join(dataDirectory, relative);
    return { name: `data/${relative}`, data: fs.readFileSync(absolute), mtime: fs.statSync(absolute).mtimeMs };
  });
  const manifest = Buffer.from(JSON.stringify({ formatVersion: FORMAT_VERSION, appVersion, createdAt: now.toISOString(), automatic }, null, 2));
  const archive = zlib.gzipSync(tarOf([{ name: 'nasdash-backup.json', data: manifest, mtime: now.getTime() }, ...entries]));
  const file = path.join(directory, name);
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, archive, { mode: 0o600 });
  fs.renameSync(temporary, file);
  const stat = fs.statSync(file);
  return { name, size: stat.size, createdAt: stat.mtimeMs, automatic };
}

export function deleteBackup(name: string, dataDirectory = getDataDirectory()): boolean {
  const file = backupPath(name, dataDirectory);
  if (!file) return false;
  fs.unlinkSync(file);
  return true;
}

/** Keeps the `keep` newest automatic backups; manual ones are never removed. */
export function pruneAutomaticBackups(keep: number, dataDirectory = getDataDirectory()): string[] {
  const removed = listBackups(dataDirectory).filter(backup => backup.automatic).slice(keep).map(backup => backup.name);
  for (const name of removed) deleteBackup(name, dataDirectory);
  return removed;
}

const SCHEDULE_MS = { daily: 24 * 3_600_000, weekly: 7 * 24 * 3_600_000 } as const;

/** An automatic backup is due when the newest one is older than the schedule. */
export function isBackupDue(schedule: 'off' | 'daily' | 'weekly', dataDirectory = getDataDirectory(), now = Date.now()): boolean {
  if (schedule === 'off') return false;
  const latest = listBackups(dataDirectory).find(backup => backup.automatic);
  return !latest || now - latest.createdAt >= SCHEDULE_MS[schedule];
}
