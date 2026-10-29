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
