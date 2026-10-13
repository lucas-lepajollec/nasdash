import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const previousTrust = process.env.NASDASH_TRUST_PROXY;
beforeEach(() => { process.env.NASDASH_TRUST_PROXY = 'true'; });
afterEach(() => { if (previousTrust === undefined) delete process.env.NASDASH_TRUST_PROXY; else process.env.NASDASH_TRUST_PROXY = previousTrust; });
import { proxy } from './proxy';

function request(pathname: string, ip: string, method = 'GET') {
  return new NextRequest(`http://localhost${pathname}`, {
    method,
    headers: { 'x-forwarded-for': ip },
  });
}

describe('proxy rate-limit buckets', () => {
  it('allows normal repeated configuration reads', () => {
    for (let index = 0; index < 12; index += 1) {
      expect(proxy(request('/api/config', '10.251.0.1')).status).not.toBe(429);
    }
  });

  it('does not let config reads consume the login allowance', () => {
    const ip = '10.251.0.2';
    for (let index = 0; index < 12; index += 1) {
      expect(proxy(request('/api/config', ip)).status).not.toBe(429);
    }
    expect(proxy(request('/api/auth/login', ip, 'POST')).status).not.toBe(429);
  });

  it('limits repeated login attempts over a one-minute window', () => {
    const ip = '10.251.0.3';
    for (let index = 0; index < 10; index += 1) {
      expect(proxy(request('/api/auth/login', ip, 'POST')).status).not.toBe(429);
    }
    expect(proxy(request('/api/auth/login', ip, 'POST')).status).toBe(429);
  });
});

 it('ignores client-supplied forwarding identities unless proxy trust is explicit', async () => {
  delete process.env.NASDASH_TRUST_PROXY;
  vi.resetModules();
  const { proxy: fresh } = await import('./proxy');
  for (let index = 0; index < 10; index++) expect(fresh(request('/api/auth/login', `192.0.2.${index}`, 'POST')).status).not.toBe(429);
  expect(fresh(request('/api/auth/login', '192.0.2.99', 'POST')).status).toBe(429);
 });
