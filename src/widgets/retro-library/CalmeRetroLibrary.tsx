'use client';

import React, { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { RetroGame, RetroLibrarySummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { formatBytes } from '@/components/widgets/deviceReadings';
import { CalmeRow, CalmeSegmented, CalmeSlider } from '@/components/modals/settings/shared/CalmeControls';
import { KitWidget } from '@/components/widgets/content/KitWidget';
import { bounded, pick, useRelativeTime, useStableGrid } from '@/components/widgets/content/kit';

const SHOWS = ['both', 'recent', 'platforms'] as const;
const DISPLAYS = ['covers', 'list'] as const;
export const RECENT = { min: 2, max: 24, default: 6 } as const;
const PLATFORMS = 6;

/** A cover through NasDash (an administrator's unsaved settings travel with it, like other widget images). */
function coverUrl(widgetId: string, cover: string, draft?: WidgetSettings): string {
  const query = new URLSearchParams({ widget: 'retro-library', widgetId, id: cover });
  if (draft) query.set('draft', JSON.stringify(draft));
  return `/api/widgets/kit/image?${query}`;
}

/**
 * RomM: how many games on how many platforms, the biggest platforms as bars,
 * then the games added last, as covers or a list.
 */
export default function CalmeRetroLibrary(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <KitWidget<RetroLibrarySummary> widget="retro-library" refreshMs={300_000} skeleton={[36, 60, 120]} {...props}
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
  const show = pick(settings.show, SHOWS, 'both');
  const recent = data.recent.slice(0, bounded(settings.recent, RECENT.min, RECENT.max, RECENT.default));
  const biggest = data.platforms.slice(0, PLATFORMS);
  const top = Math.max(1, ...biggest.map(platform => platform.games));
  const sub = [t('widgets.retro.platforms', { count: data.totals.platforms }), data.totals.sizeBytes ? formatBytes(data.totals.sizeBytes, language) : '', data.totals.saves ? t('widgets.retro.saves', { count: data.totals.saves }) : ''].filter(Boolean).join(' · ');
  return (
    <div className="ndw-kit ndw-retro">
      <div className="ndw-retro-head">
        <span className="ndw-upd-number">{new Intl.NumberFormat(language).format(data.totals.games)}</span>
        <span className="ndw-upd-label"><span className="ndw-upd-label-main">{t('widgets.retro.games', { count: data.totals.games })}</span><span className="ndw-media-sub">{sub}</span></span>
      </div>
      {show !== 'recent' && biggest.length > 0 && (
        <ul className="ndw-retro-platforms">
          {biggest.map(platform => (
            <li key={platform.id} className="ndw-retro-platform">
              <span className="ndw-retro-platform-name" title={platform.name}>{platform.name}</span>
              <span className="ndw-retro-bar" aria-hidden="true"><span style={{ width: `${Math.max(3, platform.games / top * 100)}%` }} /></span>
              <span className="ndw-retro-platform-count">{platform.games}</span>
            </li>
          ))}
        </ul>
      )}
      {show !== 'platforms' && recent.length > 0 && (
        <section className="ndw-read-section">
          <span className="ndw-mx-label">{t('widgets.retro.recent')}</span>
          {pick(settings.display, DISPLAYS, 'covers') === 'list'
            ? <ul className="ndw-retro-list">{recent.map(game => <ListGame key={game.id} game={game} />)}</ul>
            : <Shelf games={recent} widgetId={widgetId} settings={settings} />}
        </section>
      )}
    </div>
  );
}

function Shelf({ games, widgetId, settings }: { games: RetroGame[]; widgetId: string; settings: WidgetSettings }) {
  const [ref, style] = useStableGrid<HTMLUListElement>(games.length, 72, 104, 10);
  return <ul ref={ref} className="ndw-retro-shelf" style={style}>{games.map(game => <Cover key={game.id} game={game} widgetId={widgetId} settings={settings} />)}</ul>;
}

function Cover({ game, widgetId, settings }: { game: RetroGame; widgetId: string; settings: WidgetSettings }) {
  const [failed, setFailed] = useState(false);
  return (
    <li className="ndw-retro-game" title={[game.name, game.platform].filter(Boolean).join(' · ')}>
      <span className="ndw-retro-cover">
        {game.cover && !failed
          // eslint-disable-next-line @next/next/no-img-element -- a cover relayed by NasDash, with a fallback
          ? <img src={coverUrl(widgetId, game.cover, settings)} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
          : <Gamepad2 size={22} aria-hidden="true" />}
      </span>
      <span className="ndw-retro-game-name">{game.name}</span>
      <span className="ndw-retro-game-platform">{game.platform}</span>
    </li>
  );
}

function ListGame({ game }: { game: RetroGame }) {
  const ago = useRelativeTime();
  return (
    <li className="ndw-retro-row">
      <span className="ndw-retro-row-name" title={game.name}>{game.name}</span>
      <span className="ndw-media-sub">{[game.platform, ago(game.addedAt)].filter(Boolean).join(' · ')}</span>
    </li>
  );
}
