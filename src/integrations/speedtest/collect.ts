import type { IntegrationInstance } from '@/lib/types';
import type { SpeedtestResult, SpeedtestSummary } from '@/lib/widgetData/contracts';
import { array, number, object, serviceJson, string, ServiceError } from '@/lib/widgetData/services';
import type { KitServer } from '../kitServer';

/**
 * Speedtest Tracker's API v1 (Bearer token, JSON). Reads the latest results;
 * an administrator may start a test (`POST /api/v1/speedtests/run`, the
 * token's "run speedtest" ability). Download and upload are bytes per second
 * in the API; NasDash keeps bits per second, as speeds are told.
 */
export const speedtestRequest = <T = unknown>(instance: IntegrationInstance, path: string, method?: 'POST') =>
  serviceJson<T>(instance, path, { method, headers: { Authorization: `Bearer ${instance.secrets?.token ?? ''}`, Accept: 'application/json' } });

/** "2026-11-08 10:00:00" (the app's time zone, UTC by default) or ISO 8601. */
export function resultTime(value: unknown): number | undefined {
  const raw = string(value).trim();
  if (!raw) return undefined;
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : undefined;
}
const bits = (result: Record<string, unknown>, field: 'download' | 'upload') =>
  number(result[`${field}_bits`]) || number(result[field]) * 8;

export function toResult(value: unknown): (SpeedtestResult & { status: string }) | undefined {
  const result = object(value), at = resultTime(result.created_at);
  if (!at) return undefined;
  const data = object(result.data), server = object(data.server), ping = object(data.ping);
  const status = string(result.status).toLowerCase();
  const name = string(server.name).trim().slice(0, 80), location = string(server.location).trim().slice(0, 80);
  return {
    at, status,
    downloadBps: bits(result, 'download'), uploadBps: bits(result, 'upload'), pingMs: Math.round(number(result.ping) * 10) / 10,
    ...(number(ping.jitter) ? { jitterMs: Math.round(number(ping.jitter) * 10) / 10 } : {}),
    ...(name ? { server: location && !name.includes(location) ? `${name} · ${location}` : name } : {}),
    ...(string(data.isp).trim() ? { isp: string(data.isp).trim().slice(0, 80) } : {}),
    ...(status === 'failed' ? { failed: true } : {}),
  };
}

export function toSpeedtest(instance: IntegrationInstance, answer: unknown, now = Date.now()): SpeedtestSummary {
  const list = array(object(answer).data);
  if (!Array.isArray(object(answer).data)) throw new ServiceError('widgets.error.parse');
  const results = list.map(toResult).filter((result): result is NonNullable<ReturnType<typeof toResult>> => !!result).sort((a, b) => a.at - b.at);
  const finished = results.filter(result => result.status === 'completed' || result.status === 'failed');
  // A queued or running test is newer than every finished one.
  const running = results.some(result => !['completed', 'failed', 'skipped'].includes(result.status) && result.at >= (finished.at(-1)?.at ?? 0) && now - result.at < 10 * 60_000);
  const strip = (result: SpeedtestResult & { status: string }): SpeedtestResult => { const { status, ...rest } = result; void status; return rest; };
  const latest = finished.at(-1);
  return {
    provider: 'speedtest', name: instance.name,
    ...(latest ? { latest: strip(latest) } : {}),
    history: finished.filter(result => result.status === 'completed').slice(-25).map(strip),
    running, fetchedAt: now,
  };
}

export async function collectSpeedtest(instance: IntegrationInstance): Promise<SpeedtestSummary> {
  return toSpeedtest(instance, await speedtestRequest(instance, '/api/v1/results?sort=-created_at'));
}

/** Public demo: a fictional fibre line, a test every hour; a test asked for runs for half a minute. */
const demoRuns = new Map<string, number>();
export function demoSpeedtest(instance: IntegrationInstance): SpeedtestSummary {
  const now = Date.now(), hour = 3_600_000, last = Math.floor(now / hour) * hour;
  const history: SpeedtestResult[] = Array.from({ length: 24 }, (_, index) => {
    const at = last - (23 - index) * hour, wave = Math.sin(at / hour / 3);
    return { at, downloadBps: Math.round((880 + wave * 60 - (index % 7 === 3 ? 240 : 0)) * 1e6), uploadBps: Math.round((410 + wave * 25) * 1e6), pingMs: Math.round((7 + Math.abs(wave) * 4) * 10) / 10, jitterMs: 1.2, server: 'Fictional Fibre · Amsterdam', isp: 'Example Fibre' };
  });
  const asked = demoRuns.get(instance.id) ?? 0;
  return { provider: 'speedtest', name: instance.name, latest: history.at(-1), history, running: now - asked < 30_000, fetchedAt: now };
}

export const speedtestKit: KitServer<SpeedtestSummary> = {
  ttlMs: 60_000,
  collect: collectSpeedtest,
  test: async instance => { await speedtestRequest(instance, '/api/v1/results?sort=-created_at'); },
  demo: demoSpeedtest,
  actions: {
    run: {
      run: async instance => { await speedtestRequest(instance, '/api/v1/speedtests/run', 'POST'); },
      demo: instance => { demoRuns.delete(instance.id); demoRuns.set(instance.id, Date.now()); while (demoRuns.size > 200) demoRuns.delete(demoRuns.keys().next().value!); },
    },
  },
};
