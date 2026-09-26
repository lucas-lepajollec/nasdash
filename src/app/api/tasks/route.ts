import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { readConfig } from '@/lib/config';
import { isDemoMode } from '@/lib/demoMode';
import { listBackups } from '@/lib/backups';
import { HISTORY_SAVE_MINUTES, lastTaskRuns, taskSettings } from '@/lib/tasks';

export const dynamic = 'force-dynamic';

/** The background tasks: rhythm and last run of each (admins only). */
export async function GET(request: NextRequest) {
  const authError = checkAdmin(request);
  if (authError) return authError;
  const settings = taskSettings(readConfig());
  const runs = lastTaskRuns();
  const demo = isDemoMode();
  const latestBackup = demo ? undefined : listBackups()[0];
  return NextResponse.json({
    demo,
    settings,
    tasks: [
      { id: 'device-monitoring', everySeconds: settings.monitoringSeconds, idleSeconds: settings.idleMonitoringSeconds, last: runs['device-monitoring'] ?? null },
      { id: 'service-pings', everySeconds: settings.pingSeconds, last: runs['service-pings'] ?? null },
      { id: 'history-save', everySeconds: HISTORY_SAVE_MINUTES * 60, last: runs['history-save'] ?? null },
      {
        id: 'backups',
        schedule: settings.backupSchedule,
        last: runs.backups ?? (latestBackup ? { at: latestBackup.createdAt, ok: true, note: latestBackup.name } : null),
      },
    ],
  });
}
