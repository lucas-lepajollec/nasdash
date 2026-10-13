import { afterEach, describe, expect, it, vi } from 'vitest';
import { beszelMetrics, collectBeszel } from './collect';

const sensors = {
  t: { 'k10temp Tctl': 45, 'Graphics A': 85, 'Graphics B': 70, nvme: 95 },
  g: { 'gpu-a': { n: 'Graphics A', u: 20, mt: 8192, mu: 2048 }, 'gpu-b': { n: 'Graphics B', u: 0 } },
};
const system = { id: 'fictional-node', name: 'node', status: 'up', info: { cpu: 10, mp: 40, g: 20, dt: 95 } };
afterEach(() => vi.unstubAllGlobals());

describe('Beszel identified temperature sensors', () => {
  it('keeps the chosen dashboard/disk/GPU temperature out of CPU temperature', () => {
    const metrics = beszelMetrics(system, sensors);
    expect(metrics.find(metric => metric.kind === 'cpu')).toMatchObject({ temperatureC: 45 });
    expect(metrics.filter(metric => metric.kind === 'gpu')).toMatchObject([
      { key: 'gpu.usage:gpu-a', name: 'Graphics A', percent: 20, temperatureC: 85, totalBytes: 8192 * 1024 ** 2, usedBytes: 2048 * 1024 ** 2 },
      { key: 'gpu.usage:gpu-b', name: 'Graphics B', percent: 0, temperatureC: 70 },
    ]);
  });
  it('keeps legacy usage but reports temperatures as unavailable when identities are absent', () => {
    const metrics = beszelMetrics(system);
    expect(metrics.find(metric => metric.kind === 'cpu')).not.toHaveProperty('temperatureC');
    expect(metrics.find(metric => metric.kind === 'gpu')).toMatchObject({ key: 'gpu.usage', percent: 20 });
    expect(metrics.find(metric => metric.kind === 'gpu')).not.toHaveProperty('temperatureC');
  });
  it('fetches the latest named sensor record with the current authenticated session', async () => {
    const requests: Array<{ url: string; authorization?: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
      requests.push({ url, authorization: (options.headers as Record<string, string>)?.Authorization });
      if (url.endsWith('/auth-with-password')) return Response.json({ token: 'fictional-session' });
      if (url.includes('/system_stats/')) return Response.json({ items: [{ stats: sensors }] });
      return Response.json({ items: [system] });
    }));
    const result = await collectBeszel({ url: 'http://monitor.example.test', token: 'test:password', target: system.id }, { memory: {}, warn: vi.fn(), clearWarning: vi.fn() });
    expect(result).toMatchObject({ metrics: [{ kind: 'cpu', temperatureC: 45 }, { kind: 'memory' }, { kind: 'gpu', temperatureC: 85 }, { kind: 'gpu', temperatureC: 70 }] });
    const request = requests.at(-1)!;
    expect(request.authorization).toBe('fictional-session');
    const query = new URL(request.url).searchParams;
    expect(query.get('filter')).toBe('system="fictional-node" && type="1m"');
    expect(query.get('sort')).toBe('-created');
    expect(query.get('perPage')).toBe('1');
  });
  it('does not take the device offline when older/restricted hubs lack sensor-record access', async () => {
    const warn = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/auth-with-password')) return Response.json({ token: 'fictional-session' });
      if (url.includes('/system_stats/')) return new Response('', { status: 403 });
      return Response.json({ items: [system] });
    }));
    const result = await collectBeszel({ url: 'http://monitor.example.test', token: 'test:password', target: system.id }, { memory: {}, warn, clearWarning: vi.fn() });
    expect(result).toMatchObject({ metrics: [{ kind: 'cpu', percent: 10 }, { kind: 'memory', percent: 40 }, { kind: 'gpu', percent: 20 }] });
    expect(warn).toHaveBeenCalledWith('Beszel sensors', expect.objectContaining({ status: 403 }));
  });
});
