import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading, CalmeRow, CalmeSwitch } from '../../shared/CalmeControls';
import { SourceList, sourceId } from '../../shared/SourceList';

type OwnQuote = { id: string; text: string; author?: string };

/** Online sources offered here; the server registry is `lib/widgetData/quoteProviders.ts`. */
const PROVIDERS = ['zenquotes'] as const;

/**
 * Where every quotes widget draws from: the user's own quotes and online
 * sources. With neither, widgets show an example in the interface language.
 */
export function QuotesWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const quotes = config?.settings?.quotes ?? [];
  const providers = config?.settings?.quoteProviders ?? [];
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const save = (next: OwnQuote[]) => void updateConfig({ quotes: next });
  const add = () => {
    if (!text.trim()) return;
    save([...quotes, { id: sourceId('quote'), text: text.trim(), ...(author.trim() ? { author: author.trim() } : {}) }]);
    setText(''); setAuthor('');
  };
  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type="quotes" />
      <section className="ndc-set-block">
        <CalmeHeading info={t('widgets.quotes.ownHint')}>{t('widgets.quotes.own')}</CalmeHeading>
        <form className="ndc-source-form ndc-source-form--quote" onSubmit={event => { event.preventDefault(); add(); }}>
          <textarea className="nd-input" rows={2} value={text} maxLength={1000} onChange={event => setText(event.target.value)} placeholder={t('widgets.quotes.textPlaceholder')} aria-label={t('widgets.quotes.text')} />
          <input className="nd-input" value={author} maxLength={200} onChange={event => setAuthor(event.target.value)} placeholder={t('widgets.quotes.author')} aria-label={t('widgets.quotes.author')} />
          <button type="submit" className="nd-btn nd-btn-accent" disabled={!text.trim()}><Plus size={13} />{t('settings.add')}</button>
        </form>
        <SourceList<OwnQuote>
          items={quotes}
          onChange={save}
          label={t('widgets.quotes.own')}
          empty={t('settings.quotes.empty')}
          name={quote => quote.text}
          detail={quote => quote.author}
        />
      </section>
      <section className="ndc-set-block">
        <CalmeHeading info={t('settings.quotes.onlineHint')}>{t('widgets.quotes.online')}</CalmeHeading>
        {PROVIDERS.map(id => (
          <CalmeRow key={id} label={t(`settings.quotes.provider.${id}`)} value={t(`settings.quotes.providerHint.${id}`)}>
            <CalmeSwitch
              label={t(`settings.quotes.provider.${id}`)}
              checked={providers.includes(id)}
              onChange={on => void updateConfig({ quoteProviders: on ? [...providers.filter(other => other !== id), id] : providers.filter(other => other !== id) })}
            />
          </CalmeRow>
        ))}
      </section>
    </div>
  );
}
