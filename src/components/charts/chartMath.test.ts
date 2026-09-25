import { describe, expect, it } from 'vitest';
import { areaPath, downsample, nearestIndex, niceMax, scaleFor, smoothPath, tooltipLeft } from './chartMath';

describe('chart geometry', () => {
  it('draws a smooth path that never overshoots its bounds', () => {
    const d = smoothPath([[0, 10], [10, 90], [20, 10]], 0, 100);
    expect(d.startsWith('M0 10 C')).toBe(true);
    const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const ys = numbers.filter((_, index) => index % 2 === 1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(areaPath([[0, 10], [10, 20]], 50)).toMatch(/L10 50 L0 50 Z$/);
    expect(smoothPath([])).toBe('');
  });

  it('scales time and values, rounding the top up for open-ended values', () => {
    const scale = scaleFor({ width: 100, top: 0, height: 50, start: 1000, end: 2000, max: 100 });
    expect(scale.x(1500)).toBe(50);
    expect(scale.y(100)).toBe(0);
    expect(scale.y(150)).toBe(0);
    expect(scale.y(0)).toBe(50);
    expect(scaleFor({ width: 1, top: 0, height: 1, start: 0, end: 1, values: [3.1e6] }).max).toBe(5e6);
    expect(niceMax(0)).toBe(1);
    expect(niceMax(42)).toBe(50);
    expect(niceMax(0.9)).toBe(1);
  });

  it('finds the point under the pointer', () => {
    const times = [0, 10, 20, 30];
    expect(nearestIndex(times, 14)).toBe(1);
    expect(nearestIndex(times, 16)).toBe(2);
    expect(nearestIndex(times, -5)).toBe(0);
    expect(nearestIndex(times, 99)).toBe(3);
    expect(nearestIndex([], 5)).toBe(-1);
  });

  it('keeps tooltips inside their block', () => {
    expect(tooltipLeft(50, 100, 400)).toBe(62);
    expect(tooltipLeft(350, 100, 400)).toBe(238);
    expect(tooltipLeft(60, 100, 120)).toBe(0);
  });

  it('thins long series, optionally keeping the peaks', () => {
    const points = Array.from({ length: 1000 }, (_, i) => [i, i % 10 === 0 ? 100 : 0] as [number, number]);
    const thin = downsample(points, 100);
    expect(thin).toHaveLength(100);
    expect(thin[0][1]).toBe(10);
    expect(downsample(points, 100, true)[0][1]).toBe(100);
    expect(downsample(points.slice(0, 5), 100)).toHaveLength(5);
  });
});
