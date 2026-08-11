import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  readUsers: vi.fn(),
  verifyPassword: vi.fn(),
  generateToken: vi.fn(),
  isSecureRequest: vi.fn(),
}));

import { POST } from './route';

const originalDemoMode = process.env.NASDASH_DEMO_MODE;

afterEach(() => {
  if (originalDemoMode === undefined) delete process.env.NASDASH_DEMO_MODE;
  else process.env.NASDASH_DEMO_MODE = originalDemoMode;
});
describe('public demo login', () => {
  it('does not expose an authentication surface', async () => {
    process.env.NASDASH_DEMO_MODE = 'true';
    const response = await POST(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin' }),
    }) as never);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'La connexion est désactivée sur la démonstration publique.',
    });
  });
});
