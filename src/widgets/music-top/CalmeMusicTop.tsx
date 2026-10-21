'use client';

import React, { useMemo, useState } from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MusicAlbum, MusicTopResponse, MusicTrack } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSlider } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { bounded, ColumnRows, columnsOf, ColumnsSetting, DataError, OrderedChoice, pick, useBoxWidth, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { Cover, MusicServerField, MusicSetup, PlaybackSetting, useMusicConnection } from '@/components/widgets/music/shared';
import { musicPlayer, PlayButton, useCanPlay } from '@/components/widgets/music/player';

type Page = 'albums' | 'tracks';
const PAGES: readonly Page[] = ['albums', 'tracks'];
const CONTENTS = ['albums', 'tracks', 'pages'] as const;

function pagesOf(settings: WidgetSettings): Page[] {
  const list = Array.isArray(settings.pages) ? settings.pages.filter((page, index, all): page is Page => PAGES.includes(page as Page) && all.indexOf(page) === index) : [];
  return list.length ? list : [...PAGES];
}

/**
 * What was played most, all time (servers keep no count per period): the
 * albums or the tracks, ranked, each to play; or both as pages switched
 * from the widget, in the chosen order.
 */
export default function CalmeMusicTop({ widgetId, settings = {}, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings?: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t, locale } = useI18n();
  const connection = useMusicConnection(settings);
  const { data, error, mutate, stale } = useWidgetData<MusicTopResponse>('/api/widgets/music/top', widgetId, settings, { refreshMs: 15 * 60_000, isVisible, method: 'GET', enabled: !!connection });
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const canPlay = useCanPlay(settings);
  const title = t('widget.music-top.name');
  const content = pick(settings.content, CONTENTS, 'albums');
  const pages = content === 'pages' ? pagesOf(settings) : [content];
  const [tab, setTab] = useState<Page | null>(null);
  const page: Page = tab && pages.includes(tab) ? tab : pages[0];
  const columns = columnsOf(settings, width, 320);

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data ? <span className="ndc-title-note">{data.name}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-media', label: t('widgets.media.manage') }}>
          {(draft, change) => <TopSettings draft={draft} change={change} />}
        </WidgetSettingsButton>
      )}
      <div ref={box} className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <MusicSetup settings={settings} />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true">{[0, 1, 2].map(row => <span key={row} className="ndw-skeleton-row" />)}</div>
              : (
                <div className="ndw-mx-stack">
                  {pages.length > 1 && (
                    <div className="ndw-mx-tabs" role="tablist" aria-label={title}>
                      {pages.map(which => (
                        <button key={which} type="button" role="tab" aria-selected={page === which} className={page === which ? 'is-on' : ''} onClick={() => setTab(which)}>{t(`widgets.music.top.${which}`)}</button>
                      ))}
                    </div>
                  )}
                  {page === 'tracks'
                    ? <Ranked items={data.tracks ?? []} columns={columns} number={number} render={(track: MusicTrack, index) => ({
                      id: `t-${track.id}`, cover: <Cover id={`t-${track.id}`} title={track.album ?? track.title} cover={track.cover} size={46} />, title: track.title, sub: [track.artist, track.album].filter(Boolean).join(' · '), plays: track.plays,
                      play: canPlay ? <PlayButton label={t('widgets.music.playOne', { name: track.title })} playingKey={`top:${track.id}`} onPlay={() => musicPlayer.playTracks(widgetId, data.tracks ?? [], index, `top:${track.id}`)} /> : null,
                    })} />
                    : <Ranked items={data.albums} columns={columns} number={number} render={(album: MusicAlbum) => ({
                      id: album.id, cover: <Cover id={album.id} title={album.title} cover={album.cover} size={46} />, title: album.title, sub: album.artist ?? '', plays: album.plays, link: album.link,
                      play: canPlay ? <PlayButton label={t('widgets.music.playOne', { name: album.title })} playingKey={`album:${album.id}`} onPlay={() => void musicPlayer.playCollection(widgetId, 'album', album.id)} /> : null,
                    })} />}
                </div>
              )}
      </div>
    </CalmeWidget>
  );
}

interface Row { id: string; cover: React.ReactNode; title: string; sub: string; plays?: number; link?: string; play: React.ReactNode }

/** A ranked list: rank, cover, title and line, play, number of plays. */
function Ranked<T>({ items, columns, number, render }: { items: T[]; columns: number; number: Intl.NumberFormat; render: (item: T, index: number) => Row }) {
  const { t } = useI18n();
  if (!items.length) return <div className="ndw-mx-empty"><span className="ndw-mx-calm">{t('widgets.music.noPlays')}</span></div>;
  return (
    <ColumnRows columns={columns} className="ndw-mx-lines">
      {items.map((item, index) => {
        const row = render(item, index);
        const body = (
          <>
            <span className="ndw-music-rank">{index + 1}</span>
            {row.cover}
            <span className="ndw-mx-qrow-text">
              <span className="ndw-media-title">{row.title}</span>
              {row.sub && <span className="ndw-media-sub">{row.sub}</span>}
            </span>
            {row.play}
            {row.plays !== undefined && (
              <span className="ndw-mx-end">
                <span className="ndw-mx-when">{number.format(row.plays)}</span>
                <span className="ndw-media-time">{t('widgets.music.plays', { count: row.plays })}</span>
              </span>
            )}
          </>
        );
        return row.link
          ? <a key={row.id} className="ndw-mx-qrow ndw-music-toprow" href={row.link} target="_blank" rel="noopener noreferrer">{body}</a>
          : <div key={row.id} className="ndw-mx-qrow ndw-music-toprow">{body}</div>;
      })}
    </ColumnRows>
  );
}

function TopSettings({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  const content = pick(draft.content, CONTENTS, 'albums');
  const pages = pagesOf(draft);
  const setPages = (next: Page[]) => change({ pages: next.length === PAGES.length && next.every((page, index) => page === PAGES[index]) ? null : next });
  return (
    <>
      <MusicServerField draft={draft} change={change} />
      <CalmeField label={t('widgets.music.content')}>
        <CalmeSegmented label={t('widgets.music.content')} value={content} options={CONTENTS.map(value => ({ value, label: t(value === 'pages' ? 'widgets.music.content.pages' : `widgets.music.top.${value}`) }))} onChange={value => change({ content: value === 'albums' ? null : value })} />
      </CalmeField>
      {content === 'pages' && (
        <CalmeField label={t('widgets.music.pages')} info={t('widgets.music.pagesHint')}>
          <OrderedChoice all={PAGES} value={pages} labelOf={page => t(`widgets.music.top.${page}`)} onChange={setPages} />
        </CalmeField>
      )}
      <CalmeRow label={t('widgets.music.shown')}>
        <CalmeSlider label={t('widgets.music.shown')} value={bounded(draft.count, 3, 20, 6)} min={3} max={20} step={1} onChange={value => change({ count: value })} onCommit={value => change({ count: value })} format={String} />
      </CalmeRow>
      <ColumnsSetting draft={draft} change={change} />
      <PlaybackSetting draft={draft} change={change} />
    </>
  );
}
