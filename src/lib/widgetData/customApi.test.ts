import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
vi.mock('./services', async original => ({ ...await original<typeof import('./services')>(), serviceBytes: vi.fn() }));
import { customApiRequest, customApiSample, customApiSpec, extractCustomApi, parseCustomApiPath, readPath } from './customApi';
import { serviceBytes, serviceFailure, serviceUrl, ServiceError } from './services';

const source = (authType = 'none', authName = 'X-Api-Key', authValue = 'fictional-secret'): IntegrationInstance => ({
  id: 'customapi-test', type: 'customapi', name: 'Lab API',
  settings: { url: 'https://service.example.com/api/status?units=metric', authType, authName }, secrets: { authValue },
});
const field = { id: 'speed', label: 'Speed', path: 'data.speed' };
const settings = { display: 'figures', fields: [field] };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(serviceBytes).mockResolvedValue({ bytes: Buffer.from('{"online":true}'), status: 200, contentType: 'application/json' });
});

describe('custom API paths and extraction', () => {
  it('parses names, root and nested indexes, and array length', () => {
    expect(parseCustomApiPath('data.items[0].$speed-1')).toEqual(['data', 'items', 0, '$speed-1']);
    expect(parseCustomApiPath('[0][1].value')).toEqual([0, 1, 'value']);
    expect(readPath({ items: [1, 2] }, parseCustomApiPath('items.length'))).toBe(2);
    expect(readPath({ items: [1, 2] }, parseCustomApiPath('items.1'))).toBe(2);
    expect(parseCustomApiPath(Array(16).fill('x').join('.'))).toHaveLength(16);
    expect(parseCustomApiPath('x'.repeat(200))).toEqual(['x'.repeat(200)]);
  });
  it.each(['', '.x', 'x.', 'x..y', 'x.[0]', 'a[0]b', 'a[-1]', 'a[1.2]', 'a[]', 'a["b"]', 'x y', 'a/b', 'a?b', '__proto__', 'a.prototype.x', 'a.constructor', '[9007199254740992]', 'x'.repeat(201), Array(17).fill('x').join('.')])('rejects unsafe or invalid path %s', path => {
    expect(() => parseCustomApiPath(path)).toThrowError(new ServiceError('widgets.error.invalidSettings', 400));
  });
  it('reads own properties only, never prototype members or primitive properties', () => {
    const inherited = Object.create({ inherited: 123 }); inherited.own = { value: 9 };
    expect(readPath(inherited, ['inherited'])).toBeUndefined();
    expect(readPath(inherited, ['own', 'value'])).toBe(9);
    expect(readPath(JSON.parse('{"__proto__":{"secret":42}}'), ['__proto__', 'secret'])).toBeUndefined();
    expect(readPath({ a: 'abc' }, ['a', 'length'])).toBeUndefined();
    expect(readPath({ a: null }, ['a', 'b'])).toBeUndefined();
    expect(readPath({ a: [] }, ['a', 'map'])).toBeUndefined();
  });
  it('returns bounded primitives in field order, converting other values to null', () => {
    const data = { text: 'x'.repeat(400), number: 42, bool: false, nil: null, object: {}, array: [], bad: Infinity, nan: NaN };
    const spec = customApiSpec({ display: 'figures', fields: [...Object.keys(data), 'missing'].map(id => ({ id, label: id, path: id })) });
    expect(extractCustomApi(data, spec)).toEqual({ values: ['x'.repeat(300), 42, false, null, null, null, null, null, null] });
  });
  it('extracts table fields relative to each row, honoring the limit', () => {
    const spec = customApiSpec({ display: 'table', fields: [{ ...field, path: 'speed' }], listPath: 'data.items', limit: 2 });
    expect(extractCustomApi({ data: { items: [{ speed: 3 }, { speed: 4 }, { speed: 5 }] } }, spec)).toEqual({ values: [null], rows: [[3], [4]] });
    expect(extractCustomApi({ data: { items: 'no' } }, spec).rows).toEqual([]);
  });
  it.each([false, 0, '', null, 'false', 'FALSE', '0', 'down', 'Down', 'error', {}, []])('treats %j as unhealthy without an explicit expected value', value => {
    const spec = customApiSpec({ display: 'status', fields: [], okPath: 'online' });
    expect(extractCustomApi({ online: value }, spec).status?.ok).toBe(false);
  });
  it.each([true, 1, -1, 'up', 'true', 'ok'])('treats %j as healthy without an explicit expected value', value => {
    const spec = customApiSpec({ display: 'status', fields: [], okPath: 'online' });
    expect(extractCustomApi({ online: value }, spec).status?.ok).toBe(true);
  });
  it.each([[1, '1', true], [true, 'true', true], [false, false, true], ['UP', 'up', false], [0, '0', true], ['', '', true], [null, 'null', false], [{}, '[object Object]', false]])('compares status %j to explicit %j after String conversion', (value, okValue, ok) => {
    const spec = customApiSpec({ display: 'status', fields: [], okPath: 'online', okValue });
    expect(extractCustomApi({ online: value }, spec).status?.ok).toBe(ok);
  });
});

describe('custom API settings', () => {
  it.each(['figures', 'gauges', 'list', 'table', 'status'])('accepts %s with defaults and finite optional field numbers', display => {
    const spec = customApiSpec({ ...settings, display, listPath: 'items', okPath: 'online', fields: [{ ...field, format: 'number', decimals: 2, min: -10, max: 100, warn: 80, crit: 90, lowIsBad: false, unit: 'ms' }] });
    expect(spec.refresh).toBe(60); expect(spec.limit).toBe(10);
  });
  it.each([15, 30, 60, 300, 900])('accepts refresh %s', refresh => expect(customApiSpec({ ...settings, refresh }).refresh).toBe(refresh));
  it.each([
    { display: 'invalid' }, { fields: {} }, { fields: Array(13).fill(field) }, { fields: [field, field] },
    ...[{ id: '' }, { id: 'a.b' }, { path: '__proto__' }, { label: 'x'.repeat(61) }, { unit: 'x'.repeat(13) }, { format: 'html' }, { decimals: Infinity }, { min: NaN }, { max: '100' }, { warn: Infinity }, { crit: NaN }, { lowIsBad: 'true' }].map(change => ({ fields: [{ ...field, ...change }] })),
    { display: 'table', listPath: '' }, { display: 'status', okPath: 'constructor' },
    ...[{}, [], 'x'.repeat(101), Infinity].map(okValue => ({ display: 'status', okPath: 'online', okValue })),
    ...[0, 51, 1.5, '10'].map(limit => ({ limit })),
    ...[0, 20, '60'].map(refresh => ({ refresh })),
  ])('rejects invalid settings %j', change => {
    expect(() => customApiSpec({ ...settings, ...change })).toThrowError(new ServiceError('widgets.error.invalidSettings', 400));
  });
});

describe('bounded custom API samples', () => {
  it('preserves a small JSON answer without marking it truncated', () => {
    const data = { a: [1, null, false, 'ok'], b: { c: true } };
    expect(customApiSample(data)).toEqual({ sample: data, truncated: false });
  });
  it('cuts long strings and arrays', () => {
    const answer = customApiSample({ text: 'x'.repeat(201), items: Array.from({ length: 21 }, (_, i) => i) });
    expect(answer).toEqual({ sample: { text: 'x'.repeat(200), items: Array.from({ length: 20 }, (_, i) => i) }, truncated: true });
  });
  it('cuts nested containers at depth six', () => {
    const data = { a: { b: { c: { d: { e: { f: { g: 'hidden' } } } } } } };
    expect(customApiSample(data)).toEqual({ sample: { a: { b: { c: { d: { e: { f: null } } } } } }, truncated: true });
  });
  it('caps traversal at 2000 values, including containers', () => {
    const data = Object.fromEntries(Array.from({ length: 2100 }, (_, i) => [`v${i}`, i]));
    const { sample, truncated } = customApiSample(data);
    expect(Object.keys(sample as object)).toHaveLength(1999); expect(truncated).toBe(true);
    expect(customApiSample(Object.fromEntries(Object.entries(data).slice(0, 1999))).truncated).toBe(false);
  });
  it('does not mutate prototypes while copying JSON keys', () => {
    const sample = customApiSample(JSON.parse('{"__proto__":{"x":1}}')).sample as object;
    expect(Object.hasOwn(sample, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(sample)).toBe(Object.prototype);
  });
});

describe('custom API authentication and transport', () => {
  it.each([
    ['none', 'X-Key', {}],
    ['bearer', '', { Authorization: 'Bearer fictional-secret' }],
    ['header', 'X-Api-Key', { 'X-Api-Key': 'fictional-secret' }],
    ['basic', 'lab-user', { Authorization: `Basic ${Buffer.from('lab-user:fictional-secret').toString('base64')}` }],
    ['basic', '', { Authorization: `Basic ${Buffer.from(':fictional-secret').toString('base64')}` }],
  ])('builds %s authentication through the bounded GET transport', async (authType, authName, authHeaders) => {
    expect(await customApiRequest(source(authType, authName))).toEqual({ online: true });
    const [instance, path, options, bound] = vi.mocked(serviceBytes).mock.calls[0];
    expect(instance.settings.url).toBe(source().settings.url); expect(path).toBe(''); expect(bound).toBe(1024 * 1024);
    expect(options).toEqual({ method: 'GET', headers: { Accept: 'application/json', ...authHeaders } });
  });
  it('defaults an absent or empty optional auth selection to none', async () => {
    for (const authType of [undefined, '']) {
      const instance = source();
      if (authType === undefined) delete instance.settings.authType;
      else instance.settings.authType = authType;
      await customApiRequest(instance);
    }
    for (const call of vi.mocked(serviceBytes).mock.calls) expect(call[2]?.headers).toEqual({ Accept: 'application/json' });
  });
  it('preserves the saved endpoint trailing slash', async () => {
    const instance = source(); instance.settings.url = 'https://service.example.com/api/';
    await customApiRequest(instance);
    expect(vi.mocked(serviceBytes).mock.calls[0][0].settings.url).toBe(instance.settings.url);
  });
  it('appends escaped query credentials to saved query parameters without altering the connection', async () => {
    const instance = source('query', 'api.key', 'a&b= c?');
    await customApiRequest(instance);
    const sent = new URL(vi.mocked(serviceBytes).mock.calls[0][0].settings.url);
    expect(sent.searchParams.get('units')).toBe('metric'); expect(sent.searchParams.get('api.key')).toBe('a&b= c?');
    expect(instance.settings.url).not.toContain('api.key');
    instance.settings.url += '&api.key=existing';
    await customApiRequest(instance);
    expect(new URL(vi.mocked(serviceBytes).mock.calls[1][0].settings.url).searchParams.getAll('api.key')).toEqual(['existing', 'a&b= c?']);
  });
  it.each(['Host', 'CONTENT-LENGTH', 'Connection', 'transfer-encoding', 'TE', 'Upgrade', 'Proxy-Authorization', 'proxy-test', 'keep-alive', 'bad_name', 'bad:name', 'a\r\nb', '', 'x'.repeat(65)])('rejects auth header name %j before sending', async name => {
    await expect(customApiRequest(source('header', name))).rejects.toMatchObject({ key: 'widgets.error.invalidSettings', status: 400 });
    expect(serviceBytes).not.toHaveBeenCalled();
  });
  it.each([['unknown', 'x', 'v'], ['bearer', '', ''], ['bearer', '', 'x\r\nInjected: y'], ['header', 'X-Key', 'x\n'], ['query', 'bad&name', 'v'], ['query', 'x'.repeat(65), 'v']])('rejects invalid authentication %j', async (type, name, value) => {
    await expect(customApiRequest(source(type, name, value))).rejects.toMatchObject({ key: 'widgets.error.invalidSettings', status: 400 });
    expect(serviceBytes).not.toHaveBeenCalled();
  });
  it.each(['https://user:pass@service.example.com/api', 'ftp://service.example.com/api', 'https://service.example.com/api#fragment', 'bad url'])('rejects unsafe saved URL %s', async url => {
    const instance = source(); instance.settings.url = url;
    await expect(customApiRequest(instance)).rejects.toMatchObject({ key: 'integrations.error.invalidUrl' });
    expect(serviceBytes).not.toHaveBeenCalled();
  });
  it('keeps saved queries exclusive to customapi connections', () => {
    expect(serviceUrl(source())).toContain('?units=metric');
    expect(() => serviceUrl({ ...source(), type: 'pihole' })).toThrow();
  });
  it.each([[401, 'integrations.error.authentication'], [403, 'integrations.error.authentication'], [302, 'widgets.error.http'], [500, 'widgets.error.http'], [504, 'widgets.error.http']])('maps status %s without exposing query credentials', async (status, key) => {
    vi.mocked(serviceBytes).mockResolvedValue({ bytes: Buffer.from('fictional-secret'), status, contentType: 'text/plain' });
    const response = await customApiRequest(source('query', 'token')).catch(serviceFailure);
    expect(JSON.stringify(response)).not.toContain('fictional-secret');
    const failure = await (response as Response).json();
    expect(failure).toEqual({ error: key, parameters: { status } });
    expect(JSON.stringify(failure)).not.toContain('token');
  });
  it('maps invalid or empty JSON to a sanitized parse error', async () => {
    for (const text of ['', '<html>fictional-secret</html>']) {
      vi.mocked(serviceBytes).mockResolvedValue({ bytes: Buffer.from(text), status: 200, contentType: 'text/html' });
      await expect(customApiRequest(source())).rejects.toMatchObject({ key: 'widgets.error.parse' });
    }
  });
});

describe('custom API settings as the widget saves them', () => {
  it('reads null as absent and allows a status without extra values', () => {
    expect(customApiSpec({ display: 'status', okPath: 'online', okValue: null, fields: null, title: null })).toMatchObject({ display: 'status', fields: [], okPath: 'online' });
    expect(customApiSpec({}).display).toBe('figures');
  });
});
