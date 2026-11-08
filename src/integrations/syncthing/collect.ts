import type { IntegrationInstance } from '@/lib/types';
import type { SyncthingFolder, SyncthingSummary } from '@/lib/widgetData/contracts';
import { array, number, object, serviceJson, string, ServiceError } from '@/lib/widgetData/services';
import type { KitServer } from '../kitServer';

/**
 * Syncthing's REST API (`X-API-Key`). Read only: status, version, configured
 * folders and devices, connections, and each folder's `db/status` (documented
 * as expensive: at most 24 folders, and the kit shares one reading for 30 s).
 */
const MAX_FOLDERS = 24;
export const syncthingRequest = <T = unknown>(instance: IntegrationInstance, path: string) =>
  serviceJson<T>(instance, path, { headers: { 'X-API-Key': instance.secrets?.apiKey ?? '' } });

const text = (value: unknown, max = 120) => string(value).trim().slice(0, max);
const STATES: Record<string, SyncthingFolder['state']> = {
  idle: 'idle', syncing: 'syncing', 'sync-preparing': 'syncing', cleaning: 'syncing', scanning: 'scanning',
  'scan-waiting': 'waiting', 'sync-waiting': 'waiting', 'clean-waiting': 'waiting', error: 'error',
};

export function toFolder(config: unknown, status: unknown): SyncthingFolder {
  const folder = object(config), db = object(status);
  const id = text(folder.id, 64), globalBytes = number(db.globalBytes), needBytes = Math.min(number(db.needBytes), globalBytes || Infinity);
  const paused = folder.paused === true;
  return {
    id, label: text(folder.label) || id,
    state: paused ? 'paused' : STATES[string(db.state)] ?? 'unknown',
    completion: globalBytes > 0 ? Math.round(Math.max(0, Math.min(100, (1 - needBytes / globalBytes) * 100)) * 10) / 10 : 100,
    needBytes, globalBytes, errors: number(db.pullErrors) + number(db.errors),
  };
}

/** The previous transfer totals per connection: the rate is the difference over time. */
const previous = new Map<string, { at: number; inBytes: number; outBytes: number }>();
function rates(instance: IntegrationInstance, total: Record<string, unknown>, now: number) {
  const inBytes = number(total.inBytesTotal), outBytes = number(total.outBytesTotal);
  const last = previous.get(instance.id);
  previous.delete(instance.id);
  previous.set(instance.id, { at: now, inBytes, outBytes });
  while (previous.size > 200) previous.delete(previous.keys().next().value!);
  const seconds = last ? (now - last.at) / 1000 : 0;
  // A restart resets Syncthing's counters: no rate rather than a negative one.
  if (!last || seconds < 1 || inBytes < last.inBytes || outBytes < last.outBytes) return {};
  return { inRate: Math.round((inBytes - last.inBytes) / seconds), outRate: Math.round((outBytes - last.outBytes) / seconds) };
}

export function toSyncthing(instance: IntegrationInstance, answers: { status: unknown; version: unknown; folders: unknown; devices: unknown; connections: unknown; folderStatus: Record<string, unknown> }, now = Date.now()): SyncthingSummary {
  const myId = string(object(answers.status).myID);
  if (!myId) throw new ServiceError('widgets.error.parse');
  const connections = object(object(answers.connections).connections);
  const devices = array(answers.devices).map(object)
    .filter(device => string(device.deviceID) && string(device.deviceID) !== myId)
    .map(device => {
      const id = string(device.deviceID), link = object(connections[id]);
      return { id: id.slice(0, 7), name: text(device.name) || id.slice(0, 7), connected: link.connected === true, paused: device.paused === true || link.paused === true };
    })
    .sort((a, b) => Number(b.connected) - Number(a.connected) || a.name.localeCompare(b.name));
  const folders = array(answers.folders).slice(0, MAX_FOLDERS).map(folder => toFolder(folder, answers.folderStatus[string(object(folder).id)]));
  const uptime = number(object(answers.status).uptime);
  return {
    provider: 'syncthing', name: instance.name,
    ...(text(object(answers.version).version, 40) ? { version: text(object(answers.version).version, 40) } : {}),
    ...(uptime ? { uptimeSeconds: uptime } : {}),
    folders, devices,
    ...rates(instance, object(object(answers.connections).total), now),
    fetchedAt: now,
  };
}

export async function collectSyncthing(instance: IntegrationInstance): Promise<SyncthingSummary> {
  const [status, version, folders, devices, connections] = await Promise.all([
    syncthingRequest(instance, '/rest/system/status'),
    syncthingRequest(instance, '/rest/system/version').catch(() => ({})),
    syncthingRequest(instance, '/rest/config/folders'),
    syncthingRequest(instance, '/rest/config/devices'),
    syncthingRequest(instance, '/rest/system/connections'),
  ]);
  const ids = array(folders).slice(0, MAX_FOLDERS).map(folder => string(object(folder).id)).filter(Boolean);
  const folderStatus: Record<string, unknown> = {};
  // One folder that cannot be read does not hide the others: it shows an unknown state.
  await Promise.all(ids.map(async id => { folderStatus[id] = await syncthingRequest(instance, `/rest/db/status?folder=${encodeURIComponent(id)}`).catch(() => ({})); }));
  return toSyncthing(instance, { status, version, folders, devices, connections, folderStatus });
}

export function demoSyncthing(instance: IntegrationInstance): SyncthingSummary {
  const minute = Math.floor(Date.now() / 60_000), photos = 92 + (minute % 8);
  const gb = 1024 ** 3;
  return {
    provider: 'syncthing', name: instance.name, version: 'v2.0.10', uptimeSeconds: 864_000 + (minute % 60) * 60,
    folders: [
      { id: 'documents', label: 'Documents', state: 'idle', completion: 100, needBytes: 0, globalBytes: 18 * gb, errors: 0 },
      { id: 'photos', label: 'Photos', state: photos < 100 ? 'syncing' : 'idle', completion: photos, needBytes: Math.round((100 - photos) / 100 * 240 * gb), globalBytes: 240 * gb, errors: 0 },
      { id: 'music', label: 'Music', state: 'idle', completion: 100, needBytes: 0, globalBytes: 96 * gb, errors: 0 },
      { id: 'notes', label: 'Notes', state: 'paused', completion: 100, needBytes: 0, globalBytes: 0.2 * gb, errors: 0 },
    ],
    devices: [
      { id: 'LAPTOP1', name: 'Laptop', connected: true, paused: false },
      { id: 'PHONE01', name: 'Phone', connected: true, paused: false },
      { id: 'BACKUP1', name: 'Backup box', connected: false, paused: false },
    ],
    inRate: photos < 100 ? 6_400_000 + (minute % 5) * 400_000 : 12_000, outRate: 48_000,
    fetchedAt: Date.now(),
  };
}

export const syncthingKit: KitServer<SyncthingSummary> = {
  ttlMs: 30_000,
  collect: collectSyncthing,
  test: async instance => { await syncthingRequest(instance, '/rest/config/folders'); },
  demo: demoSyncthing,
};
