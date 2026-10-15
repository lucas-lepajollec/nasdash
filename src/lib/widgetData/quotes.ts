import type { QuotesResponse } from './contracts';
import { TtlCache } from './cache';
import { sourceError } from './outbound';
import { getQuoteProvider } from './quoteProviders';

/** One pool per provider, kept 6 h (free sources limit their requests). */
export const onlineQuotesCache = new TtlCache<QuotesResponse['quotes']>(6 * 3_600_000, 10, 24 * 3_600_000);

/**
 * Quotes of the online sources chosen in Settings → Widgets → Quotes. The
 * user's own quotes are in the config and drawn in the browser; only
 * providers need the server. Unknown ids are ignored.
 */
export async function loadQuotes(providerIds: readonly unknown[]): Promise<QuotesResponse> {
  const providers = [...new Set(providerIds)].flatMap(id => getQuoteProvider(id) ?? []);
  const result: QuotesResponse = { quotes: [], errors: [], attributions: [] };
  for (const provider of providers) {
    try {
      const quotes = await onlineQuotesCache.get(provider.id, () => provider.load());
      result.quotes.push(...quotes.map(quote => ({ ...quote, source: provider.id })));
      result.attributions!.push({ source: provider.id, ...provider.attribution });
    } catch (error) {
      result.errors.push(sourceError(provider.id, error));
    }
  }
  return result;
}
