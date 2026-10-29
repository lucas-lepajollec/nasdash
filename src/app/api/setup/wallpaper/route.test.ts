import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ settings: {} as Record<string, unknown>, dir: '' }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ settings: { ...state.settings } }), getLogosDir: () => state.dir }));
import { GET } from './route';

state.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-wallpaper-'));
fs.writeFileSync(path.join(state.dir, 'holiday.jpg'), 'jpeg-bytes');
fs.writeFileSync(path.join(state.dir, 'other.png'), 'png-bytes');
afterAll(() => fs.rmSync(state.dir, { recursive: true, force: true }));
const get = (query = '') => GET(new NextRequest(`http://nasdash.example.com/api/setup/wallpaper${query}`));
beforeEach(() => { state.settings = {}; });

describe('sign-in wallpaper route', () => {
  it('serves only the uploaded wallpaper in use, before signing in', async () => {
    state.settings = { backgroundImage: '/api/logos/holiday.jpg', mobileWallpaper: '/api/logos/other.png' };
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(await response.text()).toBe('jpeg-bytes');
    expect(await (await get('?screen=mobile')).text()).toBe('png-bytes');
  });
  it('serves nothing for a bundled, external or missing wallpaper, or a path outside the uploads', async () => {
    for (const backgroundImage of ['/wallpapers/nasdash-aurora.jpg', 'https://images.example/a.jpg', '/api/logos/missing.jpg', '/api/logos/../secret.jpg', '']) {
      state.settings = { backgroundImage };
      expect((await get()).status).toBe(404);
    }
  });
});
