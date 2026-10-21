/** Server-only transport and instance helpers for saved LAN services. */
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { isDemoMode } from '@/lib/demoMode';
import { getServiceIntegration } from '@/integrations/registry';
import type { IntegrationInstance } from '@/lib/types';
import { isCertificateError, type HttpOptions } from '@/integrations/http';
import { resolveWidgetSettings } from './resolve';
import { CUSTOM_API_TYPES, DNS_TYPES, PHOTO_TYPES, PHOTO_STATS_TYPES, MEDIA_SERVER_TYPES, MUSIC_SERVER_TYPES, type DnsProvider } from './contracts';

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
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || (base.search && instance.type !== 'customapi') || base.hash) throw new Error();
    // Custom APIs use the exact saved endpoint, including trailing slash and query.
    return `${instance.type === 'customapi' ? base.toString() : base.toString().replace(/\/$/, '')}${path}`;
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
export function resolveServiceWidget(request: Request, widgetId: unknown, type: 'dns' | 'photos' | 'photos-stats' | 'customapi' | 'media-nowplaying' | 'media-recent' | 'media-library' | 'music-nowplaying' | 'music-recent' | 'music-library' | 'music-top' | 'music-playlists' | readonly ('media-nowplaying' | 'media-recent' | 'media-library' | 'music-nowplaying' | 'music-recent' | 'music-library' | 'music-top' | 'music-playlists')[], draft?: unknown) {
  const lookup = resolveWidgetSettings(request, widgetId, type, draft);
  if (!lookup.ok) return { response: NextResponse.json({ error: lookup.error }, { status: lookup.status }) };
  const types: readonly string[] = type === 'dns' ? DNS_TYPES : type === 'photos' ? PHOTO_TYPES : type === 'photos-stats' ? PHOTO_STATS_TYPES : type === 'customapi' ? CUSTOM_API_TYPES : (typeof type === 'string' ? type.startsWith('music-') : type.every(value => value.startsWith('music-'))) ? MUSIC_SERVER_TYPES : MEDIA_SERVER_TYPES;
  if ((types === MEDIA_SERVER_TYPES && lookup.settings.integrationId !== undefined || types === MUSIC_SERVER_TYPES && lookup.settings.integrationId != null || types === PHOTO_STATS_TYPES && lookup.settings.integrationId != null) && (typeof lookup.settings.integrationId !== 'string' || !lookup.settings.integrationId)) throw new ServiceError('widgets.error.invalidSettings', 400);
  const instance = getServiceInstance(lookup.settings.integrationId, types) ?? demoVisitorInstance(lookup.settings.integrationId, types);
  if (!instance) return { response: NextResponse.json({ error: 'widgets.error.notFound' }, { status: 404 }) };
  return { instance, settings: lookup.settings, principal: lookup.principal };
}
/**
 * Public demo only: a connection the visitor added lives in their browser, not
 * in the server's fictional config. Its id (`<type>-<random>`) is enough to
 * answer with fixtures; nothing is ever fetched in demo mode.
 */
export function demoVisitorInstance(integrationId: unknown, types: readonly string[]): IntegrationInstance | undefined {
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
export interface ServiceOptions extends HttpOptions { body?: string }
export async function serviceBytes(instance: IntegrationInstance, path: string, options: ServiceOptions = {}, maxBytes = 8 * 1024 * 1024): Promise<{ bytes: Buffer; contentType: string; status: number; headers?: Record<string, string | string[] | undefined> }> {
  const url = new URL(serviceUrl(instance, path));
  // Some APIs (GitHub…) refuse requests that do not name their client.
  const headers: Record<string, string> = { 'User-Agent': 'NasDash', ...options.headers };
  const body = options.json === undefined ? options.body : JSON.stringify(options.json);
  if (body !== undefined) { if (options.json !== undefined) headers['Content-Type'] = 'application/json'; headers['Content-Length'] = String(Buffer.byteLength(body)); }
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
        response.on('end', () => resolve({ bytes: Buffer.concat(chunks), contentType: String(response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase(), status, headers: response.headers }));
      });
      const timer = setTimeout(() => req.destroy(new ServiceError('widgets.error.timeout', 504)), Math.min(options.timeoutMs ?? 6000, 6000));
      req.on('close', () => clearTimeout(timer));
      req.on('error', reject);
      req.end(body);
    });
  } catch (error) { transportError(error); }
}
export async function serviceJson<T>(instance: IntegrationInstance, path: string, options: ServiceOptions = {}): Promise<T> {
  try {
    // Saved service endpoints never redirect, irrespective of the auth header name.
    const answer = await serviceBytes(instance, path, options, 2 * 1024 * 1024);
    assertStatus(answer.status);
    const text = answer.bytes.toString('utf8');
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
function remember(key: string, hash?: string) {
  photoMembership.delete(key);
  photoMembership.set(key, { hash, expires: Date.now() + 86400000 });
  while (photoMembership.size > 20_000) photoMembership.delete(photoMembership.keys().next().value!);
}
function recall(key: string) {
  const value = photoMembership.get(key);
  if (!value || value.expires < Date.now()) { photoMembership.delete(key); return undefined; }
  return value;
}
/** Only assets returned by this instance can be proxied; no arbitrary hash oracle. */
export function rememberPhoto(instance: IntegrationInstance, id: string, hash?: string) {
  remember(`${serviceIdentity(instance)}:${id}`, hash);
}
/**
 * And only through the widget that listed them: a reader of one widget
 * (one album) cannot fetch photos another widget or an admin preview showed.
 */
export function rememberWidgetPhoto(instance: IntegrationInstance, widgetId: string, id: string) {
  remember(`${serviceIdentity(instance)}:${widgetId}:${id}`);
}
export function knownPhoto(instance: IntegrationInstance, id: string, widgetId: string): { hash?: string } | undefined {
  if (!recall(`${serviceIdentity(instance)}:${widgetId}:${id}`)) return undefined;
  return recall(`${serviceIdentity(instance)}:${id}`);
}
/** Any photo this instance returned: only for an administrator's draft preview. */
export function knownInstancePhoto(instance: IntegrationInstance, id: string): { hash?: string } | undefined {
  return recall(`${serviceIdentity(instance)}:${id}`);
}

/** Fictional service demos deliberately contain no provider URLs or secrets. */
export function demoDns(instance: IntegrationInstance, blocking = true, durationSeconds?: number): import('./contracts').DnsSummary {
  const now = Date.UTC(2026, 0, 15, 12);
  return { provider: instance.type as DnsProvider, name: instance.name, blocking,
    ...(!blocking && durationSeconds ? { blockingResumesAt: Date.now() + durationSeconds * 1000 } : {}),
    queries: 28400, blocked: 6248, blockedPercent: 22, listedDomains: 154000, clients: 8,
    ...(instance.type === 'adguard' ? { averageMs: 2.4 } : {}),
    ...(instance.type === 'technitium' ? { cached: 9100, recursive: 12900 } : {}),
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
    return { id, ...photoUrls(widgetId, id, draft), ...(demoPortrait(id) ? { width: 800, height: 1200 } : { width: 1200, height: 800 }), takenAt: Date.UTC(2024, 5, 1 + n), place: ['Silver Lake', 'Blue Ridge', 'Quiet Coast'][n % 3] };
  });
  return { provider: instance.type as 'immich' | 'photoprism', name: instance.name, photos, stats: { photos: 1240, videos: 38 }, fetchedAt: Date.UTC(2026, 0, 15, 12) };
}
/** One demo photo in three is upright, so mosaics get their mixed sizes. */
function demoPortrait(id: string): boolean {
  return Number(id.replace(/\D/g, '').slice(-3)) % 3 === 1;
}
/** Calm generated landscapes (dawn, sea, forest, dusk…): no real photo ships with the demo. */
export function demoLandscape(id: string): string {
  const n = [...id].reduce((sum, char) => sum * 31 + char.charCodeAt(0) >>> 0, 0);
  const [sky, glow, far, near] = [
    ['#f4a261', '#ffe8c2', '#6d597a', '#355070'], ['#8ecae6', '#e0f4ff', '#5c8a74', '#2d4a3e'], ['#264653', '#9fc5c9', '#2a9d8f', '#1d3b3f'],
    ['#ffb4a2', '#ffeadf', '#b5838d', '#6d6875'], ['#a8dadc', '#f1faee', '#457b9d', '#1d3557'], ['#e9c46a', '#fff4d6', '#8a6d3b', '#4a3b24'],
  ][n % 6];
  const portrait = demoPortrait(id);
  const [w, h] = portrait ? [800, 1200] : [1200, 800];
  const sun = 120 + n % (w - 240);
  const horizon = h * 0.62;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${glow}"/></linearGradient></defs><path fill="url(#s)" d="M0 0h${w}v${h}H0z"/><circle fill="#fff7e0" opacity=".85" cx="${sun}" cy="${h * 0.24}" r="${w * 0.06}"/><path fill="${far}" opacity=".85" d="M0 ${horizon}L${w * 0.22} ${horizon - h * 0.22}L${w * 0.45} ${horizon - h * 0.06}L${w * 0.7} ${horizon - h * 0.28}L${w} ${horizon - h * 0.1}V${h}H0z"/><path fill="${near}" d="M0 ${horizon + h * 0.12}Q${w * 0.3} ${horizon - h * 0.02} ${w * 0.55} ${horizon + h * 0.1}T${w} ${horizon + h * 0.06}V${h}H0z"/></svg>`;
}

/** Audio transport: no redirects or size cap, six seconds for headers and
 * thirty seconds of socket inactivity thereafter. Web-stream cancellation
 * closes the upstream socket. Only allowlisted audio headers cross the proxy. */
export async function serviceStream(instance: IntegrationInstance, path: string, headers: Record<string, string>, signal?: AbortSignal): Promise<Response> {
  const url = new URL(serviceUrl(instance, path));
  try {
    return await new Promise<Response>((resolve, reject) => {
      const req = (url.protocol === 'https:' ? https : http).request(url, {
        headers: { 'User-Agent': 'NasDash', ...headers }, rejectUnauthorized: instance.settings.allowSelfSigned !== 'true',
      });
      const timer = setTimeout(() => req.destroy(new ServiceError('widgets.error.timeout', 504)), 6000);
      const abort = () => req.destroy(new ServiceError('widgets.error.timeout', 504));
      signal?.addEventListener('abort', abort, { once: true });
      req.on('close', () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); });
      req.on('error', reject);
      req.setTimeout(30000, () => req.destroy(new ServiceError('widgets.error.timeout', 504)));
      req.on('response', response => {
        clearTimeout(timer);
        try {
          const status = response.statusCode ?? 502;
          const safe = new Headers({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
          if (status === 416) {
            const range = String(response.headers['content-range'] ?? '');
            if (/^bytes \*\/\d+$/.test(range)) safe.set('Content-Range', range);
            response.destroy(); resolve(new Response(null, { status, headers: safe })); return;
          }
          assertStatus(status);
          if (status !== 200 && status !== 206) throw new ServiceError('widgets.error.parse');
          const type = String(response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
          if (!/^audio\/[a-z0-9.+-]+$/.test(type)) throw new ServiceError('widgets.error.parse');
          safe.set('Content-Type', type);
          const length = String(response.headers['content-length'] ?? ''), range = String(response.headers['content-range'] ?? '');
          if (/^\d+$/.test(length)) safe.set('Content-Length', length);
          if (response.headers['accept-ranges'] === 'bytes') safe.set('Accept-Ranges', 'bytes');
          if (status === 206) {
            if (!/^bytes \d+-\d+\/(?:\d+|\*)$/.test(range)) throw new ServiceError('widgets.error.parse');
            safe.set('Content-Range', range); safe.set('Accept-Ranges', 'bytes');
          }
          resolve(new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, { status, headers: safe }));
        } catch (error) { response.destroy(); reject(error); }
      });
      if (signal?.aborted) abort();
      else req.end();
    });
  } catch (error) { transportError(error); }
}
