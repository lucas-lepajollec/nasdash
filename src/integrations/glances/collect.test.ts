import { describe, expect, it } from 'vitest';
import { glancesMetrics } from './collect';

describe('Glances CPU temperatures', () => {
  const cpu = (sensors: Parameters<typeof glancesMetrics>[0]['sensors']) =>
    glancesMetrics({ cpu: { total: 5 }, mem: { percent: 38 }, sensors }).find(metric => metric.kind === 'cpu');

  it('reads the unnamed k10temp chip reported on Synology DSM', () => {
    expect(cpu([{ label: 'k10temp 0', value: 50, type: 'temperature_core', unit: 'C' }]))
      .toMatchObject({ percent: 5, temperatureC: 50 });
  });

  it.each(['Tctl', 'Tdie', 'Package id 0', 'Core 0', 'cpu_thermal 0', 'acpitz 0', 'K10TEMP 0'])(
    'keeps recognizing %s without optional sensor metadata', label => {
      expect(cpu([{ label, value: 46 }])?.temperatureC).toBe(46);
    },
  );

  it('prefers an explicit CPU package reading over the chip fallback', () => {
    expect(cpu([{ label: 'k10temp 0', value: 50 }, { label: 'Tctl', value: 55 }])?.temperatureC).toBe(55);
  });

  it('skips invalid readings and accepts a real zero', () => {
    expect(cpu([{ label: 'Tctl', value: NaN }, { label: 'Package id 0', value: Infinity }, { label: 'k10temp 0', value: 0 }])?.temperatureC).toBe(0);
  });

  it('does not substitute fan speeds, batteries or unrelated temperatures for the CPU', () => {
    expect(cpu([
      { label: 'CPU fan', value: 1200, type: 'fan_speed', unit: 'R' },
      { label: 'CPU battery', value: 80, type: 'battery', unit: '%' },
      { label: 'NVMe Composite', value: 39, type: 'temperature_core', unit: 'C' },
    ])).not.toHaveProperty('temperatureC');
    expect(cpu([{ label: 'k10temp 0', value: 122, unit: 'F' }])).not.toHaveProperty('temperatureC');
  });

  it('keeps CPU and memory available when no temperature is reported', () => {
    expect(glancesMetrics({ cpu: { total: 5 }, mem: { percent: 38 }, sensors: [] })).toEqual([
      { key: 'cpu.usage', kind: 'cpu', percent: 5 },
      { key: 'memory.usage', kind: 'memory', percent: 38 },
    ]);
  });
});
