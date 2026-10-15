import { describe, expect, it } from 'vitest';
import { validateConfigMutationBody } from './configEntityValidation';
import { buildConfigForPrincipal } from './configAccess';
import { widgetFeeds, widgetSymbols } from './widgetData/sources';
import type { AccessPrincipal } from './access';
import type { DashboardConfig } from './types';

const settings = (body: Record<string, unknown>) => () => validateConfigMutationBody(body as never, 'settings', 'PUT');

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
  it('keeps feed addresses and service connection addresses server-side for visitors', () => {
    const config = { version: 1, categories: [], localEvents: [], settings: {
      title: 'Fictional', showMonitor: true,
      rssFeeds: [{ id: 'a', url: 'https://private.example/feed?token=fictional-capability', title: 'Private' }],
    }, integrations: [{ id: 'pihole-a', type: 'pihole', name: 'Pi-hole', settings: { url: 'http://dns.fictional.lan' }, secrets: {} }] } as DashboardConfig;
    const viewer: AccessPrincipal = { username: 'reader', role: 'viewer', allowedTabs: [], allowedWidgets: [], isAnonymous: false };
    const output = buildConfigForPrincipal(config, viewer);
    expect(JSON.stringify(output)).not.toContain('fictional-capability');
    expect(JSON.stringify(output)).not.toContain('dns.fictional.lan');
    expect(output.settings.rssFeeds).toEqual([{ id: 'a', url: '', title: 'Private' }]);
    expect(output.integrations?.[0]).toMatchObject({ id: 'pihole-a', type: 'pihole', name: 'Pi-hole', settings: {} });
    expect(buildConfigForPrincipal(config, { ...viewer, role: 'admin' }).settings.rssFeeds?.[0].url).toContain('fictional-capability');
  });
});
