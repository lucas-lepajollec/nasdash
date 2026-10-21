/** Preserve ordering while limiting independent upstream operations. */
export async function mapBounded<T, R>(rows: readonly T[], limit: number, load: (row: T) => Promise<R>): Promise<R[]> {
  let cursor = 0;
  const result: R[] = [];
  await Promise.all(Array.from({ length: Math.min(limit, rows.length) }, async () => {
    while (cursor < rows.length) { const i = cursor++; result[i] = await load(rows[i]); }
  }));
  return result;
}
