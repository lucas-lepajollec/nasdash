import { describe, expect, it } from 'vitest';
import { interpolate, messages, UI_LANGUAGES } from './messages';

describe('NasDash interface translations', () => {
  it('keeps the same message keys in every maintained language', () => {
    const canonical = Object.keys(messages.en).sort();
    expect(canonical.length).toBeGreaterThan(0);
    for (const { id } of UI_LANGUAGES) {
      expect(Object.keys(messages[id]).sort()).toEqual(canonical);
      expect(Object.values(messages[id]).every((value) => value.trim().length > 0)).toBe(true);
    }
  });

  it('interpolates named values without removing unknown placeholders', () => {
    expect(interpolate('{count} active — {missing}', { count: 3 })).toBe('3 active — {missing}');
  });

  it('keeps interpolation placeholders aligned across languages', () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]).sort();

    for (const key of Object.keys(messages.en)) {
      const expected = placeholders(messages.en[key]);
      for (const { id } of UI_LANGUAGES) {
        expect(placeholders(messages[id][key]), `${id}:${key}`).toEqual(expected);
      }
    }
  });
});
