import { describe, expect, it } from 'vitest';
import type { BookmarkItem } from '@/lib/widgetData/contracts';
import { childrenOf, descendantsOf, dropItem, removeFolderKeepContent, folderOptions, moveInto, pathTo, removeItem } from './tree';

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
  it('removes a folder only, its content moving up where it was', () => {
    const next = removeFolderKeepContent(items, 'docs');
    expect(childrenOf(next, 'dev').map(item => item.id)).toEqual(['b', 'a']);
    expect(next.find(item => item.id === 'docs')).toBeUndefined();
    const top = removeFolderKeepContent(items, 'dev');
    expect(childrenOf(top, undefined).map(item => item.id)).toEqual(['docs', 'a', 'c']);
    expect(childrenOf(top, 'docs').map(item => item.id)).toEqual(['b']);
  });
  it('moves into a folder but never into itself or below itself', () => {
    expect(moveInto(items, 'c', 'docs').find(item => item.id === 'c')?.parentId).toBe('docs');
    expect(moveInto(items, 'a', undefined).find(item => item.id === 'a')?.parentId).toBeUndefined();
    expect(moveInto(items, 'dev', 'docs')).toEqual(items);
    expect(moveInto(items, 'dev', 'dev')).toEqual(items);
  });
  it('lists folders indented, without a folder and its descendants when moving it', () => {
    expect(folderOptions(items).map(entry => [entry.folder.id, entry.depth])).toEqual([['dev', 0], ['docs', 1]]);
    expect(folderOptions(items, 'dev')).toEqual([]);
  });
});

describe('bookmarks drop', () => {
  const order = (list: BookmarkItem[], parent?: string) => childrenOf(list, parent).map(item => item.id);
  it('drops before or after a sibling, taking its folder', () => {
    expect(order(dropItem(items, 'c', 'a', 'before'), 'dev')).toEqual(['docs', 'c', 'a']);
    expect(order(dropItem(items, 'b', 'dev', 'after'))).toEqual(['dev', 'b', 'c']);
    expect(order(dropItem(items, 'a', 'docs', 'before'), 'dev')).toEqual(['a', 'docs']);
  });
  it('drops inside a folder, at its end, or out to the top level', () => {
    expect(order(dropItem(items, 'c', 'docs', 'inside'), 'docs')).toEqual(['b', 'c']);
    expect(order(dropItem(items, 'b', undefined, 'inside'))).toEqual(['dev', 'c', 'b']);
  });
  it('refuses a folder into itself or below itself, and inside a link', () => {
    expect(dropItem(items, 'dev', 'b', 'before')).toEqual(items);
    expect(dropItem(items, 'dev', 'docs', 'inside')).toEqual(items);
    expect(dropItem(items, 'c', 'a', 'inside')).toEqual(items);
  });
});
