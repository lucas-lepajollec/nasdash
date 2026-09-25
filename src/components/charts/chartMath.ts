/**
 * Geometry of the Calme charts, kept apart from React so it can be tested:
 * scales, smooth paths, the point under the pointer and tooltip placement.
 */

export type Point = [number, number];

/** Smooth path through points (Catmull-Rom turned into cubic Béziers), clamped between `top` and `bottom`. */
export function smoothPath(points: readonly Point[], top = -Infinity, bottom = Infinity): string {
  if (points.length === 0) return '';
  const f = (value: number) => (Math.round(value * 10) / 10).toString();
  const clampY = (value: number) => Math.min(bottom, Math.max(top, value));
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  if (points.length === 1) return `${d} L${f(points[0][0] + 0.1)} ${f(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    // Control points stay within the segment's x range, so the curve never loops back.
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = clampY(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = clampY(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${f(Math.min(c1x, p2[0]))} ${f(c1y)} ${f(Math.max(c2x, p1[0]))} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** The same path closed down to `baseline`, for a filled area. */
export function areaPath(points: readonly Point[], baseline: number, top = -Infinity): string {
  if (points.length === 0) return '';
  const line = smoothPath(points, top, baseline);
  return `${line} L${points[points.length - 1][0]} ${baseline} L${points[0][0]} ${baseline} Z`;
}

export interface Scale { x: (time: number) => number; y: (value: number) => number; start: number; end: number; max: number }

/**
 * Time on x (`start` → `end` over `width`), value on y (0 → `max` over the
 * plot height, inverted). `max` is fixed (percentages) or rounded up from the
 * data (throughput, temperatures) so the curve never touches the top.
 */
export function scaleFor(options: { width: number; top: number; height: number; start: number; end: number; max?: number; values?: number[] }): Scale {
  const { width, top, height, start, end } = options;
  const max = options.max ?? niceMax(Math.max(0, ...(options.values ?? [0])) * 1.15);
  const span = Math.max(1, end - start);
  return {
    x: time => ((time - start) / span) * width,
    y: value => top + (1 - Math.min(max, Math.max(0, value)) / max) * height,
    start, end, max,
  };
}

/** 1, 2, 2.5 or 5 times a power of ten, at least `value` (and never 0). */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * power >= value) return step * power;
  return 10 * power;
}

/** Index of the point nearest to `time` in a series sorted by time (binary search). */
export function nearestIndex(times: readonly number[], time: number): number {
  if (times.length === 0) return -1;
  let low = 0, high = times.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (times[middle] < time) low = middle + 1; else high = middle;
  }
  if (low > 0 && Math.abs(times[low - 1] - time) <= Math.abs(times[low] - time)) return low - 1;
  return low;
}

/**
 * Left position of a tooltip `width` wide next to the pointer at `x`, inside
 * a box `container` wide: to the right of the pointer, or to its left when it
 * would overflow, and never past either edge.
 */
export function tooltipLeft(x: number, width: number, container: number, gap = 12): number {
  const right = x + gap;
  if (right + width <= container) return right;
  const left = x - gap - width;
  return Math.max(0, left);
}

/**
 * Keeps at most `limit` points by averaging neighbours (peaks kept as the
 * bucket maximum when `keepPeaks`), so a 24 h series stays light to draw.
 */
export function downsample(points: readonly Point[], limit: number, keepPeaks = false): Point[] {
  if (points.length <= limit || limit < 2) return points.slice();
  const size = points.length / limit;
  const result: Point[] = [];
  for (let bucket = 0; bucket < limit; bucket++) {
    const from = Math.floor(bucket * size), to = Math.max(from + 1, Math.floor((bucket + 1) * size));
    let time = 0, sum = 0, peak = -Infinity;
    for (let i = from; i < to; i++) { time += points[i][0]; sum += points[i][1]; peak = Math.max(peak, points[i][1]); }
    const count = to - from;
    result.push([time / count, keepPeaks ? peak : sum / count]);
  }
  return result;
}
