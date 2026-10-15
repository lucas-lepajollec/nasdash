/** Size of one mosaic tile, in grid columns and rows. */
export interface Span { columns: number; rows: number }
/** A placed tile: its first row and column (from 0) and its size. */
export interface Tile extends Span { row: number; column: number }

/** The size a photo asks for: wide photos two columns, tall ones two rows, a large square now and then. */
export function wantedSpan(ratio: number, position: number, columns: number): Span {
  if (columns >= 3 && position % 7 === 0) return { columns: 2, rows: 2 };
  if (ratio < 0.85) return { columns: 1, rows: 2 };
  if (columns >= 3 && ratio > 1.25 && position % 3 === 1) return { columns: 2, rows: 1 };
  return { columns: 1, rows: 1 };
}

/**
 * Places the tiles like the browser's dense grid (each in the first free
 * spot, row by row), then grows tiles next to the holes left at the bottom
 * so the mosaic ends square. Returns where each tile goes.
 */
export function packMosaic(wanted: Span[], columns: number): Tile[] {
  // When holes stay, the last large tile becomes a small one and it tries again:
  // with small tiles only, the last row always closes.
  let sizes = wanted.map(span => ({ ...span }));
  for (;;) {
    const { tiles, holes } = place(sizes, columns);
    const large = sizes.map((span, index) => (span.columns > 1 || span.rows > 1 ? index : -1)).filter(index => index >= 0).pop();
    if (!holes || large === undefined) return tiles;
    sizes = sizes.map((span, index) => (index === large ? { columns: 1, rows: 1 } : span));
  }
}

function place(wanted: Span[], columns: number): { tiles: Tile[]; holes: number } {
  const spans = wanted.map(span => ({ columns: Math.min(span.columns, columns), rows: span.rows }));
  const grid: number[][] = [];
  const cell = (row: number, column: number) => grid[row]?.[column] ?? -1;
  const fill = (index: number, row: number, column: number, span: Span) => {
    for (let r = row; r < row + span.rows; r++) for (let c = column; c < column + span.columns; c++) (grid[r] ??= Array(columns).fill(-1))[c] = index;
  };
  const fits = (row: number, column: number, span: Span) => {
    if (column + span.columns > columns) return false;
    for (let r = row; r < row + span.rows; r++) for (let c = column; c < column + span.columns; c++) if (cell(r, c) !== -1) return false;
    return true;
  };
  const origin: { row: number; column: number }[] = [];
  spans.forEach((span, index) => {
    for (let row = 0; ; row++) {
      const column = Array.from({ length: columns }, (_, c) => c).find(c => fits(row, c, span));
      if (column !== undefined) { fill(index, row, column, span); origin[index] = { row, column }; return; }
    }
  });
  // Holes: a neighbouring tile grows into them (the one on the left, then
  // the right, then above), whole side at once so tiles stay rectangles.
  const free = (rows: number[], cols: number[]) => rows.every(r => cols.every(c => c >= 0 && c < columns && cell(r, c) === -1));
  const range = (start: number, length: number) => Array.from({ length }, (_, i) => start + i);
  const take = (index: number) => { for (const r of range(origin[index].row, spans[index].rows)) for (const c of range(origin[index].column, spans[index].columns)) grid[r][c] = index; };
  for (let row = 0; row < grid.length; row++) {
    for (let column = 0; column < columns; column++) {
      if (cell(row, column) !== -1) continue;
      const left = cell(row, column - 1), right = cell(row, column + 1), above = cell(row - 1, column);
      if (left !== -1 && origin[left].column + spans[left].columns === column && free(range(origin[left].row, spans[left].rows), [column])) { spans[left].columns++; take(left); }
      else if (right !== -1 && origin[right].column === column + 1 && free(range(origin[right].row, spans[right].rows), [column])) { spans[right].columns++; origin[right].column = column; take(right); }
      else if (above !== -1 && origin[above].row + spans[above].rows === row && free([row], range(origin[above].column, spans[above].columns))) { spans[above].rows++; take(above); }
    }
  }
  return { tiles: spans.map((span, index) => ({ ...span, ...origin[index] })), holes: grid.flat().filter(index => index === -1).length };
}
