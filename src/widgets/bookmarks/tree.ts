import type { BookmarkItem } from '@/lib/widgetData/contracts';

/**
 * The bookmarks library is a flat list (Settings → Widgets → Bookmarks):
 * folders and links point to their parent folder by id, the root has none,
 * and siblings keep the list order. These helpers read and edit it without
 * ever breaking that shape.
 */

/** Children of every folder at once (`undefined`: the top level), in order: one pass for a whole tree. */
export function indexByParent(items: readonly BookmarkItem[]): Map<string | undefined, BookmarkItem[]> {
  const index = new Map<string | undefined, BookmarkItem[]>();
  for (const item of items) {
    const key = item.parentId ?? undefined;
    const list = index.get(key);
    if (list) list.push(item); else index.set(key, [item]);
  }
  return index;
}

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

/** Removes a folder only: what it held moves up one level, where the folder was. */
export function removeFolderKeepContent(items: readonly BookmarkItem[], id: string): BookmarkItem[] {
  const folder = items.find(item => item.id === id);
  if (!folder) return [...items];
  const lift = (item: BookmarkItem): BookmarkItem => {
    const moved: BookmarkItem = { ...item };
    if (folder.parentId) moved.parentId = folder.parentId; else delete moved.parentId;
    return moved;
  };
  const inside = items.filter(item => item.parentId === id);
  return items.flatMap(item => item.id === id ? inside.map(lift) : item.parentId === id ? [] : [item]);
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

export type DropPosition = 'before' | 'after' | 'inside';

/**
 * Drops an item next to another (taking that one's folder) or inside a
 * folder (at its end). Refused onto itself or, for a folder, anywhere
 * inside it.
 */
export function dropItem(items: readonly BookmarkItem[], id: string, targetId: string | undefined, position: DropPosition): BookmarkItem[] {
  const item = items.find(entry => entry.id === id);
  if (!item || targetId === id) return [...items];
  if (targetId && descendantsOf(items, id).has(targetId)) return [...items];
  if (position === 'inside') {
    if (targetId && items.find(entry => entry.id === targetId)?.kind !== 'folder') return [...items];
    return moveInto(items, id, targetId);
  }
  const target = items.find(entry => entry.id === targetId);
  if (!target) return [...items];
  const rest = items.filter(entry => entry.id !== id);
  const moved: BookmarkItem = { ...item };
  if (target.parentId) moved.parentId = target.parentId; else delete moved.parentId;
  const at = rest.findIndex(entry => entry.id === target.id) + (position === 'after' ? 1 : 0);
  return [...rest.slice(0, at), moved, ...rest.slice(at)];
}
