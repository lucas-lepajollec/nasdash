'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { Feed, FeedItem, RssResponse } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import { CalmeRow, CalmeSegmented, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, ColumnRows, columnsOf, ColumnsSetting, DataError, GRID_MODES, type GridMode, PagedGrid, PagedGridSettings, perPageOf, pick, SiteIcon, SourceChoice, useBoxWidth, useRelativeTime, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';

export type RssDisplay = 'list' | 'headlines' | 'cards' | 'magazine';
const DISPLAYS: readonly RssDisplay[] = ['list', 'headlines', 'cards', 'magazine'];
type SavedFeed = { id: string; url: string; title?: string };

/** The saved feeds this widget shows (`feedIds`; none means all), in the saved order. */
export function chosenFeeds(saved: SavedFeed[], ids: unknown): SavedFeed[] {
  return Array.isArray(ids) ? saved.filter(feed => ids.includes(feed.id)) : saved;
}

/** Items of the shown feeds, newest first, each with its feed. */
function mergedItems(feeds: Feed[]): { item: FeedItem; feed: Feed }[] {
  return feeds.flatMap(feed => feed.items.map(item => ({ item, feed })))
    .sort((a, b) => (b.item.date ?? 0) - (a.item.date ?? 0));
}

/** When this browser last looked at the widget: newer items get a dot. */
function useLastSeen(widgetId: string, ready: boolean): number {
  const [seen, setSeen] = useState<number>(Number.POSITIVE_INFINITY);
  useEffect(() => {
    if (!ready) return;
    const key = `ndw-rss-seen:${widgetId}`;
    let previous = Number.POSITIVE_INFINITY;
    try { previous = Number(localStorage.getItem(key)) || Number.POSITIVE_INFINITY; localStorage.setItem(key, String(Date.now())); } catch { /* Private browsing. */ }
    setSeen(previous);
  }, [widgetId, ready]);
  return seen;
}

/**
 * News from the feeds saved in Settings → Widgets → News feeds (each widget
 * ticks the ones it shows), read by the server (cached ten minutes). Feeds are
 * merged newest first or shown as tabs; four displays: list (with thumbnails
 * when there is room), compact headlines, image cards and a magazine with
 * one lead story. Items newer than the last visit have a dot. "Show more"
 * opens the rest without leaving the page.
 */
export default function CalmeRss({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const saved = config?.settings?.rssFeeds ?? [];
  const configured = chosenFeeds(saved, settings.feedIds);
  const { data, error, mutate, isValidating } = useWidgetData<RssResponse>('/api/widgets/rss', widgetId, settings, { refreshMs: 10 * 60_000, isVisible, body: { feeds: configured.map(feed => feed.id) }, enabled: configured.length > 0 });
  const display = pick(settings.display, DISPLAYS, 'list');
  const tabs = settings.grouping === 'tabs';
  const limit = bounded(settings.limit, 3, 50, 8);
  const images = settings.images !== false;
  const summaries = settings.summaries === true;
  const [tab, setTab] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const seen = useLastSeen(widgetId, !!data);
  const feeds = useMemo(() => data?.feeds ?? [], [data]);
  const shown = tabs ? feeds.slice(Math.min(tab, Math.max(0, feeds.length - 1)), Math.min(tab, Math.max(0, feeds.length - 1)) + 1) : feeds;
  const items = useMemo(() => mergedItems(shown), [shown]);
  // Cards page through everything; the other displays show their number, then "show more".
  const paged = display === 'cards';
  const visible = paged || expanded ? items : items.slice(0, limit);
  const title = t('widget.rss.name');
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const failed = data?.errors.length ?? 0;

  return (
    <CalmeWidget
      title={title}
      editMode={editMode}
      aside={isValidating && data ? <span className="nd-spinner" style={{ width: 10, height: 10 }} /> : failed ? <span className="ndc-title-note ndw-down" title={data!.errors.map(item => item.source).join('\n')}>{t('widgets.rss.failedCount', { count: failed })}</span> : undefined}
    >
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} width={600} shared={{ tab: 'widget-rss', label: t('widgets.rss.manage') }}>
          {(draft, change) => <RssSettings draft={draft} change={change} saved={saved} />}
        </WidgetSettingsButton>
      )}
      {saved.length === 0 ? <SetupGuide kind="rss" />
        : configured.length === 0 ? <div className="ndc-empty">{t('widgets.rss.noneChosen')}</div>
        : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
        : !data ? <RssSkeleton display={display} />
          : (
            <div ref={box} className={`ndw-rss ndw-rss--${display}`}>
              {tabs && feeds.length > 1 && (
                <div className="ndw-tabs" role="tablist" aria-label={title}>
                  {feeds.map((feed, index) => (
                    <button key={feed.source} type="button" role="tab" className="ndw-tab" aria-selected={index === tab} onClick={() => { setTab(index); setExpanded(false); }}>
                      {feed.title}
                    </button>
                  ))}
                </div>
              )}
              {visible.length === 0 ? <div className="ndc-empty">{t('widgets.rss.noItems')}</div> : (
                <RssItems entries={visible} display={display} images={images} summaries={summaries} seen={seen} single={shown.length === 1} widgetId={widgetId} grid={{ perPage: perPageOf(settings), mode: pick(settings.gridMode, GRID_MODES, 'pages') }} columns={columnsOf(settings, width, display === 'headlines' ? 240 : 300)} />
              )}
              {!paged && items.length > limit && (
                <button type="button" className="ndw-more" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
                  {expanded ? t('widgets.showLess') : t('widgets.showMore', { count: items.length - limit })}
                  <ChevronDown size={13} className={expanded ? 'is-open' : ''} />
                </button>
              )}
            </div>
          )}
    </CalmeWidget>
  );
}

function RssItems({ entries, display, images, summaries, seen, single, widgetId, grid, columns }: {
  entries: { item: FeedItem; feed: Feed }[]; display: RssDisplay; images: boolean; summaries: boolean; seen: number; single: boolean; widgetId: string; grid: { perPage: number; mode: GridMode }; columns: number;
}) {
  const { t } = useI18n();
  const ago = useRelativeTime();
  const sourceName = (feed: Feed) => feed.title;
  const meta = (item: FeedItem, feed: Feed) => (
    <span className="ndw-rss-meta">
      {!single && <span className="ndw-rss-source">{sourceName(feed)}</span>}
      {item.date && <time dateTime={new Date(item.date).toISOString()} title={new Date(item.date).toLocaleString()}>{ago(item.date)}</time>}
    </span>
  );
  const isNew = (item: FeedItem) => !!item.date && item.date > seen;
  const link = (item: FeedItem, children: React.ReactNode, className: string) => item.link
    ? <a key={item.id} className={className} href={item.link} target="_blank" rel="noopener noreferrer">{children}</a>
    : <div key={item.id} className={className}>{children}</div>;
  const thumb = (item: FeedItem, className = 'ndw-rss-thumb') => images && item.image
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className={className} src={item.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none'; }} />
    : null;
  const icon = (feed: Feed) => <SiteIcon url={feed.source} name={sourceName(feed)} widget={{ id: widgetId, type: 'rss' }} size={16} />;

  if (display === 'cards') {
    const cards = entries.map(({ item, feed }) => link(item, <>
          <span className="ndw-rss-card-media">{thumb(item, 'ndw-rss-card-image') ?? <span className="ndw-rss-card-fallback">{icon(feed)}</span>}</span>
          <span className="ndw-rss-card-body">
            <span className="ndw-rss-title">{isNew(item) && <span className="ndw-new" aria-label={t('widgets.rss.new')} />}{item.title}</span>
            {summaries && item.summary && <span className="ndw-rss-summary">{item.summary}</span>}
            {meta(item, feed)}
          </span>
        </>, 'ndw-rss-card'));
    return <PagedGrid items={cards} perPage={grid.perPage} mode={grid.mode} minColumn={190} label={t('widget.rss.name')} />;
  }

  if (display === 'magazine') {
    const [lead, ...rest] = entries;
    return (
      <div className="ndw-rss-magazine">
        {link(lead.item, <>
          {thumb(lead.item, 'ndw-rss-lead-image')}
          <span className="ndw-rss-lead-body">
            <span className="ndw-rss-title">{isNew(lead.item) && <span className="ndw-new" aria-label={t('widgets.rss.new')} />}{lead.item.title}</span>
            {lead.item.summary && <span className="ndw-rss-summary">{lead.item.summary}</span>}
            {meta(lead.item, lead.feed)}
          </span>
        </>, 'ndw-rss-lead')}
        {rest.length > 0 && <div className="ndw-rows">{rest.map(({ item, feed }) => link(item, <>
          <span className="ndw-rss-title">{isNew(item) && <span className="ndw-new" aria-label={t('widgets.rss.new')} />}{item.title}</span>
          {meta(item, feed)}
        </>, 'ndw-rss-row'))}</div>}
      </div>
    );
  }

  if (display === 'headlines') {
    return (
      <ColumnRows columns={columns} className="ndw-rss-headlines">
        {entries.map(({ item, feed }) => link(item, <>
          {!single && icon(feed)}
          <span className="ndw-rss-title">{isNew(item) && <span className="ndw-new" aria-label={t('widgets.rss.new')} />}{item.title}</span>
          {item.date && <time className="ndw-rss-time" dateTime={new Date(item.date).toISOString()} title={new Date(item.date).toLocaleString()}>{ago(item.date)}</time>}
        </>, 'ndw-rss-headline'))}
      </ColumnRows>
    );
  }

  return (
    <ColumnRows columns={columns}>
      {entries.map(({ item, feed }) => link(item, <>
        <span className="ndw-rss-text">
          <span className="ndw-rss-title">{isNew(item) && <span className="ndw-new" aria-label={t('widgets.rss.new')} />}{item.title}</span>
          {summaries && item.summary && <span className="ndw-rss-summary">{item.summary}</span>}
          <span className="ndw-rss-meta-line">{!single && icon(feed)}{meta(item, feed)}</span>
        </span>
        {thumb(item)}
      </>, 'ndw-rss-row'))}
    </ColumnRows>
  );
}

function RssSkeleton({ display }: { display: RssDisplay }) {
  return (
    <div className={`ndw-skeleton ndw-skeleton--${display}`} aria-hidden="true">
      {Array.from({ length: display === 'cards' ? 3 : 5 }, (_, index) => <span key={index} className="ndw-skeleton-row" />)}
    </div>
  );
}

function RssSettings({ draft, change, saved }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void; saved: SavedFeed[] }) {
  const { t } = useI18n();
  const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
  const display = pick(draft.display, DISPLAYS, 'list');
  // Only the options a display actually uses.
  const uses = {
    limit: display !== 'cards',
    images: display !== 'headlines',
    summaries: display === 'list' || display === 'cards',
  };
  return (
    <>
      <CalmeField label={t('widgets.rss.shown')} info={t('widgets.rss.shownHint')}>
        {saved.length === 0 ? <p className="ndw-note">{t('settings.rss.empty')}</p> : (
          <SourceChoice label={t('widgets.rss.shown')} items={saved.map(feed => ({ id: feed.id, name: feed.title || host(feed.url), detail: host(feed.url) }))} value={draft.feedIds} onChange={ids => change({ feedIds: ids })} />
        )}
      </CalmeField>
      <CalmeField label={t('widgets.display')}>
        <CalmeSegmented label={t('widgets.display')} value={display} options={DISPLAYS.map(value => ({ value, label: t(`widgets.rss.display.${value}`) }))} onChange={value => change({ display: value })} />
      </CalmeField>
      <CalmeField label={t('widgets.rss.grouping')}>
        <CalmeSegmented label={t('widgets.rss.grouping')} value={draft.grouping === 'tabs' ? 'tabs' : 'merged'} options={[{ value: 'merged', label: t('widgets.rss.grouping.merged') }, { value: 'tabs', label: t('widgets.rss.grouping.tabs') }]} onChange={value => change({ grouping: value })} />
      </CalmeField>
      {uses.limit && (
        <CalmeRow label={t(display === 'magazine' ? 'widgets.rss.limitMagazine' : 'widgets.rss.limit')}>
          <CalmeSlider label={t('widgets.rss.limit')} value={bounded(draft.limit, 3, 50, 8)} min={3} max={50} step={1} onChange={value => change({ limit: value })} onCommit={value => change({ limit: value })} format={String} />
        </CalmeRow>
      )}
      {display === 'cards' && <PagedGridSettings draft={draft} change={change} />}
      {(display === 'list' || display === 'headlines') && <ColumnsSetting draft={draft} change={change} />}
      {uses.images && (
        <CalmeRow label={t(display === 'magazine' ? 'widgets.rss.leadImage' : display === 'list' ? 'widgets.rss.thumbnails' : 'widgets.rss.images')}>
          <CalmeSwitch label={t('widgets.rss.images')} checked={draft.images !== false} onChange={on => change({ images: on })} />
        </CalmeRow>
      )}
      {uses.summaries && (
        <CalmeRow label={t('widgets.rss.summaries')}>
          <CalmeSwitch label={t('widgets.rss.summaries')} checked={draft.summaries === true} onChange={on => change({ summaries: on })} />
        </CalmeRow>
      )}
    </>
  );
}
