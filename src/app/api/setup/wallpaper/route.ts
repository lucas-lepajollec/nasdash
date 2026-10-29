import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { getLogosDir, readConfig } from '@/lib/config';
import { uploadedWallpaperFile } from '@/lib/wallpapers';

export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

/**
 * GET: the uploaded wallpaper the dashboard uses, for the sign-in screen. Only that one image is readable before
 * signing in (`?screen=mobile`: the phone wallpaper); every other upload stays behind sign-in.
 */
export async function GET(request: NextRequest) {
  const settings = readConfig().settings ?? {};
  const value = request.nextUrl.searchParams.get('screen') === 'mobile' ? settings.mobileWallpaper : settings.backgroundImage;
  const file = uploadedWallpaperFile(value);
  const type = file ? TYPES[path.extname(file).toLowerCase()] : undefined;
  const target = file && type ? path.join(getLogosDir(), path.basename(file)) : null;
  if (!target || !fs.existsSync(target)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(fs.readFileSync(target), {
    headers: { 'Content-Type': type!, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' },
  });
}
