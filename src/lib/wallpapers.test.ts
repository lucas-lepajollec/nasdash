import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUNDLED_WALLPAPERS, resolveWallpaper, THEME_WALLPAPER, THEMED_WALLPAPERS, themeWallpaper } from './wallpapers';

describe('wallpapers', () => {
  it('draws the wallpaper that follows the theme as that theme’s picture', () => {
    expect(resolveWallpaper(THEME_WALLPAPER, 'nord')).toBe('/wallpapers/themes/nord.webp');
    expect(resolveWallpaper(THEME_WALLPAPER, 'nord', true)).toBe('/wallpapers/themes/nord-portrait.webp');
    expect(resolveWallpaper(THEME_WALLPAPER, 'nasdash', false, true)).toBe('/wallpapers/themes/apple-light.webp');
    expect(resolveWallpaper(THEME_WALLPAPER, 'unknown-theme')).toBe('/wallpapers/themes/nasdash.webp');
    expect(resolveWallpaper('/wallpapers/nasdash-dusk.jpg', 'nord')).toBe('/wallpapers/nasdash-dusk.jpg');
    expect(resolveWallpaper('', 'nord')).toBe('');
  });
  it('ships every bundled picture', () => {
    const themes = THEMED_WALLPAPERS;
    const files = [...BUNDLED_WALLPAPERS.filter(item => item.src !== THEME_WALLPAPER).map(item => item.src), ...themes.flatMap(theme => [themeWallpaper(theme), themeWallpaper(theme, true)])];
    for (const file of files) expect(existsSync(join(process.cwd(), 'public', file)), file).toBe(true);
  });
});
