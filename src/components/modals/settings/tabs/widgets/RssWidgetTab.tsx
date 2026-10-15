import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading } from '../../shared/CalmeControls';
import { SourceList, sourceId } from '../../shared/SourceList';

type Feed = { id: string; url: string; title?: string };

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

/**
 * The news feeds, saved once for every RSS widget: each widget then ticks
 * the ones it shows (all by default). Saved as soon as they change.
 */
export function RssWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const feeds = config?.settings?.rssFeeds ?? [];
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const valid = /^https?:\/\/\S+$/i.test(url.trim());
  const save = (next: Feed[]) => void updateConfig({ rssFeeds: next });
  const add = () => {
    if (!valid) return;
    save([...feeds, { id: sourceId('feed'), url: url.trim(), ...(title.trim() ? { title: title.trim() } : {}) }]);
    setUrl(''); setTitle('');
  };
  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type="rss" />
      <section className="ndc-set-block">
        <CalmeHeading info={t('settings.rss.feedsHint')}>{t('settings.rss.feeds')}</CalmeHeading>
        <form className="ndc-source-form" onSubmit={event => { event.preventDefault(); add(); }}>
          <input className="nd-input" type="url" inputMode="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.org/feed.xml" aria-label={t('widgets.rss.feedUrl')} />
          <input className="nd-input ndc-source-short" value={title} maxLength={80} onChange={event => setTitle(event.target.value)} placeholder={t('settings.rss.titleOptional')} aria-label={t('widgets.rss.feedTitle')} />
          <button type="submit" className="nd-btn nd-btn-accent" disabled={!valid}><Plus size={13} />{t('settings.add')}</button>
        </form>
        <SourceList<Feed>
          items={feeds}
          onChange={save}
          label={t('settings.rss.feeds')}
          empty={t('settings.rss.empty')}
          name={feed => feed.title || host(feed.url)}
          detail={feed => feed.url}
        />
      </section>
    </div>
  );
}
