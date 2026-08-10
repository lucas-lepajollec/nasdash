import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('health endpoint', () => {
  it('reports readiness without exposing configuration', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
