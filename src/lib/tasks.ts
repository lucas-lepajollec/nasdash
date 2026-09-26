import type { DashboardConfig } from './types';

/**
 * Background tasks of the server and their rhythm. Each task records its
 * last run here (in memory, per process); the Tasks settings page reads the
 * list through `/api/tasks` and changes the rhythms in `settings.tasks`.
 */

export type TaskId = 'device-monitoring' | 'service-pings' | 'history-save' | 'backups';

export type BackupSchedule = 'off' | 'daily' | 'weekly';

export interface TaskSettings {
  /** Machines are read this often while a dashboard is open (seconds). */
  monitoringSeconds: number;
  /** …and this often when nobody watches (seconds). */
  idleMonitoringSeconds: number;
  /** Services are pinged this often by an open dashboard (seconds). */
  pingSeconds: number;
  backupSchedule: BackupSchedule;
  /** Automatic backups kept; older ones are removed. Manual ones are never removed. */
  backupKeep: number;
}

export const TASK_LIMITS = {
  monitoringSeconds: { min: 5, max: 300, default: 10 },
  idleMonitoringSeconds: { min: 30, max: 3600, default: 60 },
  pingSeconds: { min: 10, max: 600, default: 30 },
  backupKeep: { min: 1, max: 60, default: 7 },
} as const;

export const BACKUP_SCHEDULES: readonly BackupSchedule[] = ['off', 'daily', 'weekly'];

/** Minutes between the saves of the 24 h device history (fixed). */
export const HISTORY_SAVE_MINUTES = 5;

const within = (value: unknown, limits: { min: number; max: number; default: number }) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(limits.max, Math.max(limits.min, Math.round(value))) : limits.default;

/** The rhythms in effect: stored values within their limits, defaults otherwise. */
export function taskSettings(config: Pick<DashboardConfig, 'settings'> | null | undefined): TaskSettings {
  const stored = (config?.settings?.tasks ?? {}) as Partial<Record<keyof TaskSettings, unknown>>;
  return {
    monitoringSeconds: within(stored.monitoringSeconds, TASK_LIMITS.monitoringSeconds),
    idleMonitoringSeconds: within(stored.idleMonitoringSeconds, TASK_LIMITS.idleMonitoringSeconds),
    pingSeconds: within(stored.pingSeconds, TASK_LIMITS.pingSeconds),
    backupSchedule: BACKUP_SCHEDULES.includes(stored.backupSchedule as BackupSchedule) ? stored.backupSchedule as BackupSchedule : 'off',
    backupKeep: within(stored.backupKeep, TASK_LIMITS.backupKeep),
  };
}

export interface TaskRun {
  at: number;
  ok: boolean;
  /** A short note: what was done, or why it failed (never a secret). */
  note?: string;
  durationMs?: number;
}

const store = globalThis as typeof globalThis & { __nasdashTaskRuns?: Partial<Record<TaskId, TaskRun>> };

export function recordTaskRun(id: TaskId, run: Omit<TaskRun, 'at'> & { at?: number }) {
  store.__nasdashTaskRuns ??= {};
  store.__nasdashTaskRuns[id] = { ...run, at: run.at ?? Date.now() };
}

export function lastTaskRuns(): Partial<Record<TaskId, TaskRun>> {
  return { ...(store.__nasdashTaskRuns ?? {}) };
}
