import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { filterFeeds, loadRss, parseRss, plainText, rssCache } from './rss';
import type { Feed } from './contracts';
const source = 'https://example.com/feed.xml';
beforeEach(() => rssCache.clear());
afterEach(() => vi.unstubAllGlobals());
describe('RSS tokenizer', () => {
  it('reads RSS2 CDATA, entities, date, creator, images and relative links', () => {
    const feed = parseRss(`<rss><channel><title>News &amp; Notes</title><link>https://example.com/</link><item><guid>x</guid><title>Caf&#233; &#x1F600;</title><link>/post</link><pubDate>Mon, 12 Jan 2026 12:00:00 GMT</pubDate><description><![CDATA[<p>Hello &amp; welcome</p><img src="/fallback.png">]]></description><media:thumbnail url="/photo.png"/><dc:creator>Ada</dc:creator></item></channel></rss>`, source);
    expect(feed.title).toBe('News & Notes');
    expect(feed.items[0]).toMatchObject({ id: 'x', title: 'Café 😀', summary: 'Hello & welcome', link: 'https://example.com/post', image: 'https://example.com/photo.png', author: 'Ada', date: Date.UTC(2026, 0, 12, 12) });
  });
  it('reads namespaced Atom, alternate links, enclosures and ISO dates', () => {
    const feed = parseRss(`<atom:feed xml:base="https://example.com/blog/"><atom:title>Atom</atom:title><atom:link href="/"/><atom:entry><atom:id>urn:1</atom:id><atom:title>One</atom:title><atom:link rel="self" href="/api"/><atom:link rel="alternate" href="one"/><atom:link rel="enclosure" type="image/jpeg" href="one.jpg"/><atom:published>2026-01-12T12:00:00Z</atom:published><atom:author><atom:name>Ada</atom:name></atom:author><atom:summary>Text</atom:summary></atom:entry></atom:feed>`, source);
    expect(feed.items[0]).toMatchObject({ id: 'urn:1', author: 'Ada', link: 'https://example.com/blog/one', image: 'https://example.com/blog/one.jpg', date: Date.UTC(2026, 0, 12, 12) });
  });
  it('reads RDF sibling items and content:encoded image fallback', () => {
    const feed = parseRss(`<rdf:RDF><channel><title>RDF</title></channel><item rdf:about="one"><title>One</title><dc:date>2026-01-12</dc:date><content:encoded><![CDATA[<b>Hi</b><img src="picture.png">]]></content:encoded></item></rdf:RDF>`, source);
    expect(feed.items[0]).toMatchObject({ summary: 'Hi', image: 'https://example.com/picture.png' });
  });
  it('tolerates unclosed items, ignores unsafe links, rejects non-feeds and excessive nesting', () => {
    expect(parseRss('<rss><channel><item><title>Unclosed</title><link>javascript:bad</link>', source).items[0]).toMatchObject({ title: 'Unclosed' });
    expect(parseRss('<rss><channel><item><link>javascript:bad</link></item></channel></rss>', source).items[0].link).toBeUndefined();
    expect(() => parseRss('<html>login</html>', source)).toThrow('widgets.error.parse');
    expect(() => parseRss('<rss>' + '<a>'.repeat(100), source)).toThrow('widgets.error.parse');
    const summary = plainText('word '.repeat(100));
    expect(summary.length).toBeLessThanOrEqual(280);
    expect(summary.endsWith('…')).toBe(true);
  });
});
it('filters case-insensitively and dedupes links or normalized titles across feeds', () => {
  const feeds: Feed[] = [
    { source: 'a', title: 'A', items: [{ id: '1', title: ' NAS  News ', link: 'https://example.com/1' }, { id: '2', title: 'Skip', summary: 'NAS spoilers' }, { id: '3', title: 'Later NAS' }] },
    { source: 'b', title: 'B', items: [{ id: '4', title: 'nas news' }, { id: '5', title: 'New NAS', link: 'https://example.com/1' }, { id: '6', title: 'Later NAS' }] },
  ];
  const result = filterFeeds(feeds, { include: 'nas', exclude: 'spoilers', maxItems: 1 });
  expect(result[0].items.map(i => i.id)).toEqual(['1']);
  expect(result[1].items.map(i => i.id)).toEqual(['6']);
  expect(filterFeeds(feeds, { dedupe: false })[1].items).toHaveLength(3);
});
it('limits concurrent downloads to four, caches and maps per-feed errors', async () => {
  let active = 0, peak = 0;
  const fetch = vi.fn(async (url: URL) => {
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    return url.pathname === '/bad' ? new Response('', { status: 503 }) : new Response('<rss><channel><title>OK</title></channel></rss>');
  });
  vi.stubGlobal('fetch', fetch);
  const settings = { feeds: Array.from({ length: 7 }, (_, i) => ({ url: `https://example.com/${i === 6 ? 'bad' : i}` })) };
  const result = await loadRss(settings);
  expect(peak).toBe(4);
  expect(result.feeds).toHaveLength(6);
  expect(result.errors[0]).toMatchObject({ error: 'widgets.error.http', parameters: { status: 503 } });
  await loadRss(settings);
  expect(fetch).toHaveBeenCalledTimes(8);
});
it('preserves Atom XHTML text order and nested img fallbacks', () => {
  const feed = parseRss(`<feed><title>XHTML</title><entry><title>A</title><content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">Hello <b>world</b> today<img src="photo.png"/></div></content></entry></feed>`, source);
  expect(feed.items[0]).toMatchObject({ summary: 'Hello world today', image: 'https://example.com/photo.png' });
});
it('keeps up to 50 items per feed by default, so a widget showing 20 or 50 gets them', () => {
  const items = Array.from({ length: 60 }, (_, i) => ({ id: `item-${i}`, title: `Item ${i}`, link: `https://example.org/${i}` }));
  const [feed] = filterFeeds([{ source: 'https://example.org/feed', title: 'Feed', items }], {});
  expect(feed.items).toHaveLength(50);
});
