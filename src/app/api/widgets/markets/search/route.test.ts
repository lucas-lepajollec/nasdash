import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ admin: false, demo: false }));
vi.mock('@/lib/auth', () => ({ isAdmin: () => state.admin }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
import { GET } from './route';
import { marketSearchCache } from '@/lib/widgetData/markets';

const search = (q: string) => GET(new NextRequest(`http://localhost/api/widgets/markets/search?q=${encodeURIComponent(q)}`));
beforeEach(() => { state.admin = false; state.demo = false; marketSearchCache.clear(); });
afterEach(() => vi.unstubAllGlobals());

it('is for admins only and never reaches the source otherwise', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  expect((await search('bitcoin')).status).toBe(401);
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects empty and overlong queries', async () => {
  state.admin = true;
  expect((await search('')).status).toBe(400);
  expect((await search('x'.repeat(41))).status).toBe(400);
});
it('answers the demo with fictional symbols, without any outbound request', async () => {
  state.demo = true;
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const response = await search('nova');
  expect(response.status).toBe(200);
  expect((await response.json()).results).toEqual([expect.objectContaining({ symbol: 'NOVA-USD', kind: 'crypto' })]);
  expect(fetch).not.toHaveBeenCalled();
});
