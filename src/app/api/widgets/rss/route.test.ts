import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/config', () => ({ readConfig: vi.fn() }));
vi.mock('@/lib/access', () => ({ resolveAccessPrincipal: vi.fn() }));
vi.mock('@/lib/pages/store', async original => ({ ...await original<typeof import('@/lib/pages/store')>(), readPagesDocument: vi.fn() }));
// Widget catalog registration belongs to the parallel UI task. Keep the real
// page visibility filter, and supply catalog visibility for these new types.
vi.mock('@/lib/widgets/catalog', async original => ({ ...await original<typeof import('@/lib/widgets/catalog')>(), canViewWidget: vi.fn(() => true) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: vi.fn() }));
vi.mock('@/lib/widgetData/favicon', () => ({ loadFavicon: vi.fn() }));
import { readConfig } from '@/lib/config';
import { resolveAccessPrincipal } from '@/lib/access';
import { readPagesDocument } from '@/lib/pages/store';
import { isDemoMode } from '@/lib/demoMode';
import { rssCache } from '@/lib/widgetData/rss';
import { loadFavicon } from '@/lib/widgetData/favicon';
import { POST as rss } from './route';
import { POST as markets } from '../markets/route';
import { POST as quotes } from '../quotes/route';
import { GET as favicon } from '../favicon/route';
import type { PagesDocument, WidgetInstance } from '@/lib/pages/types';

const request = (body: unknown) => new NextRequest('http://localhost/api/widgets/rss', { method: 'POST', body: JSON.stringify(body) });
const iconRequest = (url: string) => new NextRequest(`http://localhost/api/widgets/favicon?widgetId=bookmarks-widget&url=${encodeURIComponent(url)}`);
let document: PagesDocument;
beforeEach(() => {
  vi.resetAllMocks(); rssCache.clear();
  vi.mocked(readConfig).mockReturnValue({ version: 1, categories: [], settings: {
    title: 'NasDash', showMonitor: true,
    rssFeeds: [{ id: 'feed-saved', url: 'https://saved.example/feed' }, { id: 'feed-other', url: 'https://other.example/rss' }],
    bookmarks: [
      { id: 'folder', kind: 'folder', title: 'Folder' },
      { id: 'link', kind: 'link', title: 'Saved', url: 'https://bookmarks.example/service', parentId: 'folder' },
    ],
  } });
  vi.mocked(resolveAccessPrincipal).mockReturnValue({ username: 'reader', role: 'viewer', allowedTabs: [], allowedWidgets: [], isAnonymous: false });
  document = { schemaVersion: 5, pages: [{ id: 'dashboard', name: 'Dashboard', icon: '', revision: 1, widgets: ['rss', 'markets', 'quotes', 'bookmarks'].map((type): WidgetInstance => ({ id: `${type}-widget`, type, x: 0, y: 0, w: 6, h: 10, settings: type === 'rss' ? { feedIds: ['feed-saved'] } : type === 'bookmarks' ? { items: [{ id: 'link', kind: 'link', title: 'Saved', url: 'http://example.com/service' }] } : {} })) }] };
  vi.mocked(readPagesDocument).mockImplementation(() => document);
});
afterEach(() => vi.unstubAllGlobals());
it('ignores viewer draft and request URLs, fetches only saved RSS sources', async () => {
  const fetch = vi.fn(async (_url: URL) => new Response('<rss><channel><title>Saved</title></channel></rss>'));
  vi.stubGlobal('fetch', fetch);
  const response = await rss(request({ widgetId: 'rss-widget', url: 'https://arbitrary.example/', feeds: [{ url: 'https://arbitrary.example/' }], draft: { feeds: [{ url: 'https://draft.example/' }] } }));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(fetch).toHaveBeenCalledTimes(1); expect(String(fetch.mock.calls[0][0])).toBe('https://saved.example/feed');
});
it('lets an admin preview another choice of saved feeds, never a URL from the request', async () => {
  vi.mocked(resolveAccessPrincipal).mockReturnValue({ username: 'admin', role: 'admin', allowedTabs: [], allowedWidgets: [], isAnonymous: false });
  const fetch = vi.fn(async (_url: URL) => new Response('<rss><channel><title>Draft</title></channel></rss>')); vi.stubGlobal('fetch', fetch);
  expect((await rss(request({ widgetId: 'unsaved', draft: { feedIds: ['feed-other'], feeds: [{ url: 'https://draft.example/feed' }] } }))).status).toBe(200);
  expect(fetch.mock.calls.map(call => String(call[0]))).toEqual(['https://other.example/rss']);
});
it('reads every saved feed when the widget chose none', async () => {
  const fetch = vi.fn(async (_url: URL) => new Response('<rss><channel><title>All</title></channel></rss>')); vi.stubGlobal('fetch', fetch);
  document.pages[0].widgets[0].settings = {};
  expect((await rss(request({ widgetId: 'rss-widget' }))).status).toBe(200);
  expect(fetch.mock.calls.map(call => String(call[0])).sort()).toEqual(['https://other.example/rss', 'https://saved.example/feed']);
});
it('returns 404 for widgets the reader cannot see and 401 without a principal', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  document.pages[0].widgets[0].hidden = true;
  expect((await rss(request({ widgetId: 'rss-widget', draft: { feeds: [] } }))).status).toBe(404);
  vi.mocked(resolveAccessPrincipal).mockReturnValue({ username: 'reader', role: 'viewer', allowedTabs: ['other'], allowedWidgets: [], isAnonymous: false });
  expect((await markets(request({ widgetId: 'markets-widget' }))).status).toBe(404);
  vi.mocked(resolveAccessPrincipal).mockReturnValue(null);
  expect((await quotes(request({ widgetId: 'quotes-widget' }))).status).toBe(401);
  expect(fetch).not.toHaveBeenCalled();
});
it('returns deterministic demo fixtures for all data routes without outbound fetches', async () => {
  vi.mocked(isDemoMode).mockReturnValue(true);
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  for (const [route, type] of [[rss, 'rss'], [markets, 'markets'], [quotes, 'quotes']] as const) {
    const first = await route(request({ widgetId: `${type}-widget`, range: '1mo', draft: { sources: ['online'] } }));
    const second = await route(request({ widgetId: `${type}-widget`, range: '1mo' }));
    expect(first.status).toBe(200); expect(await first.json()).toEqual(await second.json());
    expect(first.headers.get('cache-control')).toBe('private, no-store');
  }
  expect((await favicon(iconRequest('https://bookmarks.example/'))).status).toBe(404);
  expect(fetch).not.toHaveBeenCalled(); expect(loadFavicon).not.toHaveBeenCalled();
});
it('returns 400 and private no-store for malformed request bodies', async () => {
  for (const route of [rss, markets, quotes]) {
    const response = await route(request(null)); expect(response.status).toBe(400); expect(response.headers.get('cache-control')).toBe('private, no-store');
  }
});
it.each(['viewer', 'admin'] as const)('serves bookmarks favicons only for saved library origins for %s, fetching the saved address', async role => {
  vi.mocked(resolveAccessPrincipal).mockReturnValue({ username: role, role, allowedTabs: [], allowedWidgets: [], isAnonymous: false });
  vi.mocked(loadFavicon).mockResolvedValue({ bytes: new TextEncoder().encode('<svg/>'), contentType: 'image/svg+xml', ext: 'svg' });
  for (const url of ['https://unsaved.example/', 'http://example.com/', 'https://saved.example/', 'http://bookmarks.example/', 'https://bookmarks.example:8443/']) {
    expect((await favicon(iconRequest(url))).status).toBe(404);
  }
  expect(loadFavicon).not.toHaveBeenCalled();
  const response = await favicon(iconRequest('https://BOOKMARKS.example/elsewhere?untrusted=request#fragment'));
  expect(response.status).toBe(200); expect(loadFavicon).toHaveBeenCalledWith('https://bookmarks.example');
  expect(response.headers.get('content-type')).toBe('image/svg+xml'); expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
  expect(loadFavicon).toHaveBeenCalledTimes(1);
  expect((await favicon(iconRequest('file:///etc/passwd'))).status).toBe(400);
});
it('does not use folder URLs or old widget items when no saved bookmark links exist', async () => {
  const config = readConfig();
  config.settings.bookmarks = [{ id: 'folder', kind: 'folder', title: 'Legacy folder', url: 'https://folder.example/' }];
  expect((await favicon(iconRequest('https://folder.example/'))).status).toBe(404);
  delete config.settings.bookmarks;
  expect((await favicon(iconRequest('http://example.com/'))).status).toBe(404);
  expect((await favicon(iconRequest('https://bookmarks.example/'))).status).toBe(404);
  expect(loadFavicon).not.toHaveBeenCalled();
});
it('requires a bookmarks widget visible to the requester before fetching saved library icons', async () => {
  document.pages[0].widgets.find(widget => widget.type === 'bookmarks')!.hidden = true;
  expect((await favicon(iconRequest('https://bookmarks.example/'))).status).toBe(404);
  vi.mocked(resolveAccessPrincipal).mockReturnValue(null);
  expect((await favicon(iconRequest('https://bookmarks.example/'))).status).toBe(401);
  expect(loadFavicon).not.toHaveBeenCalled();
});
it('authorizes RSS favicon origins from the saved feeds only', async () => {
  vi.mocked(loadFavicon).mockResolvedValue({ bytes: new TextEncoder().encode('<svg/>'), contentType: 'image/svg+xml', ext: 'svg' });
  const rssIcon = (url: string) => new NextRequest(`http://localhost/api/widgets/favicon?widgetId=rss-widget&type=rss&url=${encodeURIComponent(url)}`);
  expect((await favicon(rssIcon('https://elsewhere.example/'))).status).toBe(404);
  expect(loadFavicon).not.toHaveBeenCalled();
  expect((await favicon(rssIcon('https://saved.example/'))).status).toBe(200);
  expect(loadFavicon).toHaveBeenCalledWith('https://saved.example');
  // The type selects which saved widget is read: an RSS id is not a bookmarks widget.
  expect((await favicon(new NextRequest('http://localhost/api/widgets/favicon?widgetId=rss-widget&url=https%3A%2F%2Fsaved.example%2F'))).status).toBe(404);
});
it('serves saved bookmark icons without a widget to administrators only (library settings)', async () => {
  vi.mocked(loadFavicon).mockResolvedValue({ bytes: new Uint8Array([137, 80, 78, 71]), contentType: 'image/png', ext: 'png' });
  const libraryIcon = (url: string) => new NextRequest(`http://localhost/api/widgets/favicon?type=bookmarks&url=${encodeURIComponent(url)}`);
  vi.mocked(resolveAccessPrincipal).mockReturnValue({ username: 'admin', role: 'admin', allowedTabs: [], allowedWidgets: [], isAnonymous: false });
  expect((await favicon(libraryIcon('https://bookmarks.example/'))).status).toBe(200);
  expect((await favicon(libraryIcon('https://unsaved.example/'))).status).toBe(404);
  // A bookmarks widget just added in edit mode is not saved yet: its icons still show.
  expect((await favicon(new NextRequest(`http://localhost/api/widgets/favicon?widgetId=not-saved-yet&type=bookmarks&url=${encodeURIComponent('https://bookmarks.example/')}`))).status).toBe(200);
  vi.mocked(loadFavicon).mockClear();
  vi.mocked(resolveAccessPrincipal).mockReturnValue({ username: 'reader', role: 'viewer', allowedTabs: [], allowedWidgets: [], isAnonymous: false });
  expect((await favicon(libraryIcon('https://bookmarks.example/'))).status).not.toBe(200);
  expect(loadFavicon).not.toHaveBeenCalled();
});
