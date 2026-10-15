import { createHash } from 'node:crypto';
import type { Feed, FeedItem, RssResponse } from './contracts';
import { TtlCache } from './cache';
import { fetchBytes, httpUrl, sourceError, WidgetFetchError } from './outbound';

interface XmlNode { name: string; attrs: Record<string, string>; children: XmlNode[]; parts: (XmlNode | string)[] }
const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', hellip: '…', ndash: '–', mdash: '—' };
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|[\w]+);/gi, (all, key: string) => {
    if (key[0] !== '#') return entities[key.toLowerCase()] ?? all;
    const code = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '�';
  });
}
/** Bounded, non-validating tokenizer. No DTD expansion, external entities or recursion. */
function tokenize(xml: string): XmlNode {
  const root: XmlNode = { name: '', attrs: {}, children: [], parts: [] };
  const stack = [root];
  const tokens = /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![^>]*>|<\/?[\w:.-]+(?:"[^"]*"|'[^']*'|[^'">])*\/?\s*>|[^<]+/g;
  let count = 0;
  for (const token of xml.matchAll(tokens)) {
    if (++count > 100000) throw new WidgetFetchError('widgets.error.parse');
    const t = token[0];
    const current = stack[stack.length - 1];
    if (t.startsWith('<![CDATA[')) { current.parts.push(t.slice(9, -3)); continue; }
    if (t.startsWith('<!') || t.startsWith('<?')) continue;
    if (t.startsWith('</')) {
      const name = t.slice(2, -1).trim().toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].name === name) { stack.length = i; break; }
    } else if (t.startsWith('<')) {
      const name = /^<([\w:.-]+)/.exec(t)![1].toLowerCase();
      const attrs: Record<string, string> = {};
      for (const attr of t.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[attr[1].toLowerCase()] = decodeEntities(attr[2] ?? attr[3] ?? attr[4]);
      const node = { name, attrs, children: [], parts: [] };
      current.children.push(node);
      current.parts.push(node);
      if (!/\/\s*>$/.test(t)) {
        if (stack.length > 64) throw new WidgetFetchError('widgets.error.parse');
        stack.push(node);
      }
    } else current.parts.push(decodeEntities(t));
  }
  return root;
}
const local = (node: XmlNode) => node.name.split(':').pop();
const child = (node: XmlNode, ...names: string[]) => names.flatMap(name => node.children.filter(c => c.name === name || local(c) === name))[0];
const content = (node?: XmlNode): string => node ? node.parts.map(part => typeof part === 'string' ? part : content(part)).join('') : '';
const markup = (node?: XmlNode): string => node ? node.parts.map(part => typeof part === 'string' ? part : `<${local(part)} ${Object.entries(part.attrs).map(([name, value]) => `${name}="${value.replace(/"/g, '&quot;')}"`).join(' ')}>${markup(part)}</${local(part)}>`).join('') : '';
const descendants = (node: XmlNode): XmlNode[] => node.children.flatMap(c => [c, ...descendants(c)]);
function safeLink(value: string | undefined, base: string): string | undefined {
  if (!value?.trim()) return undefined;
  try { return httpUrl(value.trim(), base).href; } catch { return undefined; }
}
/**
 * Text of an HTML fragment: tags dropped (script and style with their content)
 * by a single scan rather than regular expressions, which can leave pieces of
 * nested or broken tags. Entities are decoded afterwards, then scanned again:
 * the result never contains markup, only text React prints as text.
 */
function stripTags(html: string): string {
  const lower = html.toLowerCase();
  let out = '';
  let from = 0;
  while (from < html.length) {
    const open = html.indexOf('<', from);
    if (open < 0) { out += html.slice(from); break; }
    out += html.slice(from, open) + ' ';
    const raw = /^<(script|style)\b/.exec(lower.slice(open, open + 8));
    const close = raw ? lower.indexOf(`</${raw[1]}`, open) : open;
    if (close < 0) break;
    const end = html.indexOf('>', close);
    // A lone "<" (as in "a < b") is text: keep what follows, without the sign.
    if (end < 0) { out += raw ? '' : html.slice(open + 1); break; }
    from = end + 1;
  }
  return out;
}

export function plainText(html: string, max = 280): string {
  const text = stripTags(decodeEntities(stripTags(html))).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : cut) + '…';
}
function nodeLink(node: XmlNode): string | undefined {
  const links = node.children.filter(c => local(c) === 'link');
  const link = links.find(c => !c.attrs.rel || c.attrs.rel === 'alternate');
  return link?.attrs.href || content(link).trim() || undefined;
}
export function parseRss(xml: string, source: string): Feed {
  const tree = tokenize(xml);
  const root = tree.children.find(n => ['rss', 'feed', 'rdf'].includes(local(n)!));
  if (!root) throw new WidgetFetchError('widgets.error.parse');
  const channel = child(root, 'channel') ?? root;
  const site = safeLink(nodeLink(channel), source);
  const base = safeLink(channel.attrs['xml:base'] || root.attrs['xml:base'], source) || site || source;
  const nodes = (local(root) === 'rdf' ? root.children : channel.children).filter(n => ['item', 'entry'].includes(local(n)!));
  const items: FeedItem[] = nodes.map(node => {
    const itemBase = safeLink(node.attrs['xml:base'], base) || base;
    const title = plainText(content(child(node, 'title')), 1000);
    const html = markup(child(node, 'content:encoded', 'description', 'summary', 'content'));
    const link = safeLink(nodeLink(node), itemBase);
    const dateText = content(child(node, 'pubdate', 'published', 'dc:date', 'updated', 'date'));
    const parsedDate = Date.parse(dateText);
    const media = descendants(node);
    const imageNode = media.find(c => ['media:thumbnail', 'media:content'].includes(c.name) && (!c.attrs.type || c.attrs.type.startsWith('image/')))
      ?? media.find(c => (local(c) === 'enclosure' || (local(c) === 'link' && c.attrs.rel === 'enclosure')) && c.attrs.type?.startsWith('image/'));
    const img = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(html);
    const image = safeLink(imageNode?.attrs.url || imageNode?.attrs.href || (img && decodeEntities(img[1] ?? img[2] ?? img[3])) || undefined, itemBase);
    const authorNode = child(node, 'dc:creator', 'author');
    const author = plainText(content(child(authorNode ?? node, 'name') ?? authorNode), 300);
    const id = content(child(node, 'guid', 'id')).trim() || link || createHash('sha256').update(`${title}\n${dateText}`).digest('hex');
    return { id, title, ...(link ? { link } : {}), ...(Number.isFinite(parsedDate) ? { date: parsedDate } : {}), ...(html ? { summary: plainText(html) } : {}), ...(image ? { image } : {}), ...(author ? { author } : {}) };
  });
  return { source, title: plainText(content(child(channel, 'title')), 1000) || new URL(source).hostname, ...(site ? { site } : {}), items };
}
export const rssCache = new TtlCache<{ feed: Feed; fetchedAt: number }>(600000, 200, 7200000);
export function filterFeeds(feeds: Feed[], settings: Record<string, unknown>): Feed[] {
  const keywords = (v: unknown) => typeof v === 'string' ? v.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
  const include = keywords(settings.include), exclude = keywords(settings.exclude);
  // Per feed; the widget then shows its own number (up to 50), so the server must keep that many.
  const max = typeof settings.maxItems === 'number' && Number.isFinite(settings.maxItems) ? Math.max(1, Math.min(50, Math.floor(settings.maxItems))) : 50;
  const links = new Set<string>(), titles = new Set<string>();
  return feeds.map(feed => {
    const items: FeedItem[] = [];
    for (const item of feed.items) {
      const text = `${item.title} ${item.summary ?? ''}`.toLowerCase();
      if ((include.length && !include.some(k => text.includes(k))) || exclude.some(k => text.includes(k))) continue;
      const title = item.title.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
      if (settings.dedupe !== false && ((item.link && links.has(item.link)) || (title && titles.has(title)))) continue;
      if (item.link) links.add(item.link);
      if (title) titles.add(title);
      items.push(item);
      if (items.length >= max) break;
    }
    return { ...feed, items };
  });
}
export async function loadRss(settings: Record<string, unknown>): Promise<RssResponse> {
  const sources = Array.isArray(settings.feeds) ? settings.feeds.slice(0, 20) : [];
  const results: ({ feed: Feed; fetchedAt: number } | ReturnType<typeof sourceError>)[] = new Array(sources.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, sources.length) }, async () => {
    while (cursor < sources.length) {
      const index = cursor++, spec = sources[index];
      const url = spec && typeof spec.url === 'string' ? spec.url : '';
      try {
        httpUrl(url);
        const result = await rssCache.get(url, async () => {
          const response = await fetchBytes(url, 2 * 1024 * 1024);
          return { feed: { ...parseRss(new TextDecoder().decode(response.bytes), response.url), source: url }, fetchedAt: Date.now() };
        });
        results[index] = { ...result, feed: { ...result.feed, title: typeof spec.title === 'string' && spec.title.trim() ? spec.title : result.feed.title } };
      } catch (e) { results[index] = sourceError(url, e); }
    }
  }));
  const successful = results.filter((r): r is { feed: Feed; fetchedAt: number } => 'feed' in r);
  return { feeds: filterFeeds(successful.map(r => r.feed), settings), errors: results.filter((r): r is ReturnType<typeof sourceError> => 'error' in r), fetchedAt: successful.length ? Math.min(...successful.map(r => r.fetchedAt)) : Date.now() };
}
