import { describe, expect, it } from 'vitest';
import { halfHours } from './CalmeDns';

describe('DNS chart buckets', () => {
  it('sums reports per half-hour and leaves out the cut half-hours at both ends', () => {
    const start = Date.UTC(2026, 0, 1, 10, 10);
    // Every 10 min from 10:10 to 12:00: 10:00 and 12:00 half-hours are incomplete.
    const history = Array.from({ length: 12 }, (_, i): [number, number, number] => [start + i * 600_000, 10, 2]);
    const buckets = halfHours(history);
    expect(buckets.map(([time]) => new Date(time).toISOString().slice(11, 16))).toEqual(['10:45', '11:15', '11:45']);
    expect(buckets.every(([, total, blocked]) => total === 30 && blocked === 6)).toBe(true);
  });
});
