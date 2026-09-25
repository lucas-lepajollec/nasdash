import { describe, expect, it } from 'vitest';
import sample from '../integrations/docker/samples/dockhand-containers.json';
import { dockhandCall } from './dockhand';

describe('dockhand adapter', () => {
  it('maps the Docker endpoints NasDash uses', () => {
    expect(dockhandCall('/containers/json?all=true&size=false', 'GET', '2')?.path).toBe('/api/containers?env=2&all=true');
    expect(dockhandCall('/containers/abc/json', 'GET', '2')?.path).toBe('/api/containers/abc/inspect?env=2');
    expect(dockhandCall('/containers/abc/logs?stdout=true&tail=200', 'GET', '2')?.path).toBe('/api/containers/abc/logs?env=2&tail=200');
    expect(dockhandCall('/containers/abc/restart', 'POST', '2')?.path).toBe('/api/containers/abc/restart?env=2');
    expect(dockhandCall('/containers/abc?force=true', 'DELETE', '2')?.method).toBe('DELETE');
    expect(dockhandCall('/images/sha256%3Aaa', 'DELETE', '2')?.path).toBe('/api/images/sha256%3Aaa?env=2');
    expect(dockhandCall('/volumes/data', 'DELETE', '2')?.path).toBe('/api/volumes/data?env=2');
    expect(dockhandCall('/containers/abc/exec', 'POST', '2')).toBeUndefined();
  });

  it('shapes answers like the Docker Engine API', () => {
    const list = dockhandCall('/containers/json?all=true', 'GET', '1')!.convert(sample).json as { Names: string[]; State: string }[];
    expect(list.map(container => [container.Names[0], container.State])).toEqual([['/jellyfin', 'running'], ['/forgejo', 'exited']]);
    const stats = dockhandCall('/containers/abc/stats?stream=false', 'GET', '1')!.convert({ cpuPercent: 12.5, memoryRaw: 100, memoryLimit: 1000, networkRx: 5, networkTx: 7 }).json as {
      cpu_stats: { cpu_usage: { total_usage: number }; system_cpu_usage: number; online_cpus: number };
      precpu_stats: { cpu_usage: { total_usage: number }; system_cpu_usage: number };
    };
    // The route's formula (cpu delta / system delta × CPUs × 100) gives Dockhand's percentage back.
    const cpu = (stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage) / (stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage) * stats.cpu_stats.online_cpus * 100;
    expect(cpu).toBeCloseTo(12.5);
    expect(dockhandCall('/containers/abc/logs', 'GET', '1')!.convert({ logs: 'a\nb' }).text).toBe('a\nb');
    expect(dockhandCall('/volumes', 'GET', '1')!.convert([{ Name: 'v', Driver: 'local' }]).json).toEqual({ Volumes: [{ Name: 'v', Driver: 'local' }], Warnings: null });
  });
});
