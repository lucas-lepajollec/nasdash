import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { isDemoMode } from '@/lib/demoMode';
import { createBackup, listBackups } from '@/lib/backups';
import { recordTaskRun } from '@/lib/tasks';

export const dynamic = 'force-dynamic';

const DEMO_ERROR = 'backups.demoDisabled';

/** The backups of the data directory (admins only; off in the public demo). */
export async function GET(request: NextRequest) {
  const authError = checkAdmin(request);
  if (authError) return authError;
  if (isDemoMode()) return NextResponse.json({ demo: true, backups: [] });
  return NextResponse.json({ demo: false, backups: listBackups() });
}

/** Makes a backup now. */
export async function POST(request: NextRequest) {
  const authError = checkAdmin(request);
  if (authError) return authError;
  if (isDemoMode()) return NextResponse.json({ error: DEMO_ERROR }, { status: 403 });
  const started = Date.now();
  try {
    const backup = createBackup({ appVersion: process.env.npm_package_version });
    recordTaskRun('backups', { ok: true, note: backup.name, durationMs: Date.now() - started });
    return NextResponse.json(backup, { status: 201 });
  } catch (error) {
    console.error('Backup failed:', error);
    recordTaskRun('backups', { ok: false, note: error instanceof Error ? error.message : String(error), durationMs: Date.now() - started });
    return NextResponse.json({ error: 'backups.failed' }, { status: 500 });
  }
}
