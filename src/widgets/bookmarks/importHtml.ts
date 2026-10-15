import type { BookmarkItem } from '@/lib/widgetData/contracts';

/** Same limits as the server: 500 items, folders eight levels deep. */
export const MAX_BOOKMARKS = 500;
const MAX_DEPTH = 8;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const value = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(value) && value > 0 && value < 0x110000 ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  }).trim();
}

/**
 * Reads the bookmarks file every browser exports (Chrome, Firefox, Edge,
 * Safari: "Netscape bookmark file", HTML) into library items: folders keep
 * their nesting, only http(s) links are kept, and the result is cut at the
 * library's limits. `start` is the number of items already saved.
 */
export function importBookmarkHtml(html: string, makeId: (kind: 'link' | 'folder') => string, start = 0): { items: BookmarkItem[]; skipped: number } {
  const items: BookmarkItem[] = [];
  let skipped = 0;
  // Each opened list belongs to the folder title just before it (none: the top level).
  const stack: (string | undefined)[] = [];
  let pending: string | undefined;
  const parent = () => stack[stack.length - 1];
  const depthOf = (id: string | undefined) => { let depth = 0; let current = id; while (current) { depth++; current = items.find(item => item.id === current)?.parentId; } return depth; };
  for (const match of html.matchAll(/<(\/?)(dl|h3|a)\b([^>]*)>([^<]*)/gi)) {
    const [, closing, tag, attributes, text] = match;
    const name = tag.toLowerCase();
    if (name === 'dl') {
      if (closing) stack.pop();
      else { stack.push(pending ?? (stack.length ? parent() : undefined)); pending = undefined; }
      continue;
    }
    if (closing) continue;
    if (start + items.length >= MAX_BOOKMARKS) { skipped++; continue; }
    const title = decode(text).slice(0, 120);
    if (name === 'h3') {
      // Too deep: its content goes into the deepest allowed folder.
      if (depthOf(parent()) >= MAX_DEPTH) { pending = parent(); continue; }
      const folder: BookmarkItem = { id: makeId('folder'), kind: 'folder', title: title || '…' };
      if (parent()) folder.parentId = parent();
      items.push(folder);
      pending = folder.id;
      continue;
    }
    const href = /\bhref\s*=\s*"([^"]*)"/i.exec(attributes)?.[1] ?? /\bhref\s*=\s*'([^']*)'/i.exec(attributes)?.[1];
    const url = href ? decode(href) : '';
    let valid = false;
    try { const parsed = new URL(url); valid = (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.username && !parsed.password && url.length <= 2048; } catch { /* Not a URL. */ }
    if (!valid) { skipped++; continue; }
    const link: BookmarkItem = { id: makeId('link'), kind: 'link', title: title || new URL(url).hostname, url };
    if (parent()) link.parentId = parent();
    items.push(link);
  }
  return { items, skipped };
}
