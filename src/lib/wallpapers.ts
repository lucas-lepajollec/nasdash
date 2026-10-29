/** Wallpapers shipped in `public/wallpapers` (sources and licences in its CREDITS.md). The first is the default. */
export const BUNDLED_WALLPAPERS = [
  { id: 'aurora-lake', src: '/wallpapers/aurora-lake.jpg' },
  { id: 'atlantic-aurora', src: '/wallpapers/atlantic-aurora.jpg' },
  { id: 'fjord-milky-way', src: '/wallpapers/fjord-milky-way.jpg' },
  { id: 'starry-lake', src: '/wallpapers/starry-lake.jpg' },
  { id: 'starry-night', src: '/wallpapers/starry-night.jpg' },
] as const;
export const DEFAULT_WALLPAPER = BUNDLED_WALLPAPERS[0].src;
export const isBundledWallpaper = (value: unknown): value is string => typeof value === 'string' && BUNDLED_WALLPAPERS.some(item => item.src === value);
