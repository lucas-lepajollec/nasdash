import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadQuotes, onlineQuotesCache } from './quotes';
import { QUOTE_PROVIDERS } from './quoteProviders';
import { EXAMPLE_QUOTES } from '@/widgets/quotes/examples';
import { UI_LANGUAGES } from '@/i18n/messages';
import { ownQuotes } from '@/widgets/quotes/CalmeQuotes';
beforeEach(() => onlineQuotesCache.clear());
afterEach(() => vi.unstubAllGlobals());
it('has one attributed example per interface language', () => {
  for (const { id } of UI_LANGUAGES) expect(EXAMPLE_QUOTES[id]).toMatchObject({ text: expect.any(String), author: expect.any(String), work: expect.any(String) });
});
it('fetches nothing without an online source, or with an unknown one', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  expect(await loadQuotes([])).toEqual({ quotes: [], errors: [], attributions: [] });
  expect(await loadQuotes(['https://evil.example/'])).toEqual({ quotes: [], errors: [], attributions: [] });
  expect(fetch).not.toHaveBeenCalled();
});
it('loads a provider from its fixed endpoint, credits it and caches it', async () => {
  const fetch = vi.fn(async (_url: URL) => new Response(JSON.stringify([{ q: 'An online quote', a: 'Provider Author' }, { q: '', a: 'x' }])));
  vi.stubGlobal('fetch', fetch);
  const result = await loadQuotes(['zenquotes', 'zenquotes']);
  expect(result.quotes).toEqual([expect.objectContaining({ text: 'An online quote', author: 'Provider Author', language: 'en', source: 'zenquotes' })]);
  expect(result.attributions).toEqual([expect.objectContaining({ source: 'zenquotes', url: 'https://zenquotes.io/' })]);
  expect(String(fetch.mock.calls[0][0])).toBe('https://zenquotes.io/api/quotes');
  await loadQuotes(['zenquotes']); expect(fetch).toHaveBeenCalledTimes(1);
});
it('reports a provider failure separately instead of failing the widget', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
  const result = await loadQuotes(['zenquotes']);
  expect(result.quotes).toEqual([]); expect(result.errors[0]).toMatchObject({ source: 'zenquotes', error: 'widgets.error.parse' });
});
it('keeps only usable own quotes, trimmed', () => {
  expect(ownQuotes([{ text: '  Be kind.  ', author: ' Me ' }, { text: '   ' }, null, 'text', { text: 'Alone', author: '' }]))
    .toEqual([{ text: 'Be kind.', author: 'Me' }, { text: 'Alone' }]);
  expect(QUOTE_PROVIDERS.map(provider => provider.id)).toEqual(['zenquotes']);
});
