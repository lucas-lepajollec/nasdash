import { LIGHT_THEMES } from './themes';

/** The themes drawn in `public/wallpapers/themes` (`nasdash` is the default theme). */
export const THEMED_WALLPAPERS = [
  'nasdash', 'apple-dark', 'apple-light', 'catppuccin-latte', 'catppuccin-macchiato', 'cyberpunk', 'dracula', 'everforest-dark', 'everforest-light',
  'github-dark', 'github-light', 'gruvbox-dark', 'gruvbox-light', 'kanagawa-wave', 'matrix-cyber', 'midnight', 'nord', 'nord-light', 'ocean',
  'one-dark-pro', 'rose-pine-dark', 'rose-pine-dawn', 'solarized-dark', 'solarized-light', 'tokyo-night', 'tokyo-night-day',
];

/**
 * The wallpaper that follows the theme: the same soft folds, re-tinted for each
 * theme (`public/wallpapers/themes/<theme>.webp`, and `-portrait` for phones; made
 * for NasDash with an image model, then converted to WebP).
 * Saved as this value; drawn through `resolveWallpaper`.
 */
export const THEME_WALLPAPER = '/wallpapers/themes/';
export function themeWallpaper(theme: string | undefined, phone = false, light = false): string {
  // NasDash's own theme in light mode takes the light picture.
  const known = (!theme || theme === 'nasdash') && light ? 'apple-light' : THEMED_WALLPAPERS.includes(theme ?? '') ? theme! : LIGHT_THEMES.includes(theme ?? '') ? 'apple-light' : 'nasdash';
  return `${THEME_WALLPAPER}${known}${phone ? '-portrait' : ''}.webp`;
}
/** The picture a saved wallpaper value draws, for this theme and screen. */
export function resolveWallpaper(value: string | null | undefined, theme: string | undefined, phone = false, light = false): string {
  return value === THEME_WALLPAPER ? themeWallpaper(theme, phone, light) : value ?? '';
}

/** Wallpapers shipped in `public/wallpapers`: the one that follows the theme, then those drawn by `scripts/generate-wallpapers.mjs`. The first is the default. */
export const BUNDLED_WALLPAPERS = [
  { id: 'theme', src: THEME_WALLPAPER },
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
