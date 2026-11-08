import type { IntegrationInstance } from '@/lib/types';
import type { ContainerUpdate, ContainerUpdatesSummary } from '@/lib/widgetData/contracts';
import { array, object, serviceJson, string, ServiceError } from '@/lib/widgetData/services';
import { basicHeaders } from '../downloads/shared';
import type { KitServer } from '../kitServer';

/** What's Up Docker: `GET /api/containers` (read only), with basic authentication when it is turned on. */
export const wudRequest = <T = unknown>(instance: IntegrationInstance, path: string) =>
  serviceJson<T>(instance, path, { headers: instance.settings.auth === 'basic' ? basicHeaders(instance) : {} });

const text = (value: unknown, max = 160) => string(value).trim().slice(0, max);
const LEVELS = ['major', 'minor', 'patch', 'prerelease'] as const;
const webLink = (value: unknown) => { const link = text(value, 512); return /^https?:\/\//i.test(link) ? link : undefined; };
/** Digests are long: their start is enough to tell them apart. */
const short = (value: string) => /^sha256:[0-9a-f]{12,}$/i.test(value) ? value.slice(7, 19) : value;

export function toUpdate(value: unknown): ContainerUpdate | undefined {
  const container = object(value);
  if (container.updateAvailable !== true) return undefined;
  const image = object(container.image), result = object(container.result), kind = object(container.updateKind);
  const type = string(kind.kind);
  const current = text(kind.localValue) || text(object(image.tag).value) || text(object(image.digest).value);
  const latest = text(kind.remoteValue) || text(result.tag) || text(result.digest);
  const level = string(kind.semverDiff);
  const link = webLink(result.link) ?? webLink(container.link) ?? webLink(result.changelogUrl) ?? webLink(container.changelogUrl);
  return {
    name: text(container.displayName) || text(container.name) || text(image.name),
    image: text(image.name),
    current: short(current),
    ...(latest ? { latest: short(latest) } : {}),
    kind: type === 'tag' || type === 'digest' ? type : 'unknown',
    ...((LEVELS as readonly string[]).includes(level) ? { level: level as ContainerUpdate['level'] } : {}),
    ...(link ? { link } : {}),
  };
}

const ORDER = { major: 0, minor: 1, patch: 2, prerelease: 3 } as const;
export function toUpdates(instance: IntegrationInstance, answer: unknown, now = Date.now()): ContainerUpdatesSummary {
  // Recent versions answer an array; a wrapped list is accepted too.
  const list = Array.isArray(answer) ? answer : Array.isArray(object(answer).data) ? object(answer).data as unknown[] : undefined;
  if (!list) throw new ServiceError('widgets.error.parse');
  const updates = list.map(toUpdate).filter((update): update is ContainerUpdate => !!update)
    .sort((a, b) => (a.level ? ORDER[a.level] : 4) - (b.level ? ORDER[b.level] : 4) || a.name.localeCompare(b.name));
  return {
    provider: 'wud', name: instance.name, total: list.length, updates,
    errors: array(list).filter(container => !!object(object(container).error).message).length,
    fetchedAt: now,
  };
}

export async function collectWud(instance: IntegrationInstance): Promise<ContainerUpdatesSummary> {
  return toUpdates(instance, await wudRequest(instance, '/api/containers'));
}

export function demoWud(instance: IntegrationInstance): ContainerUpdatesSummary {
  return {
    provider: 'wud', name: instance.name, total: 24, errors: 0,
    updates: [
      { name: 'postgres', image: 'library/postgres', current: '16.4', latest: '17.2', kind: 'tag', level: 'major' },
      { name: 'jellyfin', image: 'jellyfin/jellyfin', current: '10.10.3', latest: '10.11.0', kind: 'tag', level: 'minor' },
      { name: 'immich-server', image: 'immich-app/immich-server', current: 'v2.1.0', latest: 'v2.1.2', kind: 'tag', level: 'patch' },
      { name: 'pihole', image: 'pihole/pihole', current: 'latest', latest: 'latest', kind: 'digest' },
    ],
    fetchedAt: Date.now(),
  };
}

export const wudKit: KitServer<ContainerUpdatesSummary> = {
  ttlMs: 5 * 60_000,
  collect: collectWud,
  test: async instance => { const answer = await wudRequest(instance, '/api/containers'); toUpdates(instance, answer); },
  demo: demoWud,
};
