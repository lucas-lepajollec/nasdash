import { createHash } from 'node:crypto';
import type { Quote } from './contracts';
import { fetchJson, WidgetFetchError } from './outbound';

/**
 * Online quote sources a quotes widget can add to the user's own quotes.
 * Each one is a fixed public endpoint (never a URL from settings), loaded by
 * the server and cached. Adding a source: one entry here, its name and hint
 * in the translations, and its id in `QUOTE_PROVIDER_IDS`.
 */
export interface QuoteProvider {
  id: string;
  name: string;
  /** ISO 639-1 language(s) of its quotes. */
  languages: readonly string[];
  /** Shown under its quotes when the provider's terms ask for it. */
  attribution: { label: string; url: string };
  load(): Promise<Quote[]>;
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24);

const zenquotes: QuoteProvider = {
  id: 'zenquotes',
  name: 'ZenQuotes',
  languages: ['en'],
  attribution: { label: 'ZenQuotes.io', url: 'https://zenquotes.io/' },
  async load() {
    const data = await fetchJson('https://zenquotes.io/api/quotes', 512 * 1024);
    if (!Array.isArray(data)) throw new WidgetFetchError('widgets.error.parse');
    const quotes = data.slice(0, 200).flatMap((item): Quote[] => (
      item && typeof item.q === 'string' && item.q.trim() && typeof item.a === 'string'
        ? [{ id: `zenquotes:${hash(`${item.q}\n${item.a}`)}`, text: item.q.trim().slice(0, 1_000), author: item.a.trim().slice(0, 200), language: 'en' }]
        : []
    ));
    if (!quotes.length) throw new WidgetFetchError('widgets.error.parse');
    return quotes;
  },
};

export const QUOTE_PROVIDERS: readonly QuoteProvider[] = [zenquotes];

export function getQuoteProvider(id: unknown): QuoteProvider | undefined {
  return QUOTE_PROVIDERS.find(provider => provider.id === id);
}
