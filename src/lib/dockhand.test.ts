import { describe, expect, it } from 'vitest';
import { dockhandCall } from './dockhand';

describe('Dockhand Docker relay normalisation', () => {
  it('keeps canonical container identity, image IDs, ports and volume references', () => {
    const body = [{ id: 'a'.repeat(64), name: 'web', image: 'web:old', imageId: `sha256:${'b'.repeat(64)}`, ports: [{ PrivatePort: 80, Type: 'tcp' }], mounts: [{ type: 'volume', name: 'data', source: '/data', destination: '/app', rw: true }], labels: { 'com.docker.compose.service': 'web' }, state: 'running', status: 'Up 1 hour' }];
    const result = dockhandCall('/containers/json?all=true', 'GET', '12')!;
    expect(result.path).toBe('/api/containers?env=12&all=true');
    expect(result.convert(body).json).toEqual([expect.objectContaining({ Id: body[0].id, ImageID: body[0].imageId, Labels: body[0].labels, Mounts: [{ Type: 'volume', Name: 'data', Source: '/data', Destination: '/app', RW: true }] })]);
  });
  it('normalises actual lowercase images including unused and untagged images', () => {
    const image = { id: `sha256:${'c'.repeat(64)}`, repoTags: [], repoDigests: ['registry.test/web@sha256:abc'], size: 512, created: 100, containers: 2, labels: { 'org.opencontainers.image.title': 'Web' } };
    expect(dockhandCall('/images/json', 'GET', '1')!.convert([image]).json).toEqual([{ Id: image.id, RepoTags: [], RepoDigests: image.repoDigests, Size: 512, Created: 100, Containers: 2, Labels: image.labels }]);
  });
  it('also accepts uppercase Engine image responses exposed by older relays', () => {
    expect(dockhandCall('/images/json', 'GET', '1')!.convert([{ Id: 'image', RepoTags: ['web:1'] }]).json).toEqual([expect.objectContaining({ Id: 'image', RepoTags: ['web:1'] })]);
  });
  it('normalises lowercase volume names and stopped-container usage', () => {
    expect(dockhandCall('/volumes', 'GET', '1')!.convert([{ name: 'data', driver: 'local', mountpoint: '/data', created: '2026-10-13', usedBy: [{ containerId: 'stopped' }] }]).json).toEqual({ Volumes: [{ Name: 'data', Driver: 'local', Mountpoint: '/data', CreatedAt: '2026-10-13', Labels: {}, UsageData: { RefCount: 1 } }], Warnings: null });
  });
  it.each(['/containers/json', '/images/json', '/volumes'])('rejects valid JSON web pages for %s instead of claiming an empty engine', endpoint => {
    expect(() => dockhandCall(endpoint, 'GET', '1')!.convert({ page: 'login' })).toThrow();
  });
  it('routes image and volume removal with encoded identities and no force bypass', () => {
    const image = dockhandCall('/images/sha256%3Aimage', 'DELETE', '2')!;
    expect(image).toMatchObject({ method: 'DELETE', path: '/api/images/sha256%3Aimage?env=2' });
    expect(dockhandCall('/volumes/data', 'DELETE', '2')).toMatchObject({ method: 'DELETE', path: '/api/volumes/data?env=2' });
  });
  it('represents computed CPU percentage without losing already adjusted memory usage', () => {
    const converted = dockhandCall('/containers/id/stats?stream=false', 'GET', '1')!.convert({ cpuPercent: 42, memoryUsage: 100, memoryRaw: 200, memoryCache: 100, memoryLimit: 500 }).json;
    expect(converted).toMatchObject({ cpu_stats: { cpu_usage: { total_usage: 42 } }, memory_stats: { usage: 100, limit: 500 } });
  });
});
