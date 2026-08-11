import { afterEach, describe, expect, it, vi } from 'vitest';

const previousDemoMode = process.env.NASDASH_DEMO_MODE;

afterEach(() => {
  if (previousDemoMode === undefined) delete process.env.NASDASH_DEMO_MODE;
  else process.env.NASDASH_DEMO_MODE = previousDemoMode;
});

describe('interactive Docker demo routes', () => {
  it('resolves a list full id to the matching detailed container and logs', async () => {
    process.env.NASDASH_DEMO_MODE = 'true';
    vi.resetModules();
    const [{ GET: listContainers }, { GET: getContainerDetail }, { GET: getContainerLogs }] = await Promise.all([
      import('./route'),
      import('./[id]/route'),
      import('./[id]/logs/route'),
    ]);

    const listResponse = await listContainers(
      new Request('http://localhost/api/docker/mock-host-1/containers?all=true'),
      { params: Promise.resolve({ hostId: 'mock-host-1' }) },
    );
    const containers = await listResponse.json();

    expect(listResponse.status, JSON.stringify(containers)).toBe(200);
    expect(Array.isArray(containers), JSON.stringify(containers)).toBe(true);
    expect(containers).toHaveLength(20);
    const jellyfin = containers.find((container: { names: string[] }) => container.names.includes('jellyfin'));

    expect(jellyfin.fullId).toHaveLength(64);

    const detailResponse = await getContainerDetail(
      new Request(`http://localhost/api/docker/mock-host-1/containers/${jellyfin.fullId}`),
      { params: Promise.resolve({ hostId: 'mock-host-1', id: jellyfin.fullId }) },
    );
    const detail = await detailResponse.json();

    expect(detail.name).toBe('jellyfin');
    expect(detail.stats.cpuPercent).toBeGreaterThan(0);
    expect(detail.ports).not.toHaveLength(0);
    expect(detail.mounts).not.toHaveLength(0);

    const logsResponse = await getContainerLogs(
      new Request(`http://localhost/api/docker/mock-host-1/containers/${jellyfin.fullId}/logs?tail=150`),
      { params: Promise.resolve({ hostId: 'mock-host-1', id: jellyfin.fullId }) },
    );
    const logs = await logsResponse.json();

    expect(logs.lines.length).toBeGreaterThanOrEqual(5);
    expect(logs.lines.join('\n')).toContain('jellyfin');
  });
});
