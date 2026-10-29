import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { readConfig, writeConfig } from '@/lib/config';
import { isDemoMode } from '@/lib/demoMode';
import { boundedJson } from '@/lib/widgetData/services';
import { DEFAULT_WALLPAPER, isBundledWallpaper } from '@/lib/wallpapers';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

/**
 * GET: what the sign-in and first-start screens need before anyone is signed in — whether this installation is new,
 * and how to dress the screen (bundled wallpaper, light or dark, language, the surfaces' glass). Nothing else.
 */
export async function GET() {
  const settings = readConfig().settings ?? {};
  // Bundled wallpapers only: an uploaded image may be personal and stays behind sign-in.
  const wallpaper = isBundledWallpaper(settings.backgroundImage) ? settings.backgroundImage : DEFAULT_WALLPAPER;
  return NextResponse.json({
    pending: !isDemoMode() && settings.setupPending === true,
    wallpaper,
    mode: settings.mode === 'light' ? 'light' : 'dark',
    language: settings.uiLanguage ?? null,
    // The look of the dashboard's surfaces, so signing in looks like what follows.
    glass: {
      opacity: typeof settings.cardOpacity === 'number' && settings.cardOpacity < 1 ? settings.cardOpacity : 0.6,
      blur: typeof settings.surfaceBlur === 'number' && settings.surfaceBlur > 0 ? settings.surfaceBlur : 24,
      dim: typeof settings.wallpaperDim === 'number' ? settings.wallpaperDim : 0.15,
    },
  }, { headers });
}

/** POST { action: 'complete' }: the administrator finished or skipped the first-run guide. */
export async function POST(request: NextRequest) {
  const denied = checkAdmin(request);
  if (denied) return denied;
  const body = await boundedJson(request).catch(() => null);
  if (!body || body.action !== 'complete') return NextResponse.json({ error: 'widgets.error.invalidRequest' }, { status: 400, headers });
  if (isDemoMode()) return NextResponse.json({ pending: false }, { headers });
  const config = readConfig();
  if (config.settings.setupPending) {
    delete config.settings.setupPending;
    if (!writeConfig(config)) return NextResponse.json({ error: 'Impossible d’enregistrer la configuration.' }, { status: 500, headers });
  }
  return NextResponse.json({ pending: false }, { headers });
}
