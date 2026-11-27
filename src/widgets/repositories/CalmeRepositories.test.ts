import { describe, expect, it } from 'vitest';
import { activityGrid, activityStreak, cellSize, shownRepositories, weeksThatFit } from './CalmeRepositories';

describe('repositories widget', () => {
  it('fits whole weeks between two months and a year', () => {
    expect(weeksThatFit(0)).toBe(8);
    expect(weeksThatFit(12 * 20 - 3)).toBe(20);
    expect(weeksThatFit(5000)).toBe(53);
    // A wide widget grows the squares (up to 14 px) so the year spans it.
    expect(cellSize(53 * 12 + 52 * 3, 53)).toBe(12);
    expect(cellSize(5000, 53)).toBe(14);
  });
  it('lays the days out Monday first, ending on the last day, with four intensities', () => {
    // 2026-11-26 is a Thursday: the last column holds Monday to Thursday.
    const days = Array.from({ length: 371 }, (_, index) => (index === 370 ? 8 : index === 369 ? 2 : 0));
    const cells = activityGrid({ end: '2026-11-26', days }, 2);
    expect(cells).toHaveLength(7 + 4);
    expect(cells[0].date.getDay()).toBe(1);
    expect(cells.at(-1)).toMatchObject({ count: 8, level: 4 });
    expect(cells.at(-2)).toMatchObject({ count: 2, level: 1 });
    expect(cells[0].level).toBe(0);
  });
  it('counts the streak up to today, or yesterday while today is empty', () => {
    expect(activityStreak([0, 1, 2, 3])).toBe(3);
    expect(activityStreak([1, 1, 0])).toBe(2);
    expect(activityStreak([1, 0, 0])).toBe(0);
  });
  it('hides forks and mirrors only when asked', () => {
    const repos = [{ id: 'a', name: 'a/a', url: '' }, { id: 'b', name: 'a/b', url: '', fork: true }];
    expect(shownRepositories(repos, {})).toHaveLength(2);
    expect(shownRepositories(repos, { forks: false })).toHaveLength(1);
  });
});
