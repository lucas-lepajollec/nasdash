'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { Quote, QuotesResponse } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { copyText } from '@/lib/clipboard';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { pick, StylePicker, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { EXAMPLE_QUOTES } from './examples';

export type QuoteRotation = 'day' | 'hour' | 'load';
export type QuoteStyle = 'literary' | 'quill' | 'calligraphy' | 'pen' | 'typewriter' | 'modern';
const ROTATIONS: readonly QuoteRotation[] = ['day', 'hour', 'load'];
export type QuoteAlign = 'left' | 'center' | 'right';
const ALIGNS: readonly QuoteAlign[] = ['left', 'center', 'right'];
const STYLES: readonly QuoteStyle[] = ['literary', 'quill', 'calligraphy', 'pen', 'typewriter', 'modern'];

/** Quotation marks of a language: « » in French, „ “ in German, “ ” in English… */
export function quoteMarks(language: string | undefined): [string, string] {
  switch (language) {
    case 'fr': return ['«\u202f', '\u202f»'];
    case 'de': return ['„', '“'];
    case 'es': case 'it': return ['«', '»'];
    default: return ['“', '”'];
  }
}
const PERIOD: Record<QuoteRotation, number> = { day: 86_400_000, hour: 3_600_000, load: 0 };

type OwnQuote = { text: string; author?: string };

/** The user's quotes from settings, ignoring empty or malformed rows. */
export function ownQuotes(value: unknown): OwnQuote[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): OwnQuote[] => (
    item && typeof item === 'object' && typeof item.text === 'string' && item.text.trim()
      ? [{ text: item.text.trim(), ...(typeof item.author === 'string' && item.author.trim() ? { author: item.author.trim() } : {}) }]
      : []
  ));
}

/** Stable shuffle of the pool: the same day gives the same quote on every screen. */
function seededOrder(length: number, seed: number): number[] {
  const order = Array.from({ length }, (_, index) => index);
  let state = seed >>> 0 || 1;
  for (let index = length - 1; index > 0; index--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const other = state % (index + 1);
    [order[index], order[other]] = [order[other], order[index]];
  }
  return order;
}

/**
 * A quote that changes every day, every hour or at each visit, drawn from
 * the user's quotes and the online sources chosen in Settings → Widgets →
 * Quotes. With neither, an example in the interface language. Previous,
 * next and copy show on hover.
 */
export default function CalmeQuotes({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t, language } = useI18n();
  const { config } = useConfig();
  const rotation = pick(settings.rotation, ROTATIONS, 'day');
  const style = pick(settings.style, STYLES, 'literary');
  const showAuthor = settings.showAuthor !== false;
  const align = pick(settings.align, ALIGNS, 'center');
  const providers = useMemo(() => config?.settings?.quoteProviders ?? [], [config?.settings?.quoteProviders]);
  const online = providers.length > 0;
  const { data } = useWidgetData<QuotesResponse>('/api/widgets/quotes', widgetId, settings, { refreshMs: 6 * 3_600_000, isVisible, body: { providers }, enabled: online });
  const own = useMemo(() => ownQuotes(config?.settings?.quotes), [config?.settings?.quotes]);
  const quotes = useMemo<Quote[]>(() => {
    const pool: Quote[] = [...own.map((quote, index) => ({ id: `own:${index}`, ...quote })), ...(online ? (data?.quotes ?? []).filter(quote => !quote.source || providers.includes(quote.source)) : [])];
    if (pool.length) return pool;
    const example = EXAMPLE_QUOTES[language] ?? EXAMPLE_QUOTES.en;
    return [{ id: `example:${language}`, ...example, language }];
  }, [own, online, data, language, providers]);

  // The slot of time we are in decides the quote; arrows move from it.
  const period = PERIOD[rotation];
  const [now, setNow] = useState(() => Date.now());
  const [visitSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!period || !isVisible) return;
    const wait = period - (Date.now() % period) + 50;
    const timer = window.setTimeout(() => { setNow(Date.now()); setOffset(0); }, Math.min(wait, 2 ** 31 - 1));
    return () => window.clearTimeout(timer);
  }, [period, now, isVisible]);
  const slot = period ? Math.floor((now - new Date(now).getTimezoneOffset() * 60_000) / period) : 0;
  const order = useMemo(() => seededOrder(quotes.length, period ? 7919 : visitSeed), [quotes.length, period, visitSeed]);
  const position = ((slot + offset) % quotes.length + quotes.length) % quotes.length;
  const quote = quotes[order[position]];
  const credit = quote.source ? data?.attributions?.find(item => item.source === quote.source) : undefined;

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      // The shared helper also works over plain HTTP, where navigator.clipboard is missing.
      await copyText([`${marks[0]}${quote.text}${marks[1]}`, quote.author ? `— ${quote.author}` : ''].filter(Boolean).join(' '));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* Copy refused by the browser: nothing to do. */ }
  };
  const size = quote.text.length > 220 ? 'is-long' : quote.text.length > 110 ? 'is-medium' : 'is-short';
  // The quote's own language decides its marks; the user's quotes follow the interface.
  const marks = quoteMarks(quote.language ?? language);

  return (
    <CalmeWidget title={t('widget.quotes.name')} editMode={editMode}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: t('widget.quotes.name') })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-quotes', label: t('widgets.quotes.manage') }}>
          {(draft, change) => <QuotesSettings draft={draft} change={change} />}
        </WidgetSettingsButton>
      )}
      <figure className={`ndw-quote ndw-quote--${style} ${size} is-${align}`} aria-live="polite">
        {style === 'modern' && <span className="ndw-quote-glyph" aria-hidden="true">“</span>}
        <blockquote className="ndw-quote-text" lang={quote.language ?? language}>
          <span className="ndw-quote-open" aria-hidden="true">{marks[0]}</span>{quote.text}<span className="ndw-quote-close" aria-hidden="true">{marks[1]}</span>
        </blockquote>
        <figcaption className="ndw-quote-foot">
          {showAuthor && quote.author && <span className="ndw-quote-author"><span className="ndw-quote-dash" aria-hidden="true" />{quote.author}{quote.work && <cite>{quote.work}</cite>}</span>}
          {credit && <a className="ndw-quote-credit" href={credit.url} target="_blank" rel="noopener noreferrer">{credit.label}</a>}
          <span className="ndw-quote-tools">
            {quotes.length > 1 && <button type="button" className="ndc-icon-button" onClick={() => setOffset(offset - 1)} aria-label={t('widgets.quotes.previous')} title={t('widgets.quotes.previous')}><ChevronLeft size={14} /></button>}
            {quotes.length > 1 && <button type="button" className="ndc-icon-button" onClick={() => setOffset(offset + 1)} aria-label={t('widgets.quotes.next')} title={t('widgets.quotes.next')}><ChevronRight size={14} /></button>}
            <button type="button" className="ndc-icon-button" onClick={() => void copy()} aria-label={t('widgets.quotes.copy')} title={t(copied ? 'widgets.quotes.copied' : 'widgets.quotes.copy')}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>
          </span>
        </figcaption>
      </figure>
      {online && data?.errors.length ? <p className="ndw-note" role="status">{t('widgets.quotes.onlineUnavailable')}</p> : null}
    </CalmeWidget>
  );
}

function QuotesSettings({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t, language } = useI18n();
  const [open, close] = quoteMarks(language);
  return (
    <>
      <CalmeField label={t('widgets.display')}>
        <StylePicker
          label={t('widgets.display')}
          value={pick(draft.style, STYLES, 'literary')}
          options={STYLES.map(value => ({ value, name: t(`widgets.quotes.style.${value}`), className: `ndw-quote-sample--${value}`, sample: <>{open.trim()}{t('widgets.quotes.sample')}{close.trim()}</> }))}
          onChange={value => change({ style: value })}
        />
      </CalmeField>
      <CalmeField label={t('widgets.quotes.align')}>
        <CalmeSegmented label={t('widgets.quotes.align')} value={pick(draft.align, ALIGNS, 'center')} options={ALIGNS.map(value => ({ value, label: t(`widgets.quotes.align.${value}`) }))} onChange={value => change({ align: value })} />
      </CalmeField>
      <CalmeField label={t('widgets.quotes.rotation')}>
        <CalmeSegmented label={t('widgets.quotes.rotation')} value={pick(draft.rotation, ROTATIONS, 'day')} options={ROTATIONS.map(value => ({ value, label: t(`widgets.quotes.rotation.${value}`) }))} onChange={value => change({ rotation: value })} />
      </CalmeField>
      <CalmeRow label={t('widgets.quotes.showAuthor')}>
        <CalmeSwitch label={t('widgets.quotes.showAuthor')} checked={draft.showAuthor !== false} onChange={on => change({ showAuthor: on ? null : false })} />
      </CalmeRow>
    </>
  );
}
