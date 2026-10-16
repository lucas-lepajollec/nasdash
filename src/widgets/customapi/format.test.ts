import { describe, expect, it } from 'vitest';
import type { CustomApiField } from '@/lib/widgetData/contracts';
import { formatValue, shareOf, toneOf } from './format';

const field = (extra: Partial<CustomApiField> = {}): CustomApiField => ({ id: 'f', path: 'x', label: 'X', ...extra });
const fmt = (extra: Partial<CustomApiField>, value: Parameters<typeof formatValue>[1]) => formatValue(field(extra), value, 'en-US', () => 'rel');

describe('custom API values', () => {
  it('formats numbers, units and missing values', () => {
    expect(fmt({ unit: 'ms' }, 7.123)).toEqual({ text: '7.12', unit: 'ms' });
    expect(fmt({ decimals: 1 }, '912.44')).toEqual({ text: '912.4', unit: undefined });
    expect(fmt({}, null)).toEqual({ text: '—' });
    expect(fmt({}, true)).toEqual({ text: '✓' });
  });
  it('formats percentages, bytes, bit rates and durations', () => {
    expect(fmt({ format: 'percent' }, 0.623)).toEqual({ text: '62.3', unit: '%' });
    expect(fmt({ format: 'percent' }, 41)).toEqual({ text: '41', unit: '%' });
    expect(fmt({ format: 'bytes' }, 1536)).toEqual({ text: '1.5', unit: 'KB' });
    expect(fmt({ format: 'bitrate' }, 912_400_000)).toEqual({ text: '912', unit: 'Mbit/s' });
    expect(fmt({ format: 'duration' }, 93784)).toEqual({ text: '1d 2h' });
  });
  it('reads dates from ISO text or epoch seconds', () => {
    expect(fmt({ format: 'relative' }, '2026-01-15T12:00:00Z').text).toBe('rel');
    expect(fmt({ format: 'relative' }, 1_768_478_400).text).toBe('rel');
    expect(fmt({ format: 'date' }, 'not a date').text).toBe('not a date');
  });
  it('colours against thresholds both ways and scales gauges', () => {
    expect(toneOf(field({ warn: 70, crit: 90 }), 95)).toBe('crit');
    expect(toneOf(field({ warn: 70, crit: 90 }), 75)).toBe('warn');
    expect(toneOf(field({ warn: 70 }), 10)).toBe('ok');
    expect(toneOf(field({ warn: 30, crit: 10, lowIsBad: true }), 20)).toBe('warn');
    expect(toneOf(field(), 99)).toBeUndefined();
    expect(shareOf(field({ min: 0, max: 1000 }), 250)).toBe(25);
    expect(shareOf(field(), 140)).toBe(100);
  });
});
