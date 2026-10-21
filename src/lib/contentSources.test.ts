import { describe, expect, it } from 'vitest';
import { validateConfigMutationBody } from './configEntityValidation';
import { buildConfigForPrincipal } from './configAccess';
import { widgetFeeds, widgetSymbols } from './widgetData/sources';
import type { AccessPrincipal } from './access';
import type { DashboardConfig } from './types';
import type { BookmarkItem } from './widgetData/contracts';

const settings = (body: Record<string, unknown>) => () => validateConfigMutationBody(body as never, 'settings', 'PUT');

const bookmarkLink = { id: 'link', kind: 'link', title: 'Saved link', url: 'https://saved.example/path' } as const;
const bookmarkFolder = { id: 'folder', kind: 'folder', title: 'Folder' } as const;
const folderChain = (depth: number): BookmarkItem[] => Array.from({ length: depth }, (_, i) => ({
  id: `folder-${i}`, kind: 'folder', title: `Folder ${i}`,
  ...(i ? { parentId: `folder-${i - 1}` } : {}),
}));

describe('shared bookmarks library validation', () => {
  it('accepts empty libraries and forward references, preserving the flat saved order', () => {
    expect(settings({ bookmarks: [] })).not.toThrow();
    const bookmarks: BookmarkItem[] = [
      { ...bookmarkLink, parentId: 'nested', icon: 'lucide:Link', description: 'A saved link', color: '#aAbB09' },
      { id: 'nested', kind: 'folder', title: 'Nested', parentId: 'folder' },
      { ...bookmarkFolder, icon: '', description: '' },
      { ...bookmarkLink, id: 'root-link', url: 'http://root.example:8080/' },
    ];
    const original = structuredClone(bookmarks);
    expect(settings({ bookmarks })).not.toThrow();
    expect(bookmarks).toEqual(original);
  });
  it('accepts eight folder levels and links within the deepest folder', () => {
    expect(settings({ bookmarks: [...folderChain(8), { ...bookmarkLink, parentId: 'folder-7' }] })).not.toThrow();
  });
  it('accepts the item count and text length limits', () => {
    const bookmarks: BookmarkItem[] = Array.from({ length: 500 }, (_, i) => ({ ...bookmarkLink, id: `link-${i}` }));
    bookmarks[0] = { ...bookmarkLink, id: 'link-0', title: 't'.repeat(120), url: `https://saved.example/${'a'.repeat(2026)}` };
    expect(settings({ bookmarks: bookmarks.map(item => ({ ...item, icon: 'i'.repeat(200), description: 'd'.repeat(200) })) })).not.toThrow();
  });
  it.each([
    ['non-array', {}],
    ['null library', null],
    ['non-object item', [null]],
    ['missing id', [{ kind: 'folder', title: 'Folder' }]],
    ['unsafe id', [{ ...bookmarkFolder, id: '../folder' }]],
    ['missing kind', [{ id: 'folder', title: 'Folder' }]],
    ['invalid kind', [{ ...bookmarkFolder, kind: 'file' }]],
    ['padded kind', [{ ...bookmarkFolder, kind: ' folder ' }]],
    ['missing title', [{ id: 'folder', kind: 'folder' }]],
    ['blank title', [{ ...bookmarkFolder, title: '  ' }]],
    ['long title', [{ ...bookmarkFolder, title: 't'.repeat(121) }]],
    ['missing link URL', [{ id: 'link', kind: 'link', title: 'Link' }]],
    ['URL on folder', [{ ...bookmarkFolder, url: 'https://saved.example/' }]],
    ['null URL on folder', [{ ...bookmarkFolder, url: null }]],
    ['bad scheme', [{ ...bookmarkLink, url: 'file:///etc/passwd' }]],
    ['script URL', [{ ...bookmarkLink, url: 'javascript:alert(1)' }]],
    ['relative URL', [{ ...bookmarkLink, url: '/relative' }]],
    ['protocol-relative URL', [{ ...bookmarkLink, url: '//saved.example/' }]],
    ['missing host', [{ ...bookmarkLink, url: 'https://' }]],
    ['credentials', [{ ...bookmarkLink, url: 'https://user:password@saved.example/' }]],
    ['username', [{ ...bookmarkLink, url: 'http://user@saved.example/' }]],
    ['password', [{ ...bookmarkLink, url: 'https://:password@saved.example/' }]],
    ['long URL', [{ ...bookmarkLink, url: `https://saved.example/${'a'.repeat(2028)}` }]],
    ['missing parent', [{ ...bookmarkLink, parentId: 'missing' }]],
    ['parent is link', [bookmarkLink, { ...bookmarkFolder, parentId: 'link' }]],
    ['link parent is link', [bookmarkLink, { ...bookmarkLink, id: 'child', parentId: 'link' }]],
    ['unsafe parent', [{ ...bookmarkLink, parentId: '../folder' }]],
    ['null parent', [{ ...bookmarkLink, parentId: null }]],
    ['self cycle', [{ ...bookmarkFolder, parentId: 'folder' }]],
    ['folder cycle', [{ ...bookmarkFolder, parentId: 'nested' }, { id: 'nested', kind: 'folder', title: 'Nested', parentId: 'folder' }]],
    ['too deep', folderChain(9)],
    ['duplicate link ids', [bookmarkLink, bookmarkLink]],
    ['duplicate folder/link ids', [bookmarkLink, { ...bookmarkFolder, id: 'link' }]],
    ['unknown key', [{ ...bookmarkLink, secret: 'x' }]],
    ['inherited property name', [{ ...bookmarkLink, constructor: 'x' }]],
    ['long icon', [{ ...bookmarkFolder, icon: 'i'.repeat(201) }]],
    ['null icon', [{ ...bookmarkFolder, icon: null }]],
    ['long description', [{ ...bookmarkLink, description: 'd'.repeat(201) }]],
    ['invalid color', [{ ...bookmarkFolder, color: 'red' }]],
    ['short color', [{ ...bookmarkFolder, color: '#abc' }]],
    ['too many items', Array.from({ length: 501 }, (_, i) => ({ ...bookmarkLink, id: `link-${i}` }))],
  ])('rejects %s', (_label, bookmarks) => {
    expect(settings({ bookmarks })).toThrow();
  });
});

describe('content widget sources (Settings → Widgets)', () => {
  it('accepts well-formed feeds, symbols, quotes and providers', () => {
    expect(settings({
      rssFeeds: [{ id: 'feed-a', url: 'https://news.example/feed.xml', title: 'News' }],
      marketSymbols: [{ id: 'symbol-a', symbol: '^GSPC', label: 'S&P 500' }, { id: 'symbol-b', symbol: 'EURUSD=X' }],
      quotes: [{ id: 'quote-a', text: 'Be kind.', author: 'Me' }],
      quoteProviders: ['zenquotes'],
    })).not.toThrow();
  });
  it.each([
    { rssFeeds: [{ id: 'feed-a', url: 'file:///etc/passwd' }] },
    { rssFeeds: [{ id: 'feed-a', url: 'https://ok.example/', secret: 'x' }] },
    { rssFeeds: [{ url: 'https://no-id.example/' }] },
    { marketSymbols: [{ id: 'symbol-a', symbol: '../../x' }] },
    { quotes: [{ id: 'quote-a', text: 'x'.repeat(1001) }] },
    { rssFeeds: Array.from({ length: 51 }, (_, i) => ({ id: `feed-${i}`, url: 'https://ok.example/' })) },
  ])('rejects %j', body => {
    expect(settings(body)).toThrow();
  });
  it('gives each widget its chosen sources in the saved order, all when it chose none', () => {
    const config = { version: 1, categories: [], settings: {
      title: 'Fictional', showMonitor: true,
      rssFeeds: [{ id: 'a', url: 'https://a.example/' }, { id: 'b', url: 'https://b.example/', title: 'B' }],
      marketSymbols: [{ id: 'x', symbol: 'AAA' }, { id: 'y', symbol: 'BBB' }],
    } } as DashboardConfig;
    expect(widgetFeeds({}, config).map(feed => feed.url)).toEqual(['https://a.example/', 'https://b.example/']);
    expect(widgetFeeds({ feedIds: ['b', 'missing'] }, config)).toEqual([{ url: 'https://b.example/', title: 'B' }]);
    expect(widgetSymbols({ symbolIds: ['y', 'x'] }, config)).toEqual(['BBB', 'AAA']);
    expect(widgetSymbols({ symbolIds: [] }, config)).toEqual([]);
  });
  it.each(['pihole', 'immich', 'photoprism', 'piwigo', 'librephotos'])('keeps feed addresses and %s connection addresses server-side for visitors', type => {
    const config = { version: 1, categories: [], localEvents: [], settings: {
      title: 'Fictional', showMonitor: true,
      rssFeeds: [{ id: 'a', url: 'https://private.example/feed?token=fictional-capability', title: 'Private' }],
    }, integrations: [{ id: 'service-a', type, name: 'Fictional library', settings: { url: 'http://dns.fictional.lan' }, secrets: {} }] } as DashboardConfig;
    const viewer: AccessPrincipal = { username: 'reader', role: 'viewer', allowedTabs: [], allowedWidgets: [], isAnonymous: false };
    const output = buildConfigForPrincipal(config, viewer);
    expect(JSON.stringify(output)).not.toContain('fictional-capability');
    expect(JSON.stringify(output)).not.toContain('dns.fictional.lan');
    expect(output.settings.rssFeeds).toEqual([{ id: 'a', url: '', title: 'Private' }]);
    expect(output.integrations?.[0]).toMatchObject({ id: 'service-a', type, name: 'Fictional library', settings: {} });
    expect(buildConfigForPrincipal(config, { ...viewer, role: 'admin' }).settings.rssFeeds?.[0].url).toContain('fictional-capability');
  });
});
