import { describe, expect, it } from 'vitest';
import {
  RequestValidationError,
  assertSafeIdentifier,
  readEnum,
  readJsonObject,
  readString,
  readStringArray,
} from './requestValidation';

describe('readJsonObject', () => {
  it('accepts a JSON object within the configured limit', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'NasDash' }),
    });

    await expect(readJsonObject(request, 1024)).resolves.toEqual({ name: 'NasDash' });
  });

  it('rejects a request whose declared length exceeds the limit', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-length': '2048' },
      body: '{}',
    });

    await expect(readJsonObject(request, 1024)).rejects.toMatchObject({ status: 413 });
  });

  it('measures the real UTF-8 body size', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ value: 'éééé' }),
    });

    await expect(readJsonObject(request, 15)).rejects.toMatchObject({ status: 413 });
  });

  it.each(['', '{broken', '[]', 'null'])('rejects a malformed or non-object body: %s', async body => {
    const request = new Request('http://localhost/api/test', { method: 'POST', body });
    await expect(readJsonObject(request, 1024)).rejects.toBeInstanceOf(RequestValidationError);
  });
});

describe('field validation', () => {
  it('normalizes strings and unique string arrays', () => {
    const object = { name: '  NasDash  ', tabs: [' home ', 'docker', 'home'] };
    expect(readString(object, 'name', { required: true, maxLength: 64 })).toBe('NasDash');
    expect(readStringArray(object, 'tabs', { maxItems: 10, maxItemLength: 32 })).toEqual(['home', 'docker']);
  });

  it('rejects unexpected enum values and unsafe identifiers', () => {
    expect(() => readEnum({ role: 'owner' }, 'role', ['admin', 'viewer'] as const, true)).toThrow(RequestValidationError);
    expect(() => assertSafeIdentifier('../config')).toThrow(RequestValidationError);
  });
});
