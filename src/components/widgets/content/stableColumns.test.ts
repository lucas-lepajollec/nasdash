import { describe, expect, it } from 'vitest';
import { stableColumns } from './kit';

describe('stableColumns', () => {
  it('fills the line with equal columns while the items do not all fit', () => {
    expect(stableColumns(300, 10, 76, 112, 10)).toBe('repeat(3, minmax(0, 1fr))');
  });
  it('keeps the items at their size once they all fit, whatever the width', () => {
    expect(stableColumns(900, 5, 76, 112, 10)).toBe('repeat(5, 112px)');
    expect(stableColumns(1400, 5, 76, 112, 10)).toBe('repeat(5, 112px)');
  });
  it('lets them grow up to the maximum while they all fit', () => {
    expect(stableColumns(440, 5, 76, 112, 10)).toBe('repeat(5, 80px)');
  });
  it('has no opinion before the width is known', () => {
    expect(stableColumns(0, 5, 76, 112, 10)).toBeUndefined();
  });
});

describe('posterWidth', () => {
  it('keeps the posters at their size whatever the width', async () => {
    const { posterWidth } = await import('@/widgets/media-recent/CalmeRecent');
    expect(posterWidth(440, 120)).toBe(120);
    expect(posterWidth(1600, 120)).toBe(120);
    expect(posterWidth(90, 120)).toBe(90);
  });
  it('spans the whole width with a short line when asked to fill (phones)', () => {
    expect(stableColumns(500, 4, 62, 74, 4, true)).toBe('repeat(4, minmax(0, 1fr))');
    expect(stableColumns(500, 4, 62, 74, 4)).toBe('repeat(4, 74px)');
    expect(stableColumns(300, 10, 62, 74, 4, true)).toBe('repeat(4, minmax(0, 1fr))');
  });
});
