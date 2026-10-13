import { describe, expect, it } from 'vitest';
import { mergeSeries, latestTime } from './deviceData';
import { loadText, percentText, rateText, temperatureText, uptimeText } from './format';
import { readingsOf, withFacets } from './readings';
import { stateOf } from './parts';
import { glancesMetrics } from '@/integrations/glances/collect';

const t = (key: string, variables?: Record<string, string | number>) => `${key}:${JSON.stringify(variables ?? {})}`;

describe('device widgets data', () => {
  it('displays a Synology Glances temperature with its CPU history', () => {
    const snapshot = {
      online: true, updatedAt: 5000, vitals: {},
      metrics: glancesMetrics({ cpu: { total: 5 }, sensors: [{ label: 'k10temp 0', value: 50, type: 'temperature_core', unit: 'C' }] }),
      series: { 'cpu.usage@temp': [[4000, 49], [5000, 50]] as [number, number][] },
    };
    expect(readingsOf(snapshot, 'temperature', t, 'en')).toMatchObject([
      { value: 50, text: '50 °C', points: [[4000, 49], [5000, 50]] },
    ]);
  });

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


describe('separate CPU and GPU temperature readings', () => {
  const snapshot = { online: true, updatedAt: 5000, vitals: {}, series: { 'cpu@temp': [[5000, 45]], 'gpu:a@temp': [[5000, 80]], 'gpu:b@temp': [[5000, 70]] } as Record<string, [number, number][]>, metrics: [
    { key: 'cpu', kind: 'cpu' as const, percent: 10, temperatureC: 45 },
    { key: 'gpu:a', kind: 'gpu' as const, name: 'Graphics A', percent: 20, temperatureC: 80 },
    { key: 'gpu:b', kind: 'gpu' as const, name: 'Graphics B', percent: 30, temperatureC: 70 },
  ] };
  it('keeps the existing temperature option on the CPU even when a GPU runs hotter', () => {
    expect(readingsOf(snapshot, 'temperature', t, 'en')).toMatchObject([{ key: 'cpu@temp', value: 45, points: [[5000, 45]] }]);
    expect(readingsOf(snapshot, 'gpuTemperature', t, 'en')).toMatchObject([{ key: 'gpu:a@temp', value: 80 }, { key: 'gpu:b@temp', value: 70 }]);
  });
  it('does not substitute GPU temperatures for a missing CPU sensor', () => {
    const gpuOnly = { ...snapshot, metrics: snapshot.metrics.filter(metric => metric.kind === 'gpu') };
    expect(readingsOf(gpuOnly, 'temperature', t, 'en')).toEqual([]);
    expect(readingsOf(gpuOnly, 'gpuTemperature', t, 'en')).toHaveLength(2);
    expect(readingsOf({ ...snapshot, metrics: [] }, 'gpuTemperature', t, 'en')).toEqual([]);
  });
  it('marks the device offline after a failed refresh despite an earlier successful snapshot', () => {
    expect(stateOf({ data: snapshot, failed: true })).toBe('offline');
    expect(stateOf({ data: snapshot, failed: false })).toBe('online');
  });

  it('omits redundant CPU/GPU secondary lines but preserves a real GPU model', () => {
    expect(readingsOf(snapshot, 'temperature', t, 'en')[0].detail).toBeUndefined();
    const generic = { ...snapshot, metrics: [{ key: 'gpu', kind: 'gpu' as const, name: 'GPU', percent: 10, temperatureC: 50 }] };
    expect(readingsOf(generic, 'gpu', t, 'en')[0].detail).toBeUndefined();
    expect(readingsOf(generic, 'gpuTemperature', t, 'en')[0].detail).toBeUndefined();
    const named = { ...generic, metrics: [{ ...generic.metrics[0], name: 'RTX 4070' }] };
    const temperature = readingsOf(named, 'gpuTemperature', t, 'en')[0];
    expect(withFacets(temperature, named, ['part'], [], t, 'en').detail).toBe('RTX 4070');
    expect(withFacets(temperature, named, [], [], t, 'en').detail).toBeUndefined();
  });

  it('keeps multiple GPU identities in the labels without duplicating their model below', () => {
    const temperatures = readingsOf(snapshot, 'gpuTemperature', t, 'en');
    expect(temperatures.map(reading => reading.label)).toEqual(expect.arrayContaining([expect.stringContaining('Graphics A'), expect.stringContaining('Graphics B')]));
    expect(temperatures.every(reading => reading.detail === undefined)).toBe(true);
  });
});
