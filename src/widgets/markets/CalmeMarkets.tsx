'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { MARKET_CURRENCIES, type MarketQuote, type MarketRange, type MarketsResponse } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import CustomSelect from '@/components/shared/CustomSelect';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import { Sparkline } from '@/components/charts/Gauges';
import { TimeChart, type ChartSeries } from '@/components/charts/TimeChart';
import { CalmeWidget } from '../calme';
import { moveById, SortableItem, SortableList } from '@/components/widgets/content/Sortable';
import { chartHeight, DataError, GRID_MODES, type GridMode, PagedGrid, PagedGridSettings, perPageOf, pick, SourceChoice, useBoxWidth, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';

export type MarketsDisplay = 'list' | 'bars' | 'chart' | 'tiles' | 'ticker';
const DISPLAYS: readonly MarketsDisplay[] = ['list', 'bars', 'chart', 'tiles', 'ticker'];
export const RANGES: readonly MarketRange[] = ['1d', '5d', '1mo', '6mo', '1y'];
type SavedSymbol = { id: string; symbol: string; label?: string; kind?: string; exchange?: string };

/** The saved symbols this widget shows (`symbolIds`; none means all), in the saved order. */
export function chosenSymbols(saved: SavedSymbol[], ids: unknown): SavedSymbol[] {
  return Array.isArray(ids) ? saved.filter(item => ids.includes(item.id)) : saved;
}

/** Prices scaled to 0–100 between their own low and high: the curve shows the shape, not the level. */
function shape(points: [number, number][]): [number, number][] {
  if (points.length < 2) return points;
  const values = points.map(point => point[1]);
  const low = Math.min(...values), high = Math.max(...values);
  const span = high - low || 1;
  return points.map(([time, value]) => [time, 10 + ((value - low) / span) * 80]);
}

/**
 * Stocks, indices, currencies and crypto from the watchlist saved in
 * Settings → Widgets → Markets (Yahoo Finance symbols), read by the server
 * with a cache. Rows (name, curve, price and change), tiles, or a scrolling
 * tape. Rises green, falls red; the period switches in the corner.
 */
export default function CalmeMarkets({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const saved = config?.settings?.marketSymbols ?? [];
  const symbols = chosenSymbols(saved, settings.symbolIds);
  const display = pick(settings.display, DISPLAYS, 'list');
  const [range, setRange] = useState<MarketRange>(() => pick(settings.range, RANGES, '1d'));
  const { data, error, mutate } = useWidgetData<MarketsResponse>('/api/widgets/markets', widgetId, settings, {
    refreshMs: range === '1d' ? 60_000 : 15 * 60_000, isVisible, body: { range, symbols: symbols.map(item => item.id) }, enabled: symbols.length > 0,
  });
  const title = t('widget.markets.name');
  const showRange = settings.rangeSwitch !== false && display !== 'ticker' && symbols.length > 0;
  const labels = Object.fromEntries(symbols.filter(item => item.label).map(item => [item.symbol, item.label!]));
  const [ref, width] = useBoxWidth<HTMLDivElement>();

  return (
    <CalmeWidget title={title} editMode={editMode}>
      <div ref={ref} className="ndw-market-box">
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={next => { onUpdateSettings(next); setRange(pick(next.range, RANGES, '1d')); }} shared={{ tab: 'widget-markets', label: t('widgets.markets.manage') }}>
          {(draft, change) => <MarketsSettings draft={draft} change={change} saved={saved} />}
        </WidgetSettingsButton>
      )}
      {saved.length === 0 ? <SetupGuide kind="markets" />
        : symbols.length === 0 ? <div className="ndc-empty">{t('widgets.markets.noneChosen')}</div>
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true">{symbols.slice(0, 5).map(item => <span key={item.id} className="ndw-skeleton-row" />)}</div>
              : (
                <>
                  {/* Editing: list, bars and tiles put the symbols in order by drag and drop (the saved order, for every markets widget). */}
                  <SortableList ids={data.quotes.map(quote => quote.symbol)} enabled={editMode && ['list', 'bars', 'tiles'].includes(display)} layout={display === 'tiles' ? 'grid' : 'list'} onMove={(moved, over) => {
                    const symbolOf = (item: SavedSymbol) => item.symbol.toUpperCase();
                    void updateConfig({ marketSymbols: moveById(saved, symbolOf, moved.toUpperCase(), over.toUpperCase()) });
                  }}>
                  <MarketsBody quotes={data.quotes} display={display} labels={labels} showName={settings.showName !== false} spark={settings.sparkline !== false} width={width} range={range} aligned={settings.align !== 'free'} grid={{ perPage: perPageOf(settings), mode: pick(settings.gridMode, GRID_MODES, 'pages') }} />
                  </SortableList>
                  {data.errors.length > 0 && <p className="ndw-note" role="status">{t('widgets.markets.missing', { symbols: data.errors.map(item => item.source).join(', ') })}</p>}
                  {/* In the block, not the title row: it stays when titles are hidden. */}
                  {showRange && (
                    <div className="ndw-market-foot">
                      <span className="ndw-range" role="group" aria-label={t('widgets.markets.range')}>
                        {RANGES.map(value => <button key={value} type="button" className="ndw-range-option" aria-pressed={range === value} onClick={() => setRange(value)}>{t(`widgets.markets.range.${value}`)}</button>)}
                      </span>
                    </div>
                  )}
                </>
              )}
      </div>
    </CalmeWidget>
  );
}

function useFormat() {
  const { locale } = useI18n();
  return useMemo(() => {
    const cache = new Map<string, Intl.NumberFormat>();
    const get = (key: string, make: () => Intl.NumberFormat) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key)!; };
    return {
      price: (value: number, currency?: string) => {
        const digits = Math.abs(value) >= 1000 ? 0 : Math.abs(value) >= 1 ? 2 : 4;
        try {
          return get(`p${currency}${digits}`, () => new Intl.NumberFormat(locale, currency ? { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: digits, minimumFractionDigits: Math.min(2, digits) } : { maximumFractionDigits: digits, minimumFractionDigits: Math.min(2, digits) })).format(value);
        } catch {
          return get(`n${digits}`, () => new Intl.NumberFormat(locale, { maximumFractionDigits: digits })).format(value);
        }
      },
      /** A change in the currency, with its sign. */
      signed: (value: number, currency?: string) => {
        const digits = Math.abs(value) >= 1000 ? 0 : Math.abs(value) >= 1 ? 2 : 4;
        try {
          return get(`s${currency}${digits}`, () => new Intl.NumberFormat(locale, currency ? { style: 'currency', currency, currencyDisplay: 'narrowSymbol', signDisplay: 'exceptZero', maximumFractionDigits: digits, minimumFractionDigits: Math.min(2, digits) } : { signDisplay: 'exceptZero', maximumFractionDigits: digits })).format(value);
        } catch {
          return get(`sn${digits}`, () => new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', maximumFractionDigits: digits })).format(value);
        }
      },
      percent: (value: number) => get('pct', () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2, minimumFractionDigits: 2, signDisplay: 'exceptZero' })).format(value / 100),
    };
  }, [locale]);
}

function MarketsBody({ quotes, display, labels, showName, spark, width, range, aligned, grid }: { quotes: MarketQuote[]; display: MarketsDisplay; labels: Record<string, string>; showName: boolean; spark: boolean; width: number; range: MarketRange; aligned: boolean; grid: { perPage: number; mode: GridMode } }) {
  const { t } = useI18n();
  const format = useFormat();
  const [featured, setFeatured] = useState<string | null>(null);
  const direction = (quote: MarketQuote) => (quote.change > 0 ? 'is-up' : quote.change < 0 ? 'is-down' : 'is-flat');
  const color = (quote: MarketQuote) => (quote.change > 0 ? 'var(--nd-green)' : quote.change < 0 ? 'var(--nd-red)' : 'var(--nd-text-dimmed)');
  const name = (quote: MarketQuote) => labels[quote.symbol] || quote.name;
  const state = (quote: MarketQuote) => quote.marketState && quote.marketState !== 'open'
    ? <span className={`ndw-market-state is-${quote.marketState}`} title={t(`widgets.markets.state.${quote.marketState}`)}>{t(`widgets.markets.state.${quote.marketState}`)}</span>
    : null;
  const label = (quote: MarketQuote) => [name(quote), quote.symbol, format.price(quote.price, quote.currency), format.percent(quote.changePercent)].join(' · ');
  const change = (quote: MarketQuote) => <span className="ndw-change">{format.percent(quote.changePercent)}</span>;
  // Aligned rows: every row gets the longest name's and price's width, so curves and bars line up.
  const columns = aligned ? {
    '--ndw-name': `${Math.min(28, Math.max(4, ...quotes.map(quote => (showName ? name(quote) : quote.symbol).length)))}ch`,
    '--ndw-price': `${Math.max(6, ...quotes.map(quote => format.price(quote.price, quote.currency).length)) + 1}ch`,
  } as React.CSSProperties : undefined;
  const curve = (quote: MarketQuote, height: number) => <Sparkline points={shape(quote.points)} color={color(quote)} height={height} filled />;

  if (display === 'ticker') {
    // Few symbols in a wide block: repeat them so the tape is never half empty.
    const repeat = Math.max(1, Math.ceil(width / Math.max(1, quotes.length * 170)));
    const items = Array.from({ length: repeat }, () => quotes).flat().map((quote, index) => (
      <span key={`${quote.symbol}-${index}`} className={`ndw-ticker-item ${direction(quote)}`} title={label(quote)}>
        <strong>{labels[quote.symbol] || quote.symbol}</strong>
        <span className="ndw-market-price">{format.price(quote.price, quote.currency)}</span>
        {change(quote)}
      </span>
    ));
    // Two copies make the loop seamless; the second is hidden from assistive technology.
    return (
      <div className="ndw-ticker" aria-label={quotes.map(label).join(', ')} role="marquee">
        <div className="ndw-ticker-track" style={{ animationDuration: `${Math.max(18, quotes.length * repeat * 6)}s` }}>
          <div className="ndw-ticker-run">{items}</div>
          <div className="ndw-ticker-run" aria-hidden="true">{items}</div>
        </div>
      </div>
    );
  }

  if (display === 'chart') {
    const main = quotes.find(quote => quote.symbol === featured) ?? quotes[0];
    if (!main) return null;
    return (
      <div className={`ndw-market-feature ${direction(main)}`}>
        <div className="ndw-market-feature-head">
          <span className="ndw-market-id">
            <span className="ndw-market-title">{name(main)}</span>
            <span className="ndw-market-sub"><span>{main.symbol}</span>{main.exchange && <span>{main.exchange}</span>}{state(main)}</span>
          </span>
          <span className="ndw-market-figures">
            <span className="ndw-market-price ndw-market-price--hero">{format.price(main.price, main.currency)}</span>
            <span className="ndw-market-delta">{format.signed(main.change, main.currency)} · {format.percent(main.changePercent)}</span>
          </span>
        </div>
        <MarketChart quote={main} color={color(main)} height={chartHeight(width, 0.38, 130, 320)} range={range} />
        {quotes.length > 1 && (
          <ChipStrip label={t('widgets.markets.shown')}>
            {quotes.map(quote => (
              <button key={quote.symbol} type="button" role="tab" aria-selected={quote.symbol === main.symbol} className={`ndw-market-chip ${direction(quote)}`} onClick={() => setFeatured(quote.symbol)} title={label(quote)}>
                <span>{labels[quote.symbol] || quote.symbol}</span>
                {change(quote)}
              </button>
            ))}
          </ChipStrip>
        )}
      </div>
    );
  }

  if (display === 'bars') {
    // Change over the period from a centre line: rises to the right in green, falls to the left in red.
    const widest = Math.max(0.01, ...quotes.map(quote => Math.abs(quote.changePercent)));
    return (
      <div className={`ndw-market-bars ${aligned ? 'is-aligned' : ''}`} style={columns}>
        {quotes.map(quote => {
          const share = (Math.abs(quote.changePercent) / widest) * 50;
          return (
            <SortableItem key={quote.symbol} id={quote.symbol} className={`ndw-market-bar-row ${direction(quote)}`} title={label(quote)}>
              <span className="ndw-market-title">{showName ? name(quote) : quote.symbol}</span>
              <span className="ndw-market-bar-track" aria-hidden="true">
                <span className="ndw-market-bar-fill" style={quote.change >= 0 ? { left: '50%', width: `${share}%` } : { right: '50%', width: `${share}%` }} />
              </span>
              <span className="ndw-market-bar-value">{format.percent(quote.changePercent)}</span>
              <span className="ndw-market-price">{format.price(quote.price, quote.currency)}</span>
            </SortableItem>
          );
        })}
      </div>
    );
  }

  if (display === 'tiles') {
    const tiles = quotes.map(quote => (
      <SortableItem key={quote.symbol} id={quote.symbol} className={`ndw-market-tile ${direction(quote)}`} title={label(quote)}>
        <span className="ndw-market-tile-head">
          <span className="ndw-market-symbol">{labels[quote.symbol] || quote.symbol}</span>
          <span className="ndw-market-pill">{format.percent(quote.changePercent)}</span>
        </span>
        <span className="ndw-market-price ndw-market-price--big">{format.price(quote.price, quote.currency)}</span>
        {showName && <span className="ndw-market-name">{name(quote)}</span>}
        {spark && <span className="ndw-market-tile-spark">{curve(quote, 34)}</span>}
      </SortableItem>
    ));
    return <PagedGrid items={tiles} perPage={grid.perPage} mode={grid.mode} minColumn={150} label={t('widgets.markets.shown')} />;
  }

  // Rows: name, curve, price. A wide block gives the curve the room.
  return (
    <div className={`ndw-market-rows ${width >= 560 ? 'is-wide' : ''} ${aligned ? 'is-aligned' : ''}`} style={columns}>
      {quotes.map(quote => (
        <SortableItem key={quote.symbol} id={quote.symbol} className={`ndw-market-row ${direction(quote)} ${spark ? '' : 'no-spark'}`} title={label(quote)}>
          <span className="ndw-market-id">
            <span className="ndw-market-title">{showName ? name(quote) : quote.symbol}</span>
            <span className="ndw-market-sub">{showName && <span>{quote.symbol}</span>}{state(quote)}</span>
          </span>
          {spark && <span className="ndw-market-spark">{curve(quote, width >= 560 ? 36 : 30)}</span>}
          <span className="ndw-market-figures">
            <span className="ndw-market-price">{format.price(quote.price, quote.currency)}</span>
            <span className="ndw-market-pill">{format.percent(quote.changePercent)}</span>
          </span>
        </SortableItem>
      ))}
    </div>
  );
}

/** One symbol over the period: filled curve, the previous close as a dashed line, prices under the pointer. */
function MarketChart({ quote, color, height, range }: { quote: MarketQuote; color: string; height: number; range: MarketRange }) {
  const { t, locale } = useI18n();
  const format = useFormat();
  const time = useMemo(() => new Intl.DateTimeFormat(locale, range === '1d' ? { hour: '2-digit', minute: '2-digit' } : range === '5d' ? { weekday: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' }), [locale, range]);
  // The chart counts from zero; prices are drawn above a floor just under the period's
  // low, so a move from 100 to 104 fills the height instead of a flat line.
  const { series, floor, top } = useMemo(() => {
    const values = [...quote.points.map(point => point[1]), ...(quote.previousClose !== undefined ? [quote.previousClose] : [])];
    const low = Math.min(...values), high = Math.max(...values);
    const pad = (high - low || Math.abs(high) * 0.01 || 1) * 0.18;
    const base = low - pad;
    return {
      floor: base,
      top: high + pad - base,
      series: [{ id: quote.symbol, label: quote.symbol, color, area: true, points: quote.points.map(([at, value]) => [at, value - base] as [number, number]) }] as ChartSeries[],
    };
  }, [quote, color]);
  if (quote.points.length < 2) return null;
  const start = quote.points[0][0], end = quote.points[quote.points.length - 1][0];
  return (
    <TimeChart
      series={series}
      start={start}
      end={end}
      height={height}
      max={top}
      formatValue={value => format.price(value + floor, quote.currency)}
      formatTime={value => time.format(value)}
      startLabel={time.format(start)}
      endLabel={time.format(end)}
      threshold={quote.previousClose !== undefined ? { value: quote.previousClose - floor, color: 'var(--nd-text-dimmed)' } : undefined}
      showScale
      ariaLabel={t('widgets.markets.chartOf', { name: quote.name })}
    />
  );
}

function MarketsSettings({ draft, change, saved }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void; saved: SavedSymbol[] }) {
  const { t } = useI18n();
  return (
    <>
      <CalmeField label={t('widgets.markets.shown')} info={t('widgets.markets.shownHint')}>
        {saved.length === 0 ? <p className="ndw-note">{t('settings.markets.empty')}</p> : (
          <SourceChoice label={t('widgets.markets.shown')} items={saved.map(item => ({ id: item.id, name: item.label || item.symbol, detail: item.symbol }))} value={draft.symbolIds} onChange={ids => change({ symbolIds: ids })} />
        )}
      </CalmeField>
      <CalmeField label={t('widgets.display')}>
        <CalmeSegmented label={t('widgets.display')} value={pick(draft.display, DISPLAYS, 'list')} options={DISPLAYS.map(value => ({ value, label: t(`widgets.markets.display.${value}`) }))} onChange={value => change({ display: value })} />
      </CalmeField>
      {pick(draft.display, DISPLAYS, 'list') === 'tiles' && <PagedGridSettings draft={draft} change={change} />}
      <CalmeField label={t('widgets.markets.currency')} info={t('widgets.markets.currencyHint')}>
        <CurrencySelect value={typeof draft.currency === 'string' ? draft.currency : ''} onChange={value => change({ currency: value || null })} />
      </CalmeField>
      <CalmeField label={t('widgets.markets.defaultRange')}>
        <CalmeSegmented label={t('widgets.markets.defaultRange')} value={pick(draft.range, RANGES, '1d')} options={RANGES.map(value => ({ value, label: t(`widgets.markets.range.${value}`) }))} onChange={value => change({ range: value })} />
      </CalmeField>
      {(['list', 'bars'] as const).includes(pick(draft.display, DISPLAYS, 'list') as 'list' | 'bars') && (
        <CalmeRow label={t('widgets.markets.alignColumns')} info={t('widgets.markets.alignColumnsHint')}>
          <CalmeSwitch label={t('widgets.markets.alignColumns')} checked={draft.align !== 'free'} onChange={on => change({ align: on ? null : 'free' })} />
        </CalmeRow>
      )}
      <CalmeRow label={t('widgets.markets.showName')}>
        <CalmeSwitch label={t('widgets.markets.showName')} checked={draft.showName !== false} onChange={on => change({ showName: on ? null : false })} />
      </CalmeRow>
      <CalmeRow label={t('widgets.markets.sparkline')}>
        <CalmeSwitch label={t('widgets.markets.sparkline')} checked={draft.sparkline !== false} onChange={on => change({ sparkline: on ? null : false })} />
      </CalmeRow>
      <CalmeRow label={t('widgets.markets.rangeSwitch')}>
        <CalmeSwitch label={t('widgets.markets.rangeSwitch')} checked={draft.rangeSwitch !== false} onChange={on => change({ rangeSwitch: on ? null : false })} />
      </CalmeRow>
    </>
  );
}

/**
 * A row of chips that scrolls sideways: with the wheel, by dragging on touch,
 * or with the arrows that appear at an edge when more chips hide there.
 */
function ChipStrip({ label, children }: { label: string; children: React.ReactNode }) {
  const { t } = useI18n();
  const strip = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const measure = () => {
    const element = strip.current;
    if (element) setEdges({ start: element.scrollLeft > 2, end: element.scrollLeft + element.clientWidth < element.scrollWidth - 2 });
  };
  useEffect(() => {
    measure();
    const element = strip.current;
    if (!element) return;
    // A vertical wheel scrolls the row; React's wheel listener is passive, so attach it here.
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || element.scrollWidth <= element.clientWidth) return;
      event.preventDefault();
      element.scrollLeft += event.deltaY;
    };
    element.addEventListener('wheel', wheel, { passive: false });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { element.removeEventListener('wheel', wheel); observer.disconnect(); };
  }, []);
  const by = (direction: number) => strip.current?.scrollBy({ left: direction * strip.current.clientWidth * 0.7, behavior: 'smooth' });
  return (
    <div className={`ndw-chip-strip ${edges.start ? 'has-start' : ''} ${edges.end ? 'has-end' : ''}`}>
      {edges.start && <button type="button" className="ndc-icon-button ndw-chip-arrow is-start" onClick={() => by(-1)} aria-label={t('widgets.markets.scrollBack')} title={t('widgets.markets.scrollBack')}><ChevronLeft size={14} /></button>}
      <div ref={strip} className="ndw-market-chips" role="tablist" aria-label={label} onScroll={measure}>{children}</div>
      {edges.end && <button type="button" className="ndc-icon-button ndw-chip-arrow is-end" onClick={() => by(1)} aria-label={t('widgets.markets.scrollMore')} title={t('widgets.markets.scrollMore')}><ChevronRight size={14} /></button>}
    </div>
  );
}

/** Prices in each symbol's own currency, or converted into one (names in the interface language). */
function CurrencySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t, locale } = useI18n();
  const names = useMemo(() => {
    try { return new Intl.DisplayNames(locale, { type: 'currency' }); } catch { return null; }
  }, [locale]);
  return (
    <CustomSelect
      ariaLabel={t('widgets.markets.currency')}
      value={value}
      onChange={onChange}
      options={[{ value: '', label: t('widgets.markets.currencyNative') }, ...MARKET_CURRENCIES.map(code => ({ value: code, label: `${names?.of(code) ?? code} (${code})` }))]}
    />
  );
}
