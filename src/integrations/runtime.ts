import { readConfig } from '@/lib/config';
import { isDemoMode } from '@/lib/demoMode';
import { classifyMonitoringError } from '@/lib/monitoringError';
import type { Device, DeviceStat } from '@/lib/types';
import { DEVICE_COLLECTORS } from './collectors';
import { isCertificateError } from './http';
import { getDeviceIntegration } from './registry';
import { getDataPath } from '@/lib/dataDirectory';
import { pruneHistory, recordSamples, samplesOf, saveHistory, setHistoryFile } from './history';
import { CollectError, type CollectContext, type DeviceVitals, type Metric } from './types';

/**
 * Background polling of device integrations: every 10 s while at least one
 * browser follows the system stream, every minute otherwise (so the 24 h
 * history stays complete). Results are cached for the device routes and
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
}

const runtime = globalThis as typeof globalThis & RuntimeGlobal;
runtime.__devicesStatusCache ??= {};
runtime.__integrationMemory ??= {};
runtime.__errorLogCache ??= new Map<string, string>();
runtime.activeClients ??= 0;

export const devicesStatusCache: Record<string, DeviceStatus> = runtime.__devicesStatusCache;
const memory = runtime.__integrationMemory;
const errorLog = runtime.__errorLogCache;

const POLL_INTERVAL_MS = 10_000;
/** Nobody watching: a point a minute is enough for the history. */
const IDLE_INTERVAL_MS = 60_000;

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

/** Polls one device through its integration. Never throws. */
export async function pollDevice(device: Device): Promise<DeviceStatus> {
  const integration = getDeviceIntegration(device.api?.type);
  const collect = integration ? DEVICE_COLLECTORS[integration.id] : undefined;
  if (!device.api || !integration || !collect) {
    // No integration (or a legacy one): the stats typed by hand, if any.
    return { online: true, stats: device.stats || [], updatedAt: Date.now() };
  }
  const context: CollectContext = {
    memory: (memory[device.id] ??= {}),
    warn: (name, error) => logOnce(device.id, name, error),
    clearWarning: name => clearLog(device.id, name),
  };
  try {
    const result = await collect({
      url: device.api.url ? interpolateEnv(device.api.url) : '',
      token: device.api.token ? interpolateEnv(device.api.token) : undefined,
      vmid: device.api.vmid,
      vmType: device.api.vmType,
      allowSelfSigned: device.api.allowSelfSigned === true,
      target: device.api.target,
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
  runtime.__lastPollAt = Date.now();
  try {
    const devices = readConfig().devices ?? [];
    await Promise.all(devices.map(async device => {
      const status = await pollDevice(device);
      devicesStatusCache[device.id] = status;
      if (status.online) recordSamples(device.id, samplesOf(status.metrics, status.vitals), status.updatedAt);
    }));
    pruneHistory(devices.map(device => device.id));
    saveHistory();
  } catch (error) {
    console.error('Background Polling Loop Error:', error);
  }
}

/** Ticks every 10 s; polls on each tick while watched, once a minute otherwise. */
function tick() {
  const interval = (runtime.activeClients ?? 0) > 0 ? POLL_INTERVAL_MS : IDLE_INTERVAL_MS;
  if (Date.now() - (runtime.__lastPollAt ?? 0) >= interval - 500) void pollAll();
}

/** Starts the polling loop once (server start or first browser). */
export function startBackgroundMonitoring() {
  if (isDemoMode() || runtime.__monitoringInterval) return;
  console.log('🚀 Device monitoring started (every 10 s while watched, every minute otherwise).');
  void pollAll();
  runtime.__monitoringInterval = setInterval(tick, POLL_INTERVAL_MS);
}

export function incrementActiveClients() {
  runtime.activeClients = (runtime.activeClients ?? 0) + 1;
  startBackgroundMonitoring();
  // Back to a fresh value right away when someone opens the dashboard.
  if (runtime.activeClients === 1 && Date.now() - (runtime.__lastPollAt ?? 0) > POLL_INTERVAL_MS) void pollAll();
}

export function decrementActiveClients() {
  runtime.activeClients = Math.max(0, (runtime.activeClients ?? 0) - 1);
}
