import { describe, expect, it } from 'vitest';
import { mergeSeries, latestTime } from './deviceData';
import { loadText, percentText, rateText, temperatureText, uptimeText } from './format';
import { withFacets } from './readings';

const t = (key: string, variables?: Record<string, string | number>) => `${key}:${JSON.stringify(variables ?? {})}`;

describe('device widgets data', () => {
  it('adds newer points, replaces the minute still averaged and drops what left the window', () => {
    const merged = mergeSeries(
      { cpu: [[1000, 10], [2000, 20], [3000, 30]], old: [[500, 1]] },
      { cpu: [[3000, 35, 40], [4000, 40, 42]], ram: [[4000, 50]] },
      1500,
    );
    expect(merged.cpu).toEqual([[2000, 20], [3000, 35, 40], [4000, 40, 42]]);
    expect(merged.ram).toEqual([[4000, 50]]);
    expect(merged.old).toEqual([]);
  });

  it('ends the chart window on the latest reading', () => {
    expect(latestTime({ online: true, updatedAt: 5000, metrics: [], vitals: {}, series: { cpu: [[7000, 1]] } })).toBe(7000);
    expect(latestTime(undefined)).toBe(0);
  });
});

describe('device widgets formatting', () => {
  it('writes percentages, rates and temperatures per language', () => {
    expect(percentText(23.4, 'fr')).toBe('23 %');
    expect(percentText(23.6, 'en')).toBe('24%');
    expect(percentText(undefined, 'en')).toBe('–');
    expect(rateText(2_450_000, 'fr')).toBe('2,3 Mo/s');
    expect(rateText(830_000, 'en')).toBe('811 KB/s');
    expect(rateText(512, 'en')).toBe('512 B/s');
    expect(temperatureText(46.4)).toBe('46 °C');
    expect(loadText([0.824, 0.7, 0.6], 'fr')).toBe('0,82');
  });

  it('writes the uptime with the largest units', () => {
    expect(uptimeText(12 * 86_400 + 4 * 3600 + 120, t)).toBe('devices.calme.uptimeDays:{"days":12,"hours":4}');
    expect(uptimeText(3 * 3600 + 12 * 60, t)).toBe('devices.calme.uptimeHours:{"hours":3,"minutes":12}');
    expect(uptimeText(20, t)).toBe('devices.calme.uptimeMinutes:{"minutes":1}');
    expect(uptimeText(undefined, t)).toBe('');
  });
});

describe('RAM and disk values', () => {
  const GIB = 1024 ** 3;
  const reading = {
    metric: 'disk' as const, key: 'disk.usage:/data', label: 'data', value: 42, text: '42 %', points: [],
    source: { key: 'disk.usage:/data', kind: 'disk' as const, percent: 42, usedBytes: 210 * GIB, totalBytes: 500 * GIB },
  };
  const write = (parts: Array<'percent' | 'used' | 'free' | 'total'>, display = 'bar') => {
    const shown = withFacets(reading, undefined, [], parts, key => key, 'fr', display);
    return [shown.text, shown.detail];
  };
  it('shows only the chosen values, a size followed by the total', () => {
    expect(write(['percent', 'total'])).toEqual(['42 %', '500 Go']);
    expect(write(['used', 'total'])).toEqual(['210 Go / 500 Go', undefined]);
    expect(write(['percent', 'free'])).toEqual(['42 %', 'devices.calme.free']);
    expect(write(['used'])).toEqual(['210 Go', undefined]);
    // A ring shows the share in its centre, the rest under it.
    expect(write(['percent', 'used', 'total'], 'ring')).toEqual(['42 %', '210 Go / 500 Go']);
  });
});
