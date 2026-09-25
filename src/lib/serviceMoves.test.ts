import { describe, expect, it } from 'vitest';
import type { Category } from './types';
import { moveService, readServiceDropTarget } from './serviceMoves';

const service = (id: string) => ({ id, name: id, logo: '', localUrl: '' });
const categories = (): Category[] => [
  { id: 'media', title: 'Media', emoji: '🎬', order: 0, services: [service('a'), service('b'), service('c')] },
  { id: 'dev', title: 'Dev', emoji: '💻', order: 1, services: [service('x')] },
  { id: 'empty', title: 'Empty', emoji: '📦', order: 2, services: [] },
];
const ids = (list: Category[] | null, id: string) => list?.find(c => c.id === id)?.services.map(s => s.id);

describe('service moves', () => {
  it('swaps two services, including across categories', () => {
    expect(ids(moveService(categories(), 'a', 'media', { type: 'service-drop', categoryId: 'media', serviceId: 'c' }), 'media')).toEqual(['c', 'b', 'a']);
    const across = moveService(categories(), 'a', 'media', { type: 'service-drop', categoryId: 'dev', serviceId: 'x' });
    expect(ids(across, 'media')).toEqual(['x', 'b', 'c']);
    expect(ids(across, 'dev')).toEqual(['a']);
  });

  it('inserts at a gap with the same-category index correction', () => {
    expect(ids(moveService(categories(), 'a', 'media', { type: 'service-gap', categoryId: 'media', index: 3 }), 'media')).toEqual(['b', 'c', 'a']);
    expect(ids(moveService(categories(), 'c', 'media', { type: 'service-gap', categoryId: 'media', index: 0 }), 'media')).toEqual(['c', 'a', 'b']);
    const across = moveService(categories(), 'b', 'media', { type: 'service-gap', categoryId: 'dev', index: 0 });
    expect(ids(across, 'dev')).toEqual(['b', 'x']);
  });

  it('appends to an empty category and ignores invalid moves', () => {
    expect(ids(moveService(categories(), 'x', 'dev', { type: 'category-empty-drop', categoryId: 'empty' }), 'empty')).toEqual(['x']);
    expect(moveService(categories(), 'x', 'dev', { type: 'category-empty-drop', categoryId: 'dev' })).toBeNull();
    expect(moveService(categories(), 'ghost', 'dev', { type: 'category-empty-drop', categoryId: 'empty' })).toBeNull();
    expect(moveService(categories(), 'a', 'media', { type: 'service-drop', categoryId: 'media', serviceId: 'a' })).toBeNull();
  });

  it('reads drop target data defensively', () => {
    expect(readServiceDropTarget({ type: 'service-gap', categoryId: 'media', index: 2 })).toEqual({ type: 'service-gap', categoryId: 'media', index: 2 });
    expect(readServiceDropTarget({ type: 'page-slot', columnId: 'c' })).toBeNull();
    expect(readServiceDropTarget(undefined)).toBeNull();
  });
});
