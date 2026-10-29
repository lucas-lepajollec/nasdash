/** Wallpapers shipped in `public/wallpapers`, drawn by `scripts/generate-wallpapers.mjs`. The first is the default. */
export const BUNDLED_WALLPAPERS = [
  { id: 'aurora', src: '/wallpapers/nasdash-aurora.jpg' },
  { id: 'dusk', src: '/wallpapers/nasdash-dusk.jpg' },
  { id: 'mist', src: '/wallpapers/nasdash-mist.jpg' },
  { id: 'waves', src: '/wallpapers/nasdash-waves.jpg' },
  { id: 'dawn', src: '/wallpapers/nasdash-dawn.jpg' },
] as const;
export const DEFAULT_WALLPAPER = BUNDLED_WALLPAPERS[0].src;
export const isBundledWallpaper = (value: unknown): value is string => typeof value === 'string' && BUNDLED_WALLPAPERS.some(item => item.src === value);

/** An image uploaded in Appearance: `/api/logos/<file>`. */
const UPLOADED = /^\/api\/logos\/([A-Za-z0-9._-]+)$/;
export function uploadedWallpaperFile(value: unknown): string | null {
  return typeof value === 'string' ? UPLOADED.exec(value)?.[1] ?? null : null;
}

/**
 * The wallpaper the sign-in screen shows: the dashboard's own one. A bundled image as is, an uploaded one through
 * `/api/setup/wallpaper` (which serves that single file before signing in), an external address as is; none when
 * the dashboard has none (the theme's background then shows).
 */
export function signInWallpaper(value: unknown, which: 'desktop' | 'mobile' = 'desktop'): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (isBundledWallpaper(value)) return value;
  if (uploadedWallpaperFile(value)) return which === 'mobile' ? '/api/setup/wallpaper?screen=mobile' : '/api/setup/wallpaper';
  return /^https?:\/\//i.test(value) ? value : null;
}
