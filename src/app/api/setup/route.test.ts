import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
const state = vi.hoisted(() => ({ admin: true, demo: false, settings: {} as Record<string, unknown>, written: [] as unknown[] }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ settings: { ...state.settings } }), writeConfig: (config: unknown) => { state.written.push(config); return true; } }));
vi.mock('@/lib/auth', () => ({ checkAdmin: () => state.admin ? null : NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 401 }) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
import { GET, POST } from './route';
import { normalizeSetupCode } from '@/components/welcome/WelcomeShell';

const post = (body: unknown) => new NextRequest('http://nasdash.example.com/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { state.admin = true; state.demo = false; state.settings = {}; state.written = []; });

describe('setup route', () => {
  it('tells anyone whether the installation is new, and dresses the screen like the dashboard', async () => {
    state.settings = { setupPending: true, backgroundImage: '/wallpapers/nasdash-mist.jpg', theme: 'nord', mode: 'light', uiLanguage: 'fr', title: 'Private title', cardOpacity: 0.7, surfaceBlur: 12, wallpaperDim: 0.3 };
    expect(await (await GET()).json()).toEqual({ pending: true, wallpaper: '/wallpapers/nasdash-mist.jpg', theme: 'nord', mode: 'light', language: 'fr', glass: { opacity: 0.7, blur: 12, dim: 0.3 } });
    // An uploaded wallpaper goes through its own route, which serves that single image.
    state.settings = { backgroundImage: '/api/logos/holiday.jpg', mobileWallpaper: '/api/logos/phone.png' };
    expect(await (await GET()).json()).toMatchObject({ pending: false, wallpaper: '/api/setup/wallpaper', mobileWallpaper: '/api/setup/wallpaper?screen=mobile', theme: 'nasdash', mode: 'dark' });
    // No wallpaper on the dashboard: none on the sign-in screen either (the theme's background shows).
    state.settings = { theme: 'rose-pine-dark' };
    expect(await (await GET()).json()).toMatchObject({ wallpaper: null, theme: 'rose-pine-dark' });
    state.settings = { setupPending: true }; state.demo = true;
    expect((await (await GET()).json()).pending).toBe(false);
  });
  it('lets the administrator only complete the guide', async () => {
    state.admin = false;
    expect((await POST(post({ action: 'complete' }))).status).toBe(401);
    state.admin = true;
    expect((await POST(post({ action: 'other' }))).status).toBe(400);
    state.settings = { setupPending: true, title: 'kept' };
    expect(await (await POST(post({ action: 'complete' }))).json()).toEqual({ pending: false });
    expect(state.written).toEqual([{ settings: { title: 'kept' } }]);
  });
});

describe('setup code', () => {
  it('accepts the code typed loosely and leaves a chosen password alone', () => {
    expect(normalizeSetupCode(' abcd efgh jkmn ')).toBe('ABCD-EFGH-JKMN');
    expect(normalizeSetupCode('ABCDEFGHJKMN')).toBe('ABCD-EFGH-JKMN');
    expect(normalizeSetupCode('my own long password')).toBe('my own long password');
  });
});
