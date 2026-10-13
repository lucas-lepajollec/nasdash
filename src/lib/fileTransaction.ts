import fs from 'node:fs';
import crypto from 'node:crypto';

/** Stage every file before changing any target; restore original bytes if a commit fails. */
export function writeFileTransaction(entries: ReadonlyArray<readonly [string, string]>): void {
  const suffix = `.${process.pid}.${crypto.randomUUID()}`;
  const staged: { target: string; temporary: string; backup: string; hadOriginal: boolean; backedUp: boolean; committed: boolean }[] = [];
  try {
    for (const [target, data] of entries) {
      const hadOriginal = fs.existsSync(target);
      if (hadOriginal && !fs.lstatSync(target).isFile()) throw new Error('Configuration target must be a regular file');
      const item = { target, temporary: `${target}${suffix}.tmp`, backup: `${target}${suffix}.rollback`, hadOriginal, backedUp: false, committed: false };
      staged.push(item);
      const mode = hadOriginal ? fs.statSync(target).mode & 0o777 : 0o600;
      fs.writeFileSync(item.temporary, data, { mode, flag: 'wx' });
    }
    for (const item of staged) {
      if (item.hadOriginal) { fs.renameSync(item.target, item.backup); item.backedUp = true; }
      fs.renameSync(item.temporary, item.target);
      item.committed = true;
    }
  } catch (error) {
    let rollbackError: unknown;
    for (const item of [...staged].reverse()) {
      try {
        if (item.committed) fs.unlinkSync(item.target);
        if (item.backedUp) fs.renameSync(item.backup, item.target);
      } catch (failure) { rollbackError = failure; }
    }
    if (rollbackError) throw new AggregateError([error, rollbackError], 'Configuration rollback failed; preserved rollback files require recovery');
    throw error;
  } finally {
    for (const item of staged) {
      if (fs.existsSync(item.temporary)) fs.unlinkSync(item.temporary);
    }
  }
  for (const item of staged) {
    if (item.backedUp) {
      try { fs.unlinkSync(item.backup); }
      catch { console.warn('[NASDASH] Saved configuration; a rollback file could not be removed.'); }
    }
  }
}
