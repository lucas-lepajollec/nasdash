/** Server-only requests and bounded extraction for saved custom API connections. */
import { validateHeaderValue } from 'node:http';
import type { IntegrationInstance } from '@/lib/types';
import type { CustomApiDisplay, CustomApiField, CustomApiResponse, CustomApiValue } from './contracts';
import { assertStatus, serviceBytes, ServiceError, serviceUrl } from './services';

const invalid = (): never => { throw new ServiceError('widgets.error.invalidSettings', 400); };

export async function customApiRequest(instance: IntegrationInstance): Promise<unknown> {
  const authType = instance.settings.authType || 'none';
  const authName = instance.settings.authName ?? '';
  const authValue = instance.secrets?.authValue ?? '';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (!['none', 'bearer', 'header', 'basic', 'query'].includes(authType)) invalid();
  if (authType !== 'none' && !authValue) invalid();
  if (authType === 'bearer') headers.Authorization = `Bearer ${authValue}`;
  if (authType === 'header') {
    if (!/^[A-Za-z0-9-]{1,64}$/.test(authName) || /^(?:host|content-length|connection|transfer-encoding|te|upgrade|proxy-.*|keep-alive)$/i.test(authName)) invalid();
    // Replace case-insensitively (e.g. a configured Accept header).
    for (const key of Object.keys(headers)) if (key.toLowerCase() === authName.toLowerCase()) delete headers[key];
    headers[authName] = authValue;
  }
  if (authType === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(`${authName}:${authValue}`, 'utf8').toString('base64')}`;
  }
  if (authType === 'query') {
    if (!/^[A-Za-z0-9_.\-]{1,64}$/.test(authName)) invalid();
  }
  try { for (const [name, value] of Object.entries(headers)) validateHeaderValue(name, value); }
  catch { invalid(); }
  const url = new URL(serviceUrl(instance));
  if (authType === 'query') url.searchParams.append(authName, authValue);
  const answer = await serviceBytes({ ...instance, settings: { ...instance.settings, url: url.toString() } }, '', { method: 'GET', headers }, 1024 * 1024);
  assertStatus(answer.status);
  try {
    const json: unknown = JSON.parse(answer.bytes.toString('utf8'));
    // Echo/debug APIs can return request headers or URLs. Neither samples nor
    // configured fields may turn the saved credential into browser data.
    const sensitive = [...new Set([authValue, encodeURIComponent(authValue),
      authType === 'basic' ? Buffer.from(`${authName}:${authValue}`).toString('base64') : '',
    ].filter(Boolean))];
    const clean = (value: unknown, depth = 0): unknown => {
      if (typeof value === 'string') return sensitive.reduce((text, secret) => text.split(secret).join('[redacted]'), value);
      if (value === null || typeof value !== 'object') return value;
      if (depth >= 64) return null;
      if (Array.isArray(value)) return value.map(item => clean(item, depth + 1));
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [clean(key) as string, clean(item, depth + 1)]));
    };
    return clean(json);
  }
  catch { throw new ServiceError('widgets.error.parse'); }
}

type PathSegment = string | number;
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
export function parseCustomApiPath(path: unknown): PathSegment[] {
  if (typeof path !== 'string' || !path || path.length > 200) return invalid();
  const segments: PathSegment[] = [];
  const pattern = /([A-Za-z0-9_$-]+)|\[(\d+)\]/y;
  let offset = 0;
  while (offset < path.length) {
    pattern.lastIndex = offset;
    const match = pattern.exec(path);
    if (!match || (match[1] && forbidden.has(match[1]))) return invalid();
    const segment = match[1] ?? Number(match[2]);
    if (typeof segment === 'number' && !Number.isSafeInteger(segment)) return invalid();
    segments.push(segment);
    if (segments.length > 16) return invalid();
    offset = pattern.lastIndex;
    if (offset === path.length) break;
    if (path[offset] === '.') {
      offset++;
      if (offset === path.length || !/[A-Za-z0-9_$-]/.test(path[offset])) return invalid();
    } else if (path[offset] !== '[') return invalid();
  }
  return segments;
}

export function readPath(json: unknown, segments: readonly PathSegment[]): unknown {
  let value = json;
  for (const key of segments) {
    if (forbidden.has(String(key)) || value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    if (Array.isArray(value) && key !== 'length' && !/^(0|[1-9]\d*)$/.test(String(key))) return undefined;
    value = (value as Record<string | number, unknown>)[key];
  }
  return value;
}
function primitive(value: unknown): CustomApiValue {
  if (typeof value === 'string') return value.slice(0, 300);
  if (typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}
export interface CustomApiSpec {
  display: CustomApiDisplay;
  fields: CustomApiField[];
  listPath?: string;
  limit: number;
  okPath?: string;
  okValue?: string | number | boolean;
  refresh: number;
}
const formats = ['auto', 'number', 'percent', 'bytes', 'bitrate', 'duration', 'date', 'relative', 'text', 'boolean'];
export function customApiSpec(saved: Record<string, unknown>): CustomApiSpec {
  // `null` is how the widget settings clear a value: the same as absent.
  const settings = Object.fromEntries(Object.entries(saved).filter(([, value]) => value !== null));
  settings.display ??= 'figures';
  settings.fields ??= [];
  if (!['figures', 'gauges', 'list', 'table', 'status'].includes(settings.display as string) || !Array.isArray(settings.fields) || settings.fields.length > 12) return invalid();
  const ids = new Set<string>();
  const fields = settings.fields.map((field: unknown): CustomApiField => {
    if (!field || typeof field !== 'object' || Array.isArray(field)) return invalid();
    const f = field as Record<string, unknown>;
    if (typeof f.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(f.id) || ids.has(f.id) || typeof f.label !== 'string' || f.label.length > 60) return invalid();
    ids.add(f.id);
    parseCustomApiPath(f.path);
    if (f.format !== undefined && !formats.includes(f.format as string) || f.unit !== undefined && (typeof f.unit !== 'string' || f.unit.length > 12) || f.lowIsBad !== undefined && typeof f.lowIsBad !== 'boolean') return invalid();
    for (const key of ['decimals', 'min', 'max', 'warn', 'crit']) if (f[key] !== undefined && (typeof f[key] !== 'number' || !Number.isFinite(f[key]))) return invalid();
    return { ...f } as unknown as CustomApiField;
  });
  const limit = settings.limit === undefined ? 10 : settings.limit, refresh = settings.refresh === undefined ? 60 : settings.refresh;
  if (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 50 || ![15, 30, 60, 300, 900].includes(refresh as number)) return invalid();
  if (settings.display === 'table') parseCustomApiPath(settings.listPath);
  if (settings.display === 'status') {
    parseCustomApiPath(settings.okPath);
    const value = settings.okValue;
    if (value !== undefined && !(typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) || typeof value === 'string' && value.length <= 100)) return invalid();
  }
  return { display: settings.display as CustomApiDisplay, fields, limit: limit as number, refresh: refresh as number,
    ...(settings.display === 'table' ? { listPath: settings.listPath as string } : {}),
    ...(settings.display === 'status' ? { okPath: settings.okPath as string, ...(settings.okValue !== undefined ? { okValue: settings.okValue as string | number | boolean } : {}) } : {}),
  };
}
export function extractCustomApi(json: unknown, spec: CustomApiSpec): Pick<CustomApiResponse, 'values' | 'rows' | 'status'> {
  const paths = spec.fields.map(field => parseCustomApiPath(field.path));
  const valuesOf = (item: unknown) => paths.map(path => primitive(readPath(item, path)));
  const result: Pick<CustomApiResponse, 'values' | 'rows' | 'status'> = { values: valuesOf(json) };
  if (spec.display === 'table') {
    const list = readPath(json, parseCustomApiPath(spec.listPath));
    result.rows = Array.isArray(list) ? list.slice(0, spec.limit).map(valuesOf) : [];
  }
  if (spec.display === 'status') {
    const value = primitive(readPath(json, parseCustomApiPath(spec.okPath)));
    const ok = spec.okValue !== undefined ? value !== null && String(value) === String(spec.okValue)
      : Boolean(value) && !(typeof value === 'string' && /^(false|0|down|error)$/i.test(value));
    result.status = { value, ok };
  }
  return result;
}

export function customApiSample(json: unknown): { sample: unknown; truncated: boolean } {
  let remaining = 2000, truncated = false;
  const visit = (value: unknown, depth: number): unknown => {
    remaining--;
    if (typeof value === 'string') { if (value.length > 200) truncated = true; return value.slice(0, 200); }
    if (value === null || typeof value !== 'object') return primitive(value);
    if (depth >= 6) { truncated = true; return null; }
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      for (let i = 0; i < Math.min(value.length, 20); i++) {
        if (remaining <= 0) { truncated = true; break; }
        result.push(visit(value[i], depth + 1));
      }
      if (value.length > 20) truncated = true;
      return result;
    }
    const result: [string, unknown][] = [];
    for (const key of Object.keys(value)) {
      if (remaining <= 0) { truncated = true; break; }
      result.push([key, visit((value as Record<string, unknown>)[key], depth + 1)]);
    }
    return Object.fromEntries(result);
  };
  return { sample: visit(json, 0), truncated };
}
