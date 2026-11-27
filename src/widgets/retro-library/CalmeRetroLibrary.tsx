'use client';

import React, { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { RetroGame, RetroLibrarySummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { useConfig } from '@/hooks/useConfig';
import { formatBytes } from '@/components/widgets/deviceReadings';
import { CalmeRow, CalmeSegmented, CalmeSlider } from '@/components/modals/settings/shared/CalmeControls';
import { KitWidget } from '@/components/widgets/content/KitWidget';
import { bounded, pick, useBoxWidth, useRelativeTime, useStableGrid } from '@/components/widgets/content/kit';
import { Backdrop, Fan, Figure } from '@/components/widgets/media/visual';

const SHOWS = ['both', 'recent', 'platforms'] as const;
const DISPLAYS = ['covers', 'list'] as const;
export const RECENT = { min: 2, max: 24, default: 6 } as const;
/** Platforms shown as shelves with their covers; the others follow as text. */
const SHELVES = 4;

/** A cover through NasDash (an administrator's unsaved settings travel with it, like other widget images). */
function coverUrl(widgetId: string, cover: string, draft?: WidgetSettings): string {
  const query = new URLSearchParams({ widget: 'retro-library', widgetId, id: cover });
  if (draft) query.set('draft', JSON.stringify(draft));
  return `/api/widgets/kit/image?${query}`;
}

/**
 * RomM, laid out like the media library: the totals as figures, the biggest
 * platforms as shelves of their latest covers (the others as text), then the
 * games added last as covers or a list, like the reading widget.
 */
export default function CalmeRetroLibrary(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <KitWidget<RetroLibrarySummary> widget="retro-library" refreshMs={300_000} skeleton={[40, 160, 120]} {...props}
      extraSettings={(draft, change) => (
        <>
          <CalmeRow label={t('widgets.retro.show')}>
            <CalmeSegmented label={t('widgets.retro.show')} value={pick(draft.show, SHOWS, 'both')} options={SHOWS.map(value => ({ value, label: t(`widgets.retro.show.${value}`) }))} onChange={value => change({ show: value === 'both' ? null : value })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.display')}>
            <CalmeSegmented label={t('widgets.display')} value={pick(draft.display, DISPLAYS, 'covers')} options={DISPLAYS.map(value => ({ value, label: t(`widgets.reading.display.${value}`) }))} onChange={value => change({ display: value === 'covers' ? null : value })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.retro.recentCount')} stacked>
            <CalmeSlider label={t('widgets.retro.recentCount')} min={RECENT.min} max={RECENT.max} step={1} value={bounded(draft.recent, RECENT.min, RECENT.max, RECENT.default)}
              onChange={value => change({ recent: value })} onCommit={value => change({ recent: value === RECENT.default ? null : value })} format={String} />
          </CalmeRow>
        </>
      )}>
      {data => <Library data={data} widgetId={props.widgetId} settings={props.settings} />}
    </KitWidget>
  );
}

function Library({ data, widgetId, settings }: { data: RetroLibrarySummary; widgetId: string; settings: WidgetSettings }) {
  const { t, language } = useI18n();
  const { user } = useConfig();
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const number = new Intl.NumberFormat(language);
  const show = pick(settings.show, SHOWS, 'both');
  const covers = pick(settings.display, DISPLAYS, 'covers') === 'covers';
  const recent = data.recent.slice(0, bounded(settings.recent, RECENT.min, RECENT.max, RECENT.default));
  const url = (cover: string) => coverUrl(widgetId, cover, user?.role === 'admin' ? settings : undefined);
  const columns = Math.max(1, Math.min(SHELVES, Math.floor((width + 12) / 190)));
  // Whole rows of shelves only: a lone shelf on a second line goes to the text list instead.
  // One shelf per line (a phone): two of them, the rest as text.
  const withCovers = covers ? data.platforms.filter(platform => platform.covers?.length).slice(0, columns === 1 ? 2 : SHELVES) : [];
  const pictured = withCovers.length > columns ? withCovers.slice(0, withCovers.length - (withCovers.length % columns)) : withCovers;
  const plain = data.platforms.filter(platform => !pictured.includes(platform)).slice(0, 12);
  return (
    <div className="ndw-kit ndw-retro" ref={box}>
      <div className="ndw-mx-figures is-wrap">
        <Figure size="large" value={number.format(data.totals.games)} unit={t('widgets.retro.games')} />
        <Figure size="large" value={number.format(data.totals.platforms)} unit={t('widgets.retro.platformsUnit')} />
        {data.totals.saves ? <Figure size="large" value={number.format(data.totals.saves)} unit={t('widgets.retro.savesUnit')} /> : null}
        {data.totals.sizeBytes ? <span className="ndw-mx-figures-end"><span className="ndw-mx-meta">{formatBytes(data.totals.sizeBytes, language)}</span></span> : null}
      </div>
      {show !== 'recent' && pictured.length > 0 && (
        <div className="ndw-mx-shelves is-small" style={{ '--ndw-cols': Math.min(columns, pictured.length) } as React.CSSProperties}>
          {pictured.map(platform => {
            const urls = platform.covers!.map(url);
            return (
              <div key={platform.id} className="ndw-mx-shelf">
                <Backdrop src={urls[urls.length === 3 ? 1 : 0]} blur />
                <span className="ndw-mx-fan" aria-hidden="true"><Fan urls={urls} /></span>
                <span className="ndw-mx-shelf-foot">
                  <span className="ndw-media-row-text"><span className="ndw-mx-title">{platform.name}</span></span>
                  <span className="ndw-mx-shelf-count">{number.format(platform.games)}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {show !== 'recent' && plain.length > 0 && (
        <ul className="ndw-retro-platforms" style={{ '--ndw-cols': Math.max(1, Math.min(3, Math.floor((width + 24) / 180))) } as React.CSSProperties}>
          {plain.map(platform => (
            <li key={platform.id} className="ndw-kit-row-head">
              <span className="ndw-kit-row-name" title={platform.name}>{platform.name}</span>
              <span className="ndw-kit-row-value">{number.format(platform.games)}</span>
            </li>
          ))}
        </ul>
      )}
      {show !== 'platforms' && recent.length > 0 && (
        <section className="ndw-read-section">
          <span className="ndw-mx-label">{t('widgets.retro.recent')}</span>
          {covers
            ? <Shelf games={recent} url={url} />
            : <ul className="ndw-read-list">{recent.map(game => <ListGame key={game.id} game={game} url={url} />)}</ul>}
        </section>
      )}
    </div>
  );
}

/** Covers that fill the line while they do not all fit, then keep their size (as in the reading widget). */
function Shelf({ games, url }: { games: RetroGame[]; url: (cover: string) => string }) {
  const [ref, style] = useStableGrid<HTMLUListElement>(games.length, 76, 112, 10);
  return <ul ref={ref} className="ndw-read-shelf" style={style}>{games.map(game => <Cover key={game.id} game={game} url={url} />)}</ul>;
}

function Art({ game, url }: { game: RetroGame; url: (cover: string) => string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="ndw-read-cover" aria-hidden="true">
      {game.cover && !failed
        // eslint-disable-next-line @next/next/no-img-element -- a cover relayed by NasDash, with a fallback
        ? <img src={url(game.cover)} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        : <Gamepad2 size={16} />}
    </span>
  );
}

function Cover({ game, url }: { game: RetroGame; url: (cover: string) => string }) {
  return (
    <li className="ndw-read-item" title={[game.name, game.platform].filter(Boolean).join(' · ')}>
      <Art game={game} url={url} />
      <span className="ndw-read-text">
        <span className="ndw-read-title">{game.name}</span>
        {game.platform && <span className="ndw-media-sub">{game.platform}</span>}
      </span>
    </li>
  );
}

function ListGame({ game, url }: { game: RetroGame; url: (cover: string) => string }) {
  const ago = useRelativeTime();
  return (
    <li className="ndw-read-item" title={[game.name, game.platform].filter(Boolean).join(' · ')}>
      <Art game={game} url={url} />
      <span className="ndw-read-text">
        <span className="ndw-read-title">{game.name}</span>
        <span className="ndw-media-sub">{[game.platform, ago(game.addedAt)].filter(Boolean).join(' · ')}</span>
      </span>
    </li>
  );
}
