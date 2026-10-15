import React, { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { demoFetch } from '@/lib/demoTransport';
import type { MarketSearchResult } from '@/lib/widgetData/markets';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading } from '../../shared/CalmeControls';
import { SourceList, sourceId } from '../../shared/SourceList';

type SavedSymbol = { id: string; symbol: string; label?: string; kind?: string; exchange?: string };

/**
 * The watchlist, saved once for every markets widget: search a company, an
 * index, a currency or a crypto by name, pick it, done. Each widget then
 * ticks the ones it shows. Saved as soon as it changes.
 */
export function MarketsWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const symbols = config?.settings?.marketSymbols ?? [];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MarketSearchResult[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const save = (next: SavedSymbol[]) => void updateConfig({ marketSymbols: next });

  // Results follow the typing, a moment after the last key.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setState('idle'); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState('loading');
      try {
        const response = await demoFetch(`/api/widgets/markets/search?${new URLSearchParams({ q })}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        setResults(((await response.json()) as { results: MarketSearchResult[] }).results);
        setState('idle');
      } catch {
        if (!controller.signal.aborted) { setResults([]); setState('error'); }
      }
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);

  const add = (result: MarketSearchResult) => {
    if (symbols.some(item => item.symbol === result.symbol)) return;
    save([...symbols, { id: sourceId('symbol'), symbol: result.symbol, label: result.name, kind: result.kind, ...(result.exchange ? { exchange: result.exchange } : {}) }]);
    setQuery(''); setResults([]);
  };
  const detail = (item: { symbol: string; kind?: string; exchange?: string }) => [item.kind ? t(`widgets.markets.kind.${item.kind}`) : undefined, item.symbol, item.exchange].filter(Boolean).join(' · ');

  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type="markets" />
      <section className="ndc-set-block">
        <CalmeHeading info={t('settings.markets.symbolsHint')}>{t('settings.markets.symbols')}</CalmeHeading>
        <div className="ndc-market-search">
          <Search size={14} className="ndc-market-search-icon" aria-hidden="true" />
          <input className="nd-input" value={query} maxLength={40} onChange={event => setQuery(event.target.value)} placeholder={t('settings.markets.searchPlaceholder')} aria-label={t('settings.markets.search')} />
          {state === 'loading' && <span className="nd-spinner ndc-market-search-spin" aria-hidden="true" />}
        </div>
        {(results.length > 0 || state === 'error' || (query.trim().length >= 2 && state === 'idle' && results.length === 0)) && (
          <ul className="ndc-set-list ndc-market-results" aria-label={t('settings.markets.results')}>
            {state === 'error' ? <li className="ndc-source-empty">{t('settings.markets.searchFailed')}</li>
              : results.length === 0 ? <li className="ndc-source-empty">{t('settings.markets.noResult')}</li>
                : results.map(result => {
                  const saved = symbols.some(item => item.symbol === result.symbol);
                  return (
                    <li key={result.symbol}>
                      <button type="button" className="ndc-set-list-item ndc-market-result" disabled={saved} onClick={() => add(result)}>
                        <span className="ndc-source-text">
                          <span className="ndc-source-name">{result.name}</span>
                          <span className="ndc-set-list-sub">{detail(result)}</span>
                        </span>
                        <span className="ndc-market-result-add">{saved ? t('settings.markets.added') : <><Plus size={13} />{t('settings.add')}</>}</span>
                      </button>
                    </li>
                  );
                })}
          </ul>
        )}
        <SourceList<SavedSymbol>
          items={symbols}
          onChange={save}
          label={t('settings.markets.symbols')}
          empty={t('settings.markets.empty')}
          name={item => item.label || item.symbol}
          detail={item => detail(item)}
        />
        <p className="ndc-source-note">{t('widgets.markets.disclaimer')}</p>
      </section>
    </div>
  );
}
