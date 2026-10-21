'use client';

import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MediaItem, MediaRecentResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField, CalmeCheckRow } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, ColumnRows, columnsOf, ColumnsSetting, DataError, pick, useBoxWidth, useRelativeTime, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { MediaConnectionField, MediaPoster, MediaSetup, useMediaConnection, useMediaLine } from '@/components/widgets/media/shared';

type Display = 'posters' | 'hero' | 'grid' | 'list';
const DISPLAYS: readonly Display[] = ['posters', 'hero', 'grid', 'list'];
type Size = 'small' | 'medium' | 'large';
const SIZES: readonly Size[] = ['small', 'medium', 'large'];
/** List rows: poster width per size. */
const ROW_POSTER: Record<Size, number> = { small: 28, medium: 44, large: 84 };
/** List columns: the narrowest a column may get per size. */
const ROW_MIN: Record<Size, number> = { small: 220, medium: 260, large: 360 };
type Kind = 'movie' | 'episode' | 'album';
const KINDS: readonly Kind[] = ['movie', 'episode', 'album'];
/** Added in the last two days: a small dot. */
const FRESH_MS = 2 * 86_400_000;

/**
 * The newest titles of a Jellyfin, Emby or Plex library: a row of posters
 * that scrolls, the latest one large over its background art, a grid, or
 * a list with when each came in.
 */
export default function CalmeRecent({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const connection = useMediaConnection(settings);
  const display = pick(settings.display, DISPLAYS, 'posters');
  const { data, error, mutate, stale } = useWidgetData<MediaRecentResponse>('/api/widgets/media/recent', widgetId, settings, { refreshMs: 5 * 60_000, isVisible, method: 'GET', enabled: !!connection });
  const [ref, width] = useBoxWidth<HTMLDivElement>();
  const title = t('widget.media-recent.name');
  const items = data?.items ?? [];

  return (
    <CalmeWidget title={title} editMode={editMode}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-media', label: t('widgets.media.manage') }}>
          {(draft, change) => <RecentSettings draft={draft} change={change} />}
        </WidgetSettingsButton>
      )}
      <div ref={ref} className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <MediaSetup settings={settings} />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 170 }} /></div>
              : items.length === 0 ? <div className="ndc-empty">{t('widgets.media.nothingNew')}</div>
                : display === 'hero' ? <Hero items={items} width={width} now={data.fetchedAt} />
                  : display === 'grid' ? <div className="ndw-media-grid">{items.map(item => <PosterCard key={item.id} now={data.fetchedAt} item={item} width={Math.max(84, Math.min(130, width / Math.max(2, Math.round(width / 120)) - 10))} />)}</div>
                    : display === 'list' ? <RecentList items={items} size={pick(settings.size, SIZES, 'medium')} columns={columnsOf(settings, width, ROW_MIN[pick(settings.size, SIZES, 'medium')])} />
                      : <PosterRow items={items} now={data.fetchedAt} />}
      </div>
    </CalmeWidget>
  );
}

function PosterCard({ item, width, now }: { item: MediaItem; width: number; now: number }) {
  const line = useMediaLine();
  // Measured from when the server read the library, not from this render.
  const fresh = item.addedAt !== undefined && now - item.addedAt < FRESH_MS;
  const sub = line(item);
  const body = (
    <>
      <span className="ndw-media-poster-wrap">
        <MediaPoster item={item} width={width} frame />
        {fresh && <span className="ndw-media-fresh" aria-hidden="true" />}
        {item.count !== undefined && item.count > 1 && <span className="ndw-media-episodes" aria-hidden="true">{item.count}</span>}
      </span>
      <span className="ndw-media-card-title">{item.kind === 'episode' && item.subtitle ? item.subtitle : item.title}</span>
      {sub && <span className="ndw-media-card-sub">{item.kind === 'episode' ? [item.season !== undefined && item.episode !== undefined ? `S${item.season} · E${item.episode}` : '', item.title].filter(Boolean).join(' · ') : sub}</span>}
    </>
  );
  const label = [item.title, sub].filter(Boolean).join(' · ');
  return item.link
    ? <a className="ndw-media-tile" style={{ width }} href={item.link} target="_blank" rel="noopener noreferrer" title={label}>{body}</a>
    : <span className="ndw-media-tile" style={{ width }} title={label}>{body}</span>;
}

/** Posters in one row; arrows scroll it by a screenful. */
function PosterRow({ items, now }: { items: MediaItem[]; now: number }) {
  const { t } = useI18n();
  const row = useRef<HTMLDivElement>(null);
  const scroll = (step: 1 | -1) => row.current?.scrollBy({ left: step * row.current.clientWidth * 0.85, behavior: 'smooth' });
  return (
    <div className="ndw-media-row-wrap">
      <div ref={row} className="ndw-media-poster-row">{items.map(item => <PosterCard key={item.id} item={item} width={112} now={now} />)}</div>
      <button type="button" className="ndw-media-scroll is-prev" onClick={() => scroll(-1)} aria-label={t('widgets.grid.previous')}><ChevronLeft size={16} /></button>
      <button type="button" className="ndw-media-scroll is-next" onClick={() => scroll(1)} aria-label={t('widgets.grid.next')}><ChevronRight size={16} /></button>
    </div>
  );
}

/** The newest title large over its art, the next ones as small posters beneath. */
function Hero({ items, width, now }: { items: MediaItem[]; width: number; now: number }) {
  const { t } = useI18n();
  const line = useMediaLine();
  const relative = useRelativeTime();
  const [first, ...rest] = items;
  const height = Math.round(Math.min(280, Math.max(150, width * 0.42)));
  const heading = first.kind === 'episode' && first.subtitle ? first.subtitle : first.title;
  const sub = first.kind === 'episode' ? [first.season !== undefined && first.episode !== undefined ? t('widgets.media.episodeCode', { season: first.season, episode: first.episode }) : '', first.title].filter(Boolean).join(' · ') : line(first);
  const inner = (
    <>
      {first.backdrop && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ndw-media-hero-art" src={first.backdrop} alt="" decoding="async" />
      )}
      <span className="ndw-media-hero-shade" aria-hidden="true" />
      <span className="ndw-media-hero-body">
        <MediaPoster item={first} width={Math.round(height * 0.5)} eager />
        <span className="ndw-media-hero-text">
          <span className="ndw-media-hero-tag">{t(`widgets.media.kind.${first.kind === 'album' ? 'album' : first.kind === 'episode' ? 'episode' : first.kind === 'series' ? 'series' : 'movie'}`)}{first.addedAt && <span className="ndw-media-hero-when">{relative(first.addedAt)}</span>}</span>
          <span className="ndw-media-hero-title">{heading}</span>
          {sub && <span className="ndw-media-hero-sub">{sub}</span>}
        </span>
      </span>
    </>
  );
  return (
    <div className="ndw-media-hero-wrap">
      {first.link
        ? <a className="ndw-media-hero" style={{ height }} href={first.link} target="_blank" rel="noopener noreferrer">{inner}</a>
        : <div className="ndw-media-hero" style={{ height }}>{inner}</div>}
      {rest.length > 0 && <div className="ndw-media-poster-row is-small">{rest.map(item => <PosterCard key={item.id} item={item} width={84} now={now} />)}</div>}
    </div>
  );
}

function RecentList({ items, size, columns }: { items: MediaItem[]; size: Size; columns: number }) {
  const line = useMediaLine();
  const relative = useRelativeTime();
  return (
    <ColumnRows columns={columns} className={`ndw-media-list is-${size}`}>
      {items.map(item => {
        const text = (
          <>
            <MediaPoster item={item} width={ROW_POSTER[size]} />
            <span className="ndw-media-row-text">
              <span className="ndw-media-title">{item.kind === 'episode' && item.subtitle ? item.subtitle : item.title}</span>
              <span className="ndw-media-sub">{item.kind === 'episode' ? [item.season !== undefined && item.episode !== undefined ? `S${item.season} · E${item.episode}` : '', item.title].filter(Boolean).join(' · ') : line(item)}</span>
            </span>
            {item.addedAt && <span className="ndw-media-time">{relative(item.addedAt)}</span>}
          </>
        );
        return item.link
          ? <a key={item.id} className="ndw-media-row" href={item.link} target="_blank" rel="noopener noreferrer">{text}</a>
          : <span key={item.id} className="ndw-media-row">{text}</span>;
      })}
    </ColumnRows>
  );
}

function RecentSettings({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  const kinds = Array.isArray(draft.kinds) ? KINDS.filter(kind => (draft.kinds as unknown[]).includes(kind)) : [...KINDS];
  return (
    <>
      <MediaConnectionField draft={draft} change={change} />
      <CalmeField label={t('widgets.display')}>
        <CalmeSegmented label={t('widgets.display')} value={pick(draft.display, DISPLAYS, 'posters')} options={DISPLAYS.map(value => ({ value, label: t(`widgets.media.recent.${value}`) }))} onChange={value => change({ display: value })} />
      </CalmeField>
      {pick(draft.display, DISPLAYS, 'posters') === 'list' && (
        <>
          <CalmeField label={t('widgets.media.size')}>
            <CalmeSegmented label={t('widgets.media.size')} value={pick(draft.size, SIZES, 'medium')} options={SIZES.map(value => ({ value, label: t(`widgets.media.size.${value}`) }))} onChange={value => change({ size: value === 'medium' ? null : value })} />
          </CalmeField>
          <ColumnsSetting draft={draft} change={change} />
        </>
      )}
      <CalmeField label={t('widgets.media.kinds')}>
        <div className="ndc-dlg-stack">
          {KINDS.map(kind => (
            <CalmeCheckRow key={kind} checked={kinds.includes(kind)} onChange={() => {
              const next = kinds.includes(kind) ? kinds.filter(item => item !== kind) : [...kinds, kind];
              if (next.length) change({ kinds: KINDS.filter(item => next.includes(item)) });
            }}>
              <span className="ndc-dlg-name">{t(`widgets.media.kinds.${kind}`)}</span>
            </CalmeCheckRow>
          ))}
        </div>
      </CalmeField>
      {kinds.includes('episode') && (
        <CalmeRow label={t('widgets.media.group')} info={t('widgets.media.groupHint')}>
          <CalmeSwitch label={t('widgets.media.group')} checked={draft.group !== false} onChange={on => change({ group: on ? null : false })} />
        </CalmeRow>
      )}
      <CalmeRow label={t('widgets.media.count')}>
        <CalmeSlider label={t('widgets.media.count')} value={bounded(draft.count, 4, 40, 16)} min={4} max={40} step={1} onChange={value => change({ count: value })} onCommit={value => change({ count: value })} format={String} />
      </CalmeRow>
    </>
  );
}
