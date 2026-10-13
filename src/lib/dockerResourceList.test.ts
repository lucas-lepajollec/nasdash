import { describe, expect, it } from 'vitest';
import { deletableSelection, imageResourceRows, resourceList, resourcePage, volumeResourceRows } from './dockerResourceList';

const images = imageResourceRows([
  { id: 'a', repoTags: ['web:10', 'registry.test/web:stable'], size: 300, created: 200 },
  { id: 'b', repoTags: ['web:2'], size: 100, created: 100 },
  { id: 'c', repoTags: ['<none>:<none>'], repoDigests: ['registry.test/tools@sha256:cc'] },
], [{ names: ['/stopped-web'], imageId: 'a', image: 'renamed:old' }]);

describe('Docker resource browsing and safe page selections', () => {
  it('marks stopped references as used and exposes every valid tag and digest', () => {
    expect(images[0]).toMatchObject({ used: true, consumers: ['stopped-web'], tags: ['web:10', 'registry.test/web:stable'] });
    expect(images[2]).toMatchObject({ name: 'registry.test/tools', tags: [], digests: ['registry.test/tools@sha256:cc'], used: false });
  });
  it('searches additional tags, IDs, digests and associated containers without altering the source', () => {
    for (const query of [' stable ', 'STOPPED-WEB', 'web:10']) expect(resourceList(images, query, 'all', 'name', false, 'en').map(row => row.id)).toEqual(['a']);
    expect(resourceList(images, 'sha256:cc', 'unused', 'name', false, 'en').map(row => row.id)).toEqual(['c']);
    expect(images.map(row => row.id)).toEqual(['a', 'b', 'c']);
  });
  it('combines status and search and sorts numeric names naturally', () => {
    expect(resourceList(images, 'web', 'all', 'name', false, 'en').map(row => row.id)).toEqual(['b', 'a']);
    expect(resourceList(images, 'web', 'unused', 'name', false, 'en').map(row => row.id)).toEqual(['b']);
    expect(resourceList(images, '', 'untagged', 'name', false, 'en').map(row => row.id)).toEqual(['c']);
  });
  it('does not turn missing metadata into zero and sorts unknown sizes last both ways', () => {
    expect(resourceList(images, '', 'all', 'size', true, 'en').map(row => row.id)).toEqual(['a', 'b', 'c']);
    expect(resourceList(images, '', 'all', 'created', false, 'en').map(row => row.id)).toEqual(['b', 'a', 'c']);
  });
  it('clamps pages after deletion and shows a truthful empty range', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ ...images[1], id: String(i) }));
    expect(resourcePage(many, 3, 10)).toMatchObject({ page: 3, pageCount: 3, start: 21, end: 21, rows: [many[20]] });
    expect(resourcePage(many.slice(0, 19), 3, 10)).toMatchObject({ page: 2, pageCount: 2, start: 11, end: 19 });
    expect(resourcePage([], 10, 50)).toMatchObject({ page: 1, pageCount: 1, start: 0, end: 0, rows: [] });
    expect(resourcePage(many, 2, 5)).toMatchObject({ page: 2, pageCount: 5, start: 6, end: 10, rows: many.slice(5, 10) });
  });
  it('drops duplicate, missing and newly attached deletion selections', () => {
    expect(deletableSelection(['a', 'b', 'b', 'gone'], images)).toEqual(['b']);
    expect(deletableSelection(['b'], images.map(row => ({ ...row, used: true })))).toEqual([]);
  });
  it('uses mount references as well as provider counts and reports missing metadata honestly', () => {
    const volumes = volumeResourceRows([
      { name: 'data', driver: 'local', createdAt: 'invalid', usageData: { size: -1 } },
      { name: 'backup', usageData: { refCount: 2 } },
      { name: 'unused', createdAt: '2026-01-01T00:00:00Z' },
    ], [{ names: ['/stopped-db'], mounts: [{ name: 'data' }] }]);
    expect(volumes[0]).toMatchObject({ used: true, consumers: ['stopped-db'], size: undefined, created: undefined });
    expect(volumes[1].used).toBe(true);
    expect(volumes[2].used).toBe(false);
    expect(resourceList(volumes, 'stopped-db', 'all', 'name', false, 'en').map(row => row.id)).toEqual(['data']);
  });
});
