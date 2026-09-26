import { readConfig } from '@/lib/config';
import { isDemoMode } from '@/lib/demoMode';
import { classifyMonitoringError } from '@/lib/monitoringError';
import type { DashboardConfig, Device, DeviceStat } from '@/lib/types';
import { resolveDeviceConnection } from './sources';
import { DEVICE_COLLECTORS } from './collectors';
import { isCertificateError } from './http';
import { getDeviceIntegration } from './registry';
import { getDataPath } from '@/lib/dataDirectory';
import { pruneHistory, recordSamples, samplesOf, saveHistory, setHistoryFile } from './history';
import { CollectError, type CollectContext, type DeviceVitals, type Metric } from './types';
import { recordTaskRun, taskSettings } from '@/lib/tasks';
import { createBackup, isBackupDue, pruneAutomaticBackups } from '@/lib/backups';

/**
 * Background polling of device integrations: every 10 s while at least one
 * browser follows the system stream, every minute otherwise (so the 24 h
 * history stays complete); both rhythms are set in Settings → Tasks. The
 * same loop runs the scheduled backups. Results are cached for the device routes and
 * added to the history (`history.ts`). State lives on `globalThis` to
 * survive hot reloads.
 */

export interface DeviceStatus {
  online: boolean;
  /** Integrations: numeric metrics, formatted by the widgets. */
  metrics?: Metric[];
  /** Integrations: uptime, load and network throughput, when the source reports them. */
  vitals?: DeviceVitals;
  /** Devices without an integration: their hand-written stats. */
  stats?: DeviceStat[];
  updatedAt: number;
  error?: string;
  isOffline?: boolean;
}

interface RuntimeGlobal {
  __devicesStatusCache?: Record<string, DeviceStatus>;
  __integrationMemory?: Record<string, Record<string, string>>;
  __errorLogCache?: Map<string, string>;
  activeClients?: number;
  __monitoringInterval?: ReturnType<typeof setInterval> | null;
  __lastPollAt?: number;
  __backupRunning?: boolean;
}

const runtime = globalThis as typeof globalThis & RuntimeGlobal;
runtime.__devicesStatusCache ??= {};
runtime.__integrationMemory ??= {};
runtime.__errorLogCache ??= new Map<string, string>();
runtime.activeClients ??= 0;

export const devicesStatusCache: Record<string, DeviceStatus> = runtime.__devicesStatusCache;
const memory = runtime.__integrationMemory;
const errorLog = runtime.__errorLogCache;

/** The loop wakes up this often and runs what is due. */
const TICK_MS = 5_000;

setHistoryFile(isDemoMode() || process.env.VITEST ? null : getDataPath('metrics-history.json'));

/** Logs a failure once, until it changes or is cleared (no spam every 10 s). */
function logOnce(deviceId: string, context: string, error: unknown) {
  const failure = classifyMonitoringError(error);
  const key = `${deviceId}-${context}`;
  const signature = `${failure.code}:${failure.message}`;
  if (errorLog.get(key) === signature) return;
  const line = `[${context}] ${failure.message} ${failure.hint}`;
  if (failure.severity === 'warning') console.warn(`🟠 ${line}`);
  else console.error(`🔴 ${line}`);
  errorLog.set(key, signature);
}

function clearLog(deviceId: string, context: string) {
  errorLog.delete(`${deviceId}-${context}`);
}

export { isCertificateError } from './http';

const interpolateEnv = (text: string) => text.replace(/\${([^}]+)}/g, (_, name: string) => process.env[name] || '');

/** Polls one device through its saved connection (or its legacy one). Never throws. */
export async function pollDevice(device: Device, config: Pick<DashboardConfig, 'integrations'> = readConfig()): Promise<DeviceStatus> {
  const resolved = resolveDeviceConnection(device, config);
  const integration = getDeviceIntegration(resolved?.type);
  const collect = integration ? DEVICE_COLLECTORS[integration.id] : undefined;
  if (!resolved || !integration || !collect) {
    // No source (or a legacy one): the stats typed by hand, if any.
    if (device.source && !resolved) return { online: false, error: 'integrations.sourceMissing', isOffline: true, updatedAt: Date.now() };
    return { online: true, stats: device.stats || [], updatedAt: Date.now() };
  }
  const context: CollectContext = {
    memory: (memory[device.id] ??= {}),
    warn: (name, error) => logOnce(device.id, name, error),
    clearWarning: name => clearLog(device.id, name),
  };
  try {
    const { connection } = resolved;
    const result = await collect({
      ...connection,
      url: connection.url ? interpolateEnv(connection.url) : '',
      token: connection.token ? interpolateEnv(connection.token) : undefined,
    }, context);
    clearLog(device.id, integration.name);
    const { metrics, vitals } = Array.isArray(result) ? { metrics: result, vitals: undefined } : result;
    return { online: true, metrics, ...(vitals && Object.keys(vitals).length ? { vitals } : {}), updatedAt: Date.now() };
  } catch (error) {
    const known = error instanceof CollectError ? error : null;
    if (!known?.silent) logOnce(device.id, integration.name, known ? known.reason ?? known : error);
    const message = isCertificateError(error)
      ? 'integrations.certificateRejected'
      : known?.message || (error instanceof Error && error.message) || `Impossible de joindre ${integration.name}`;
    return { online: false, error: message, isOffline: true, updatedAt: Date.now() };
  }
}

async function pollAll() {
  const started = Date.now();
  runtime.__lastPollAt = started;
  try {
    const config = readConfig();
    const devices = config.devices ?? [];
    let offline = 0;
    await Promise.all(devices.map(async device => {
      const status = await pollDevice(device, config);
      devicesStatusCache[device.id] = status;
      if (status.online) recordSamples(device.id, samplesOf(status.metrics, status.vitals), status.updatedAt);
      else offline++;
    }));
    pruneHistory(devices.map(device => device.id));
    recordTaskRun('device-monitoring', { ok: offline === 0, note: `${devices.length - offline}/${devices.length}`, durationMs: Date.now() - started });
    if (saveHistory()) recordTaskRun('history-save', { ok: true });
  } catch (error) {
    recordTaskRun('device-monitoring', { ok: false, note: error instanceof Error ? error.message : String(error), durationMs: Date.now() - started });
    console.error('Background Polling Loop Error:', error);
  }
}

/** Runs the scheduled backup when due, then drops the oldest automatic ones. */
function backupIfDue(config: DashboardConfig) {
  const { backupSchedule, backupKeep } = taskSettings(config);
  if (runtime.__backupRunning || !isBackupDue(backupSchedule)) return;
  runtime.__backupRunning = true;
  const started = Date.now();
  try {
    const backup = createBackup({ automatic: true, appVersion: process.env.npm_package_version });
    pruneAutomaticBackups(backupKeep);
    recordTaskRun('backups', { ok: true, note: backup.name, durationMs: Date.now() - started });
  } catch (error) {
    recordTaskRun('backups', { ok: false, note: error instanceof Error ? error.message : String(error), durationMs: Date.now() - started });
    console.error('Scheduled backup failed:', error);
  } finally {
    runtime.__backupRunning = false;
  }
}

/** Wakes up every 5 s: polls at the watched or idle rhythm, backs up when due. */
function tick() {
  let config: DashboardConfig;
  try {
    config = readConfig();
  } catch {
    return;
  }
  const { monitoringSeconds, idleMonitoringSeconds } = taskSettings(config);
  const interval = ((runtime.activeClients ?? 0) > 0 ? monitoringSeconds : idleMonitoringSeconds) * 1000;
  if (Date.now() - (runtime.__lastPollAt ?? 0) >= interval - 500) void pollAll();
  backupIfDue(config);
}

/** Starts the polling loop once (server start or first browser). */
export function startBackgroundMonitoring() {
  if (isDemoMode() || runtime.__monitoringInterval) return;
  console.log('🚀 Background tasks started (device monitoring, history, scheduled backups; rhythms in Settings → Tasks).');
  void pollAll();
  runtime.__monitoringInterval = setInterval(tick, TICK_MS);
}

export function incrementActiveClients() {
  runtime.activeClients = (runtime.activeClients ?? 0) + 1;
  // The public demo serves fictional readings: nothing to poll.
  if (isDemoMode()) return;
  startBackgroundMonitoring();
  // Back to a fresh value right away when someone opens the dashboard.
  if (runtime.activeClients === 1 && Date.now() - (runtime.__lastPollAt ?? 0) > taskSettings(readConfig()).monitoringSeconds * 1000) void pollAll();
}

export function decrementActiveClients() {
  runtime.activeClients = Math.max(0, (runtime.activeClients ?? 0) - 1);
}
