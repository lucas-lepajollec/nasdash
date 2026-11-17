'use client';

import React, { useState } from 'react';
import { BookOpen, Headphones } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { ReadingItem, ReadingSummary } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSegmented } from '@/components/modals/settings/shared/CalmeControls';
import { KitWidget } from '@/components/widgets/content/KitWidget';
import { pick, useStableGrid } from '@/components/widgets/content/kit';
import { Track } from '@/components/widgets/media/visual';

const SHOWS = ['both', 'progress', 'recent'] as const;
const DISPLAYS = ['covers', 'list'] as const;

/** The address of a cover, through NasDash (an administrator's unsaved settings travel with it, like other widget images). */
export function coverUrl(widgetId: string, cover: string, draft?: WidgetSettings): string {
  const query = new URLSearchParams({ widget: 'reading', widgetId, id: cover });
  if (draft) query.set('draft', JSON.stringify(draft));
  return `/api/widgets/kit/image?${query}`;
}

/**
 * Audiobookshelf, Kavita or Komga: what is being read or listened to, with how
 * far, then what was added. Covers (a shelf that wraps to the width) or a list.
 */
export default function CalmeReading(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <KitWidget<ReadingSummary> widget="reading" refreshMs={120_000} skeleton={[22, 120]} {...props}
      extraSettings={(draft, change) => (
        <>
          <CalmeRow label={t('widgets.display')}>
            <CalmeSegmented label={t('widgets.display')} value={pick(draft.display, DISPLAYS, 'covers')} options={DISPLAYS.map(value => ({ value, label: t(`widgets.reading.display.${value}`) }))} onChange={value => change({ display: value === 'covers' ? null : value })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.reading.show')}>
            <CalmeSegmented label={t('widgets.reading.show')} value={pick(draft.show, SHOWS, 'both')} options={SHOWS.map(value => ({ value, label: t(`widgets.reading.show.${value}`) }))} onChange={value => change({ show: value === 'both' ? null : value })} />
          </CalmeRow>
        </>
      )}>
      {data => <Reading data={data} widgetId={props.widgetId} settings={props.settings} />}
    </KitWidget>
  );
}

function Reading({ data, widgetId, settings }: { data: ReadingSummary; widgetId: string; settings: WidgetSettings }) {
  const { t } = useI18n();
  const show = pick(settings.show, SHOWS, 'both');
  const list = pick(settings.display, DISPLAYS, 'covers') === 'list';
  const sections = ([['progress', data.inProgress], ['recent', data.recent]] as const).filter(([id, items]) => (show === 'both' || show === id) && items.length > 0);
  if (sections.length === 0) return <span className="ndw-media-sub is-quiet">{t('widgets.reading.none')}</span>;
  return (
    <div className="ndw-kit ndw-read">
      {sections.map(([id, items]) => (
        <section key={id} className="ndw-read-section">
          <span className="ndw-mx-label">{t(`widgets.reading.section.${id}`)}</span>
          {list
            ? <ul className="ndw-read-list">{items.map(item => <Book key={item.id} item={item} widgetId={widgetId} settings={settings} list />)}</ul>
            : <Shelf items={items} widgetId={widgetId} settings={settings} />}
        </section>
      ))}
    </div>
  );
}

/** Covers that fill the line while they do not all fit, then keep their size (no breathing as the widget widens). */
function Shelf({ items, widgetId, settings }: { items: ReadingItem[]; widgetId: string; settings: WidgetSettings }) {
  const [ref, style] = useStableGrid<HTMLUListElement>(items.length, 76, 112, 10);
  return <ul ref={ref} className="ndw-read-shelf" style={style}>{items.map(item => <Book key={item.id} item={item} widgetId={widgetId} settings={settings} list={false} />)}</ul>;
}

function Book({ item, widgetId, settings, list }: { item: ReadingItem; widgetId: string; settings: WidgetSettings; list: boolean }) {
  const { user } = useConfig();
  const { locale } = useI18n();
  const [failed, setFailed] = useState(false);
  const Icon = item.kind === 'audiobook' || item.kind === 'podcast' ? Headphones : BookOpen;
  const cover = (
    <span className="ndw-read-cover" aria-hidden="true">
      {item.cover && !failed
        // eslint-disable-next-line @next/next/no-img-element -- a cover relayed by NasDash
        ? <img src={coverUrl(widgetId, item.cover, user?.role === 'admin' ? settings : undefined)} alt="" loading="lazy" onError={() => setFailed(true)} />
        : <Icon size={16} />}
    </span>
  );
  return (
    <li className="ndw-read-item" title={[item.title, item.subtitle].filter(Boolean).join(' · ')}>
      {cover}
      <span className="ndw-read-text">
        <span className="ndw-read-title">{item.title}</span>
        {item.subtitle && <span className="ndw-media-sub">{item.subtitle}</span>}
      </span>
      {item.progress !== undefined && item.progress > 0 && item.progress < 100 && <Track value={item.progress} thin />}
      {list && item.progress !== undefined && <span className="ndw-read-percent">{new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(item.progress / 100)}</span>}
    </li>
  );
}
