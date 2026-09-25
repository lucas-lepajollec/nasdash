import { describe, expect, it } from 'vitest';
import { formatBytes, percentText, readingFromMetric, readingFromStat, temperatureText, toReadings } from './deviceReadings';

const GIB = 1024 ** 3;

describe('device readings', () => {
  it('formats capacities per language', () => {
    expect(formatBytes(64 * GIB, 'fr')).toBe('64 Go');
    expect(formatBytes(15.6 * GIB, 'en')).toBe('16 GB');
    expect(formatBytes(5.6 * GIB, 'fr')).toBe('5,6 Go');
    expect(formatBytes(5.6 * GIB, 'de')).toBe('5.6 GB');
    expect(formatBytes(1800 * GIB, 'fr')).toBe('1,8 To');
    expect(formatBytes(1800 * GIB, 'en')).toBe('1.8 TB');
  });

  it('reads metrics with used and total space', () => {
    const reading = readingFromMetric({ key: 'disk.usage:data', kind: 'disk', name: 'data', percent: 42.9, usedBytes: 210 * GIB, totalBytes: 500 * GIB, temperatureC: 38.6 }, 'en');
    expect(reading).toMatchObject({ id: 'Disque (data)', kind: 'disk', name: 'data', capacity: '210 GB / 500 GB' });
    expect(percentText(reading)).toBe('42%');
    expect(temperatureText(reading)).toBe('39°C');
    expect(readingFromMetric({ key: 'cpu.usage', kind: 'cpu', percent: 130 }, 'fr').percent).toBe(100);
  });

  it('still reads hand-written stats', () => {
    expect(readingFromStat({ label: 'Disque (Système)', value: '28% (36 Go / 128 Go)', percent: 28, color: 'var(--nd-orange)' }, 'en'))
      .toMatchObject({ id: 'Disque (Système)', kind: 'disk', name: 'Système', percent: 28, capacity: '36 GB / 128 GB' });
    expect(readingFromStat({ label: 'CPU', value: '12,5%  61°C' }, 'fr')).toMatchObject({ kind: 'other', name: 'CPU', percent: 12.5, temperatureC: 61, capacity: '' });
  });

  it('accepts a mix of metrics and stats', () => {
    expect(toReadings([{ key: 'memory.usage', kind: 'memory', percent: 50 }, { label: 'Uptime', value: '3j' }], 'fr').map(reading => reading.id)).toEqual(['RAM', 'Uptime']);
  });
});
