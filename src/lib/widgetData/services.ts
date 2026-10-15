/** Server-only transport and instance helpers for saved LAN services. */
import http from 'node:http';
import https from 'node:https';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { isDemoMode } from '@/lib/demoMode';
import { getServiceIntegration } from '@/integrations/registry';
import type { IntegrationInstance } from '@/lib/types';
import { httpRequest, isCertificateError, type HttpOptions } from '@/integrations/http';
import { resolveWidgetSettings } from './resolve';

export class ServiceError extends Error {
  constructor(readonly key: string, readonly status = 502, readonly parameters?: Record<string, string | number>) {
    super(key);
  }
}
export function serviceFailure(error: unknown): NextResponse {
  const failure = error instanceof ServiceError ? error : isCertificateError(error)
    ? new ServiceError('integrations.error.certificate')
    : new ServiceError('widgets.error.network');
  return NextResponse.json({ error: failure.key, ...(failure.parameters ? { parameters: failure.parameters } : {}) }, { status: failure.status });
}
export function serviceUrl(instance: IntegrationInstance, path = ''): string {
  try {
    const base = new URL(instance.settings.url);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error();
    return `${base.toString().replace(/\/$/, '')}${path}`;
  } catch { throw new ServiceError('integrations.error.invalidUrl'); }
}
/** No secret appears in the cache key; credential/config changes also invalidate memory. */
export function serviceIdentity(instance: IntegrationInstance): string {
  return createHash('sha256').update(JSON.stringify([instance.id, instance.type, instance.name, instance.settings, instance.secrets])).digest('hex');
}
/**
 * The widget's chosen connection. A widget that chose none reads the first
 * saved one of its types (as it shows it); a chosen id that no longer
 * matches stays an error rather than silently reading another server.
 */
export function getServiceInstance(integrationId: unknown, types: readonly string[]): IntegrationInstance | undefined {
  const matching = (readConfig().integrations ?? []).filter(instance => types.includes(instance.type));
  return integrationId === undefined || integrationId === null ? matching[0] : matching.find(instance => instance.id === integrationId);
}
export function resolveServiceWidget(request: Request, widgetId: unknown, type: 'dns' | 'photos', draft?: unknown) {
  const lookup = resolveWidgetSettings(request, widgetId, type, draft);
  if (!lookup.ok) return { response: NextResponse.json({ error: lookup.error }, { status: lookup.status }) };
  const types = type === 'dns' ? ['pihole', 'adguard'] : ['immich', 'photoprism'];
  const instance = getServiceInstance(lookup.settings.integrationId, types) ?? demoVisitorInstance(lookup.settings.integrationId, types);
  if (!instance) return { response: NextResponse.json({ error: 'widgets.error.notFound' }, { status: 404 }) };
  return { instance, settings: lookup.settings, principal: lookup.principal };
}
/**
 * Public demo only: a connection the visitor added lives in their browser, not
 * in the server's fictional config. Its id (`<type>-<random>`) is enough to
 * answer with fixtures; nothing is ever fetched in demo mode.
 */
function demoVisitorInstance(integrationId: unknown, types: readonly string[]): IntegrationInstance | undefined {
  if (!isDemoMode() || typeof integrationId !== 'string') return undefined;
  const type = /^([a-z]+)-[A-Za-z0-9-]{1,40}$/.exec(integrationId)?.[1];
  if (!type || !types.includes(type)) return undefined;
  return { id: integrationId, type, name: getServiceIntegration(type)?.name ?? type, settings: {}, secrets: {} };
}
/** Optional GET draft previews use the same admin-only sanitizer as POST previews. */
export function queryDraft(url: URL): unknown {
  const draft = url.searchParams.get('draft');
  if (!draft) return undefined;
  if (draft.length > 16_384) throw new ServiceError('widgets.error.invalidSettings', 400);
  try { return JSON.parse(draft); } catch { throw new ServiceError('widgets.error.invalidSettings', 400); }
}
export async function boundedJson(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new ServiceError('widgets.error.invalidRequest', 400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 16_384) { await reader.cancel(); throw new Error(); }
      chunks.push(next.value);
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new ServiceError('widgets.error.invalidRequest', 400); }
  finally { reader.releaseLock(); }
}
function transportError(error: unknown): never {
  if (error instanceof ServiceError) throw error;
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';
  if (name === 'TimeoutError' || name === 'AbortError' || /timeout/i.test(message)) throw new ServiceError('widgets.error.timeout', 504);
  if (isCertificateError(error)) throw new ServiceError('integrations.error.certificate');
  throw new ServiceError('widgets.error.network');
}
export function assertStatus(status: number) {
  if (status === 401 || status === 403) throw new ServiceError('integrations.error.authentication', 502, { status });
  if (status < 200 || status >= 300) throw new ServiceError('widgets.error.http', status === 504 ? 504 : 502, { status });
}
/**
 * Binary transport (and custom credential headers): bounded, 6 s total deadline,
 * no redirects. httpRequest only strips Authorization on cross-origin redirects,
 * so SID / x-api-key requests must use this stricter transport too.
 */
export async function serviceBytes(instance: IntegrationInstance, path: string, options: HttpOptions = {}, maxBytes = 8 * 1024 * 1024): Promise<{ bytes: Buffer; contentType: string; status: number }> {
  const url = new URL(serviceUrl(instance, path));
  const headers = { ...options.headers };
  const body = options.json === undefined ? undefined : JSON.stringify(options.json);
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = String(Buffer.byteLength(body)); }
  try {
    return await new Promise((resolve, reject) => {
      const req = (url.protocol === 'https:' ? https : http).request(url, {
        method: options.method ?? 'GET', headers,
        rejectUnauthorized: instance.settings.allowSelfSigned !== 'true',
      }, response => {
        const status = response.statusCode ?? 502;
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) { req.destroy(new ServiceError('widgets.error.tooLarge')); return; }
          chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => resolve({ bytes: Buffer.concat(chunks), contentType: String(response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase(), status }));
      });
      const timer = setTimeout(() => req.destroy(new ServiceError('widgets.error.timeout', 504)), Math.min(options.timeoutMs ?? 6000, 6000));
      req.on('close', () => clearTimeout(timer));
      req.on('error', reject);
      req.end(body);
    });
  } catch (error) { transportError(error); }
}
export async function serviceJson<T>(instance: IntegrationInstance, path: string, options: HttpOptions = {}): Promise<T> {
  try {
    let text: string;
    if (Object.keys(options.headers ?? {}).some(key => /^(x-ftl-sid|x-api-key)$/i.test(key))) {
      const answer = await serviceBytes(instance, path, options, 2 * 1024 * 1024);
      assertStatus(answer.status);
      text = answer.bytes.toString('utf8');
    } else {
      const answer = await httpRequest(serviceUrl(instance, path), { ...options, timeoutMs: 6000, allowSelfSigned: instance.settings.allowSelfSigned === 'true' });
      assertStatus(answer.status);
      text = await answer.text();
    }
    if (!text.trim()) return {} as T;
    try { return JSON.parse(text) as T; } catch { throw new ServiceError('widgets.error.parse'); }
  } catch (error) { transportError(error); }
}
export const number = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
export const string = (value: unknown): string => typeof value === 'string' ? value.slice(0, 512) : '';
export const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const date = (value: unknown): number | undefined => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : undefined;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PHOTO_UID = /^p[a-z0-9]{15}$/;
export const ALBUM_UID = /^a[a-z0-9]{15}$/;
export const PHOTO_HASH = /^[0-9a-f]{40}$/;
export const validPhotoId = (type: string, id: string) => type === 'immich' ? UUID.test(id) : type === 'photoprism' && (PHOTO_UID.test(id) || PHOTO_HASH.test(id));
export type PhotoMode = 'random' | 'recent' | 'favorites' | 'album' | 'memories';
export interface PhotoSelection { mode: PhotoMode; albumId?: string; count: number }
export function photoSelection(settings: Record<string, unknown>, type: string): PhotoSelection {
  const mode = settings.mode ?? 'random';
  if (typeof mode !== 'string' || !['random', 'recent', 'favorites', 'album', 'memories'].includes(mode)) throw new ServiceError('widgets.error.invalidSettings', 400);
  const count = settings.count === undefined ? 12 : Number(settings.count);
  if (!Number.isInteger(count) || count < 1) throw new ServiceError('widgets.error.invalidSettings', 400);
  const albumId = typeof settings.albumId === 'string' ? settings.albumId : undefined;
  if (mode === 'album' && (!albumId || !(type === 'immich' ? UUID : ALBUM_UID).test(albumId))) throw new ServiceError('widgets.error.invalidSettings', 400);
  return { mode: mode as PhotoMode, albumId: mode === 'album' ? albumId : undefined, count: Math.min(60, count) };
}
export function photoUrls(widgetId: string, id: string, draft?: unknown) {
  const query = new URLSearchParams({ widgetId, id });
  if (draft) query.set('draft', JSON.stringify(draft));
  return { thumb: `/api/widgets/photos/image?${query}&size=thumb`, preview: `/api/widgets/photos/image?${query}&size=preview` };
}

const photoMembership = new Map<string, { hash?: string; expires: number }>();
/** Only assets returned by this instance can be proxied; no arbitrary hash oracle. */
export function rememberPhoto(instance: IntegrationInstance, id: string, hash?: string) {
  const key = `${serviceIdentity(instance)}:${id}`;
  photoMembership.delete(key);
  photoMembership.set(key, { hash, expires: Date.now() + 86400000 });
  while (photoMembership.size > 20_000) photoMembership.delete(photoMembership.keys().next().value!);
}
export function knownPhoto(instance: IntegrationInstance, id: string): { hash?: string } | undefined {
  const key = `${serviceIdentity(instance)}:${id}`;
  const value = photoMembership.get(key);
  if (!value || value.expires < Date.now()) { photoMembership.delete(key); return undefined; }
  return value;
}

/** Fictional service demos deliberately contain no provider URLs or secrets. */
export function demoDns(instance: IntegrationInstance, blocking = true, durationSeconds?: number): import('./contracts').DnsSummary {
  const now = Date.UTC(2026, 0, 15, 12);
  return { provider: instance.type as 'pihole' | 'adguard', name: instance.name, blocking,
    ...(!blocking && durationSeconds ? { blockingResumesAt: Date.now() + durationSeconds * 1000 } : {}),
    queries: 28400, blocked: 6248, blockedPercent: 22, listedDomains: 154000, clients: 8,
    ...(instance.type === 'adguard' ? { averageMs: 2.4 } : {}),
    // Every 10 min over the day: quiet nights, busy evenings, a little noise.
    history: Array.from({ length: 144 }, (_, i) => {
      const hour = (i / 6 + 12) % 24;
      const total = Math.round(90 + 140 * Math.max(0, Math.sin(((hour - 6) / 24) * Math.PI * 2)) + 60 * Math.max(0, Math.sin(((hour - 15) / 12) * Math.PI)) + ((i * 37) % 7));
      return [now - (143 - i) * 600_000, total, Math.round(total * (0.19 + ((i * 13) % 5) / 100))] as [number, number, number];
    }),
    topBlocked: [{ name: 'ads.example.net', count: 920 }, { name: 'telemetry.example.org', count: 630 }],
    topQueried: [{ name: 'media.example.com', count: 3800 }, { name: 'weather.example.org', count: 1400 }],
    topClients: [{ name: 'atlas-nas', count: 9300 }, { name: 'travel-laptop', count: 4800 }], fetchedAt: now,
  };
}
export function demoPhotos(instance: IntegrationInstance, count: number, widgetId: string, seed: string, draft?: unknown): import('./contracts').PhotosResponse {
  const offset = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 60;
  const photos = Array.from({ length: count }, (_, i) => {
    const n = (i + offset) % 60;
    const id = instance.type === 'immich' ? `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` : `pdemo${String(n).padStart(11, '0')}`;
    return { id, ...photoUrls(widgetId, id, draft), width: 1200, height: 800, takenAt: Date.UTC(2024, 5, 1 + n), place: ['Silver Lake', 'Blue Ridge', 'Quiet Coast'][n % 3] };
  });
  return { provider: instance.type as 'immich' | 'photoprism', name: instance.name, photos, stats: { photos: 1240, videos: 38 }, fetchedAt: Date.UTC(2026, 0, 15, 12) };
}
export function demoLandscape(id: string): string {
  const n = [...id].reduce((sum, char) => sum * 31 + char.charCodeAt(0) >>> 0, 0);
  const hue = n % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="hsl(${hue} 60% 65%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 70% 88%)"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h1200v800H0z"/><circle fill="#fff2c0" cx="${200 + n % 700}" cy="170" r="65"/><path fill="hsl(${hue} 25% 40%)" d="M0 580L280 270l260 270L860 320l340 280v200H0z"/><path fill="hsl(${hue} 35% 27%)" d="M0 640q300-190 600 0t600 0v160H0z"/></svg>`;
}
