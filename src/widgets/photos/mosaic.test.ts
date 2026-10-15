import { describe, expect, it } from 'vitest';
import { packMosaic, type Tile, wantedSpan } from './mosaic';

/** Every cell of the rows used is covered exactly once. */
function holes(tiles: Tile[], columns: number): number {
  const rows = Math.max(...tiles.map(tile => tile.row + tile.rows));
  const seen = new Map<string, number>();
  for (const tile of tiles) for (let r = tile.row; r < tile.row + tile.rows; r++) for (let c = tile.column; c < tile.column + tile.columns; c++) seen.set(`${r}:${c}`, (seen.get(`${r}:${c}`) ?? 0) + 1);
  expect([...seen.values()].every(count => count === 1)).toBe(true);
  expect(tiles.every(tile => tile.column + tile.columns <= columns)).toBe(true);
  return rows * columns - seen.size;
}

describe('photo mosaic', () => {
  it('mixes sizes and ends without holes', () => {
    const ratios = [1.5, 0.67, 1.5, 1.5, 0.67, 1.5, 1.5];
    for (const columns of [2, 3, 4, 5]) {
      for (let count = 1; count <= ratios.length; count++) {
        const tiles = packMosaic(ratios.slice(0, count).map((ratio, index) => wantedSpan(ratio, index, columns)), columns);
        expect(holes(tiles, columns)).toBe(0);
      }
    }
  });
  it('keeps the large square and tall photos', () => {
    const spans = packMosaic([wantedSpan(1.5, 0, 4), wantedSpan(0.6, 1, 4)], 4);
    expect(spans[0]).toMatchObject({ columns: 2, rows: 2 });
    expect(spans[1].rows).toBe(2);
  });
  it('never overlaps nor leaves holes, whatever the photos', () => {
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let run = 0; run < 400; run++) {
      const columns = 2 + Math.floor(random() * 5);
      const ratios = Array.from({ length: 1 + Math.floor(random() * 24) }, () => [0.67, 1, 1.5, 1.78][Math.floor(random() * 4)]);
      expect(holes(packMosaic(ratios.map((ratio, index) => wantedSpan(ratio, index, columns)), columns), columns)).toBe(0);
    }
  });
});
