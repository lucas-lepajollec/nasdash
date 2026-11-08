import type { IntegrationInstance } from '@/lib/types';
import type { ContainerUpdate, ContainerUpdatesSummary } from '@/lib/widgetData/contracts';
import { array, object, serviceJson, string, ServiceError } from '@/lib/widgetData/services';
import { basicHeaders } from '../downloads/shared';
import type { KitServer } from '../kitServer';

/**
 * What's Up Docker: `GET /api/containers`, each update's triggers, and the
 * update itself, which runs the container's Docker or Docker Compose trigger
 * as WUD's own button does (`POST /api/containers/:id/triggers/:type/:name`,
 * a `rw` or `admin` role when WUD has authentication). An update pulls an
 * image and recreates a container: it runs in the background, its state is
 * added to every answer, and WUD checks the container again afterwards.
 */
type Options = { method?: 'POST'; longRequest?: boolean; timeoutMs?: number };
export const wudRequest = <T = unknown>(instance: IntegrationInstance, path: string, options: Options = {}) =>
  serviceJson<T>(instance, path, { ...options, headers: instance.settings.auth === 'basic' ? basicHeaders(instance) : {} });

const text = (value: unknown, max = 160) => string(value).trim().slice(0, max);
const LEVELS = ['major', 'minor', 'patch', 'prerelease'] as const;
/** Triggers that update the container itself, preferred in this order. */
const UPDATE_TRIGGERS = ['dockercompose', 'docker'] as const;
const ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const MAX_UPDATES = 40;
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
  const id = text(container.id, 128);
  return {
    ...(ID.test(id) ? { id } : {}),
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
    .sort((a, b) => (a.level ? ORDER[a.level] : 4) - (b.level ? ORDER[b.level] : 4) || a.name.localeCompare(b.name))
    .slice(0, MAX_UPDATES);
  return {
    provider: 'wud', name: instance.name, total: list.length, updates,
    errors: array(list).filter(container => !!object(object(container).error).message).length,
    fetchedAt: now,
  };
}

/** The trigger that updates this container (`type.name`), if WUD has one. */
export function updateTrigger(triggers: unknown): { type: string; name: string } | undefined {
  const list = array(triggers).map(object).map(trigger => ({ type: string(trigger.type), name: string(trigger.name) }))
    .filter(trigger => /^[a-z]+$/.test(trigger.type) && /^[A-Za-z0-9_-]{1,64}$/.test(trigger.name));
  for (const type of UPDATE_TRIGGERS) {
    const found = list.find(trigger => trigger.type === type);
    if (found) return found;
  }
  return undefined;
}
const triggersOf = (instance: IntegrationInstance, id: string) => wudRequest(instance, `/api/containers/${encodeURIComponent(id)}/triggers`);

export async function collectWud(instance: IntegrationInstance): Promise<ContainerUpdatesSummary> {
  const summary = toUpdates(instance, await wudRequest(instance, '/api/containers'));
  // Whether each update can run from NasDash; a container whose triggers cannot be read is simply not updatable.
  const updates = await Promise.all(summary.updates.map(async update => update.id
    ? { ...update, updatable: !!updateTrigger(await triggersOf(instance, update.id).catch(() => [])) }
    : update));
  return { ...summary, updates };
}

/* ── Updates in the background ──────────────────────────────────────────── */
/** `update`: the row as it was listed, so a container WUD no longer lists still says it was updated. */
interface Job { status: 'updating' | 'updated' | 'failed'; error?: string; at: number; update?: ContainerUpdate }
const jobs = new Map<string, Job>();
const revisions = new Map<string, number>();
const jobKey = (instance: IntegrationInstance, id: string) => `${instance.id}\u0000${id}`;
/** A finished update is told for two minutes; WUD has usually checked the container again by then. */
const KEEP_MS = 2 * 60_000;
function settle(instance: IntegrationInstance, id: string, job: Job) {
  const key = jobKey(instance, id);
  jobs.set(key, { ...job, update: job.update ?? jobs.get(key)?.update });
  revisions.set(instance.id, (revisions.get(instance.id) ?? 0) + 1);
  while (jobs.size > 500) jobs.delete(jobs.keys().next().value!);
  while (revisions.size > 200) revisions.delete(revisions.keys().next().value!);
}
const failure = (error: unknown) => error instanceof ServiceError ? error.key : 'widgets.error.network';

async function runUpdate(instance: IntegrationInstance, id: string): Promise<void> {
  try {
    const trigger = updateTrigger(await triggersOf(instance, id));
    if (!trigger) throw new ServiceError('widgets.updates.error.noTrigger', 409);
    await wudRequest(instance, `/api/containers/${encodeURIComponent(id)}/triggers/${trigger.type}/${encodeURIComponent(trigger.name)}`, { method: 'POST', longRequest: true, timeoutMs: 15 * 60_000 });
    settle(instance, id, { status: 'updated', at: Date.now() });
    // WUD checks the container again, so the update leaves the list; a failed check changes nothing.
    await wudRequest(instance, `/api/containers/${encodeURIComponent(id)}/watch`, { method: 'POST', longRequest: true, timeoutMs: 60_000 }).catch(() => undefined);
    settle(instance, id, { status: 'updated', at: Date.now() });
  } catch (error) {
    settle(instance, id, { status: 'failed', error: failure(error), at: Date.now() });
  }
}

/** Starts the update of the listed, updatable containers (one after the other); answers at once. */
async function startUpdates(instance: IntegrationInstance, target: string | undefined, all: boolean): Promise<void> {
  if (!all && !target) throw new ServiceError('widgets.error.invalidRequest', 400);
  // Only what WUD lists now as updatable: never an id the browser made up.
  const summary = await collectWud(instance);
  const chosen = summary.updates.filter(update => update.id && update.updatable && (all || update.id === target)
    && jobs.get(jobKey(instance, update.id))?.status !== 'updating');
  if (!chosen.length) throw new ServiceError(all ? 'widgets.updates.error.nothing' : 'widgets.updates.error.notListed', 409);
  for (const update of chosen) jobs.set(jobKey(instance, update.id!), { status: 'updating', at: Date.now(), update });
  revisions.set(instance.id, (revisions.get(instance.id) ?? 0) + 1);
  void (async () => { for (const update of chosen) await runUpdate(instance, update.id!); })();
}

export function decorateWud(instance: IntegrationInstance, summary: ContainerUpdatesSummary, now = Date.now()): ContainerUpdatesSummary {
  const current = (job: Job | undefined) => job && (job.status === 'updating' || now - job.at <= KEEP_MS) ? job : undefined;
  const updates = summary.updates.map(update => {
    const job = current(update.id ? jobs.get(jobKey(instance, update.id)) : undefined);
    return job ? { ...update, status: job.status, ...(job.error ? { error: job.error } : {}) } : update;
  });
  // Updated containers WUD no longer lists stay for a moment, ticked, at the end.
  const listed = new Set(updates.map(update => update.id));
  const prefix = `${instance.id}\u0000`;
  const done = [...jobs.entries()]
    .filter(([key, job]) => key.startsWith(prefix) && job.update && !listed.has(job.update.id) && current(job)?.status === 'updated')
    .map(([, job]) => ({ ...job.update!, status: 'updated' as const }));
  return { ...summary, updates: [...updates, ...done] };
}

/* ── Public demo ─────────────────────────────────────────────────────────── */
const demoJobs = new Map<string, number>();
export function demoWud(instance: IntegrationInstance): ContainerUpdatesSummary {
  const now = Date.now();
  const all: ContainerUpdate[] = [
    { id: 'demo-postgres', name: 'postgres', image: 'library/postgres', current: '16.4', latest: '17.2', kind: 'tag', level: 'major', updatable: true },
    { id: 'demo-jellyfin', name: 'jellyfin', image: 'jellyfin/jellyfin', current: '10.10.3', latest: '10.11.0', kind: 'tag', level: 'minor', updatable: true, link: 'https://github.com/jellyfin/jellyfin/releases' },
    { id: 'demo-immich', name: 'immich-server', image: 'immich-app/immich-server', current: 'v2.1.0', latest: 'v2.1.2', kind: 'tag', level: 'patch', updatable: true },
    { id: 'demo-pihole', name: 'pihole', image: 'pihole/pihole', current: 'latest', latest: 'latest', kind: 'digest', updatable: true },
  ];
  // A fictional update takes eight seconds, then the container leaves the list.
  const updates = all.flatMap(update => {
    const started = demoJobs.get(`${instance.id}:${update.id}`);
    if (started === undefined) return [update];
    return now - started < 8_000 ? [{ ...update, status: 'updating' as const }] : [];
  });
  return { provider: 'wud', name: instance.name, total: 24, errors: 0, updates, fetchedAt: now };
}
function demoStart(instance: IntegrationInstance, target: string | undefined, all: boolean) {
  const now = Date.now();
  for (const update of demoWud(instance).updates) {
    if (all || update.id === target) demoJobs.set(`${instance.id}:${update.id}`, now);
  }
  while (demoJobs.size > 400) demoJobs.delete(demoJobs.keys().next().value!);
}

export const wudKit: KitServer<ContainerUpdatesSummary> = {
  ttlMs: 5 * 60_000,
  collect: collectWud,
  test: async instance => { toUpdates(instance, await wudRequest(instance, '/api/containers')); },
  demo: demoWud,
  decorate: (instance, summary) => decorateWud(instance, summary),
  revision: instance => revisions.get(instance.id) ?? 0,
  actions: {
    update: { run: (instance, target) => startUpdates(instance, target, false), demo: (instance, target) => demoStart(instance, target, false) },
    updateAll: { run: instance => startUpdates(instance, undefined, true), demo: instance => demoStart(instance, undefined, true) },
  },
};
