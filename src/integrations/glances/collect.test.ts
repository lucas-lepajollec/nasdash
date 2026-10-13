import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectGlances, glancesMetrics } from './collect';

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

  it('does not mistake a GPU core sensor for the CPU temperature', () => {
    expect(cpu([{ label: 'GPU Core', value: 85 }, { label: 'k10temp 0', value: 46 }])?.temperatureC).toBe(46);
    expect(cpu([{ label: 'GPU Core', value: 85 }])).not.toHaveProperty('temperatureC');
  });

  it('keeps CPU and memory available when no temperature is reported', () => {
    expect(glancesMetrics({ cpu: { total: 5 }, mem: { percent: 38 }, sensors: [] })).toEqual([
      { key: 'cpu.usage', kind: 'cpu', percent: 5 },
      { key: 'memory.usage', kind: 'memory', percent: 38 },
    ]);
  });
});


describe('Glances endpoint and filesystem resilience', () => {
  afterEach(() => vi.unstubAllGlobals());
  const context = () => ({ memory: {} as Record<string, string>, warn: vi.fn(), clearWarning: vi.fn() });
  it('rediscovers an upgraded API after its remembered version returns 404', async () => {
    const ctx = context();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ cpu: { total: 1 } }))));
    await collectGlances({ url: 'http://monitor.example' }, ctx);
    ctx.memory.url = 'http://monitor.example/api/3/all';
    const fetch = vi.fn(async (url: string) => url.endsWith('/api/4/all') ? new Response(JSON.stringify({ cpu: { total: 42 } })) : new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetch);
    expect(await collectGlances({ url: 'http://monitor.example' }, ctx)).toMatchObject({ metrics: [{ percent: 42 }] });
    expect(ctx.memory.url).toBe('http://monitor.example/api/4/all');
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['http://monitor.example/api/3/all', 'http://monitor.example/api/5/all', 'http://monitor.example/api/4/all']);
  });
  it.each([null, [], { hello: 'world' }, { cpu: { total: 'bad' } }])('rejects unrelated or malformed JSON: %j', async data => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(data))));
    await expect(collectGlances({ url: 'http://monitor.example' }, context())).rejects.toThrow('integrations.invalidResponse');
  });
  it('retains independent filesystems with identical capacity and identifies actual bind mounts', () => {
    const metrics = glancesMetrics({ fs: [
      { mnt_point: '/a', size: 1000, percent: 20 },
      { mnt_point: '/b', size: 1000, percent: 80 },
      { mnt_point: '/mount/bind/long', size: 1000, percent: 25, device_name: '/dev/test' },
      { mnt_point: '/data', size: 1000, percent: 25, device_name: '/dev/test' },
    ] });
    expect(metrics.map(metric => [metric.key, metric.percent])).toEqual([['disk.usage:/a', 20], ['disk.usage:/b', 80], ['disk.usage:/data', 25]]);
  });
});
