import type { BookmarkItem } from '@/lib/widgetData/contracts';

/**
 * The bookmarks library is a flat list (Settings → Widgets → Bookmarks):
 * folders and links point to their parent folder by id, the root has none,
 * and siblings keep the list order. These helpers read and edit it without
 * ever breaking that shape.
 */

/** Items directly inside a folder (`undefined`: the root), in order. */
export function childrenOf(items: readonly BookmarkItem[], parentId: string | undefined): BookmarkItem[] {
  return items.filter(item => (item.parentId ?? undefined) === parentId);
}

/** The folders from the root down to `id` (included). */
export function pathTo(items: readonly BookmarkItem[], id: string | undefined): BookmarkItem[] {
  const path: BookmarkItem[] = [];
  const seen = new Set<string>();
  let current = id ? items.find(item => item.id === id && item.kind === 'folder') : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? items.find(item => item.id === current!.parentId) : undefined;
  }
  return path;
}

/** Ids of everything inside a folder, at any depth. */
export function descendantsOf(items: readonly BookmarkItem[], id: string): Set<string> {
  const found = new Set<string>();
  const visit = (parent: string) => {
    for (const child of items) if (child.parentId === parent && !found.has(child.id)) { found.add(child.id); if (child.kind === 'folder') visit(child.id); }
  };
  visit(id);
  return found;
}

/** Removes an item and, for a folder, everything inside it. */
export function removeItem(items: readonly BookmarkItem[], id: string): BookmarkItem[] {
  const gone = descendantsOf(items, id);
  gone.add(id);
  return items.filter(item => !gone.has(item.id));
}

/** Moves an item into another folder (at its end); refused into itself or its own descendants. */
export function moveInto(items: readonly BookmarkItem[], id: string, parentId: string | undefined): BookmarkItem[] {
  if (parentId === id || (parentId && descendantsOf(items, id).has(parentId))) return [...items];
  const item = items.find(entry => entry.id === id);
  if (!item) return [...items];
  const rest = items.filter(entry => entry.id !== id);
  const moved: BookmarkItem = { ...item };
  if (parentId) moved.parentId = parentId; else delete moved.parentId;
  return [...rest, moved];
}

/** Swaps an item with its previous (-1) or next (+1) sibling. */
export function moveAmongSiblings(items: readonly BookmarkItem[], id: string, step: -1 | 1): BookmarkItem[] {
  const item = items.find(entry => entry.id === id);
  if (!item) return [...items];
  const siblings = childrenOf(items, item.parentId);
  const position = siblings.findIndex(entry => entry.id === id);
  const other = siblings[position + step];
  if (!other) return [...items];
  const next = [...items];
  const a = next.findIndex(entry => entry.id === id), b = next.findIndex(entry => entry.id === other.id);
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** Folders in display order, each with its depth (for an indented picker). */
export function folderOptions(items: readonly BookmarkItem[], exclude?: string): { folder: BookmarkItem; depth: number }[] {
  const blocked = exclude ? new Set([exclude, ...descendantsOf(items, exclude)]) : new Set<string>();
  const out: { folder: BookmarkItem; depth: number }[] = [];
  const visit = (parent: string | undefined, depth: number) => {
    for (const folder of childrenOf(items, parent)) if (folder.kind === 'folder' && !blocked.has(folder.id)) { out.push({ folder, depth }); visit(folder.id, depth + 1); }
  };
  visit(undefined, 0);
  return out;
}

/** The host of a link, for its detail line. */
export function hostOf(url: string | undefined): string {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
