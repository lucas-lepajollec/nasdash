import { describe, expect, it } from 'vitest';
import type { BookmarkItem } from '@/lib/widgetData/contracts';
import { childrenOf, descendantsOf, folderOptions, moveAmongSiblings, moveInto, pathTo, removeItem } from './tree';

const items: BookmarkItem[] = [
  { id: 'dev', kind: 'folder', title: 'Dev' },
  { id: 'docs', kind: 'folder', title: 'Docs', parentId: 'dev' },
  { id: 'a', kind: 'link', title: 'A', url: 'https://a.example', parentId: 'dev' },
  { id: 'b', kind: 'link', title: 'B', url: 'https://b.example', parentId: 'docs' },
  { id: 'c', kind: 'link', title: 'C', url: 'https://c.example' },
];

describe('bookmarks tree', () => {
  it('reads children, paths and descendants', () => {
    expect(childrenOf(items, undefined).map(item => item.id)).toEqual(['dev', 'c']);
    expect(childrenOf(items, 'dev').map(item => item.id)).toEqual(['docs', 'a']);
    expect(pathTo(items, 'docs').map(item => item.id)).toEqual(['dev', 'docs']);
    expect([...descendantsOf(items, 'dev')].sort()).toEqual(['a', 'b', 'docs']);
  });
  it('removes a folder with its content', () => {
    expect(removeItem(items, 'dev').map(item => item.id)).toEqual(['c']);
  });
  it('moves into a folder but never into itself or below itself', () => {
    expect(moveInto(items, 'c', 'docs').find(item => item.id === 'c')?.parentId).toBe('docs');
    expect(moveInto(items, 'a', undefined).find(item => item.id === 'a')?.parentId).toBeUndefined();
    expect(moveInto(items, 'dev', 'docs')).toEqual(items);
    expect(moveInto(items, 'dev', 'dev')).toEqual(items);
  });
  it('reorders among siblings only', () => {
    expect(childrenOf(moveAmongSiblings(items, 'a', -1), 'dev').map(item => item.id)).toEqual(['a', 'docs']);
    expect(moveAmongSiblings(items, 'docs', -1)).toEqual(items);
  });
  it('lists folders indented, without a folder and its descendants when moving it', () => {
    expect(folderOptions(items).map(entry => [entry.folder.id, entry.depth])).toEqual([['dev', 0], ['docs', 1]]);
    expect(folderOptions(items, 'dev')).toEqual([]);
  });
});
