import { expect, it, vi } from 'vitest';
vi.mock('@/lib/config', () => ({ readConfig: () => ({}) }));
import { verifyCsrf } from './auth';
it.each(['https://nasdash.example.com:8443', 'https://evil.example.com', 'https://127.0.0.1', 'null'])('rejects a different origin %s for control requests', origin => {
  expect(verifyCsrf({ method: 'POST', url: 'https://nasdash.example.com/api/widgets/music/control', headers: new Headers({ origin, host: 'nasdash.example.com' }) })).toBe(false);
});
it('checks the full referer origin and accepts a reverse-proxy public origin', () => {
  expect(verifyCsrf({ method: 'POST', url: 'http://localhost:2499/api/test', headers: new Headers({ host: 'localhost:2499', referer: 'http://localhost:9999/evil' }) })).toBe(false);
  expect(verifyCsrf({ method: 'POST', url: 'http://localhost:2499/api/test', headers: new Headers({ host: 'nasdash.example.com', 'x-forwarded-proto': 'https', origin: 'https://nasdash.example.com' }) })).toBe(true);
});
it('accepts the public origin behind a TLS proxy that sends no X-Forwarded-Proto', () => {
  expect(verifyCsrf({ method: 'POST', url: 'http://localhost:2499/api/test', headers: new Headers({ host: 'nasdash.example.com', origin: 'https://nasdash.example.com' }) })).toBe(true);
  expect(verifyCsrf({ method: 'POST', url: 'http://192.168.0.200:2499/api/test', headers: new Headers({ host: '192.168.0.200:2499', origin: 'http://192.168.0.200:8080' }) })).toBe(false);
});
