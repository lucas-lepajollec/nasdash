'use client';

import React, { useEffect, useState } from 'react';
import { Clapperboard, Pause } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MediaNowPlayingResponse, MediaSession } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { DataError, pick, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { clock, MediaConnectionField, MediaPoster, MediaProgress, MediaSetup, useMediaConnection, useMediaLine } from '@/components/widgets/media/shared';

type Layout = 'cards' | 'compact';
const LAYOUTS: readonly Layout[] = ['cards', 'compact'];

/** The clock of the page: playing sessions move on between two refreshes. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * Who is watching or listening on a Jellyfin, Emby or Plex server: the
 * title over its background art, its poster, the player, how it is played
 * (direct or transcoded) and where it is. Names of accounts show to
 * administrators, and to viewers only when the widget allows it.
 */
export default function CalmeNowPlaying({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const connection = useMediaConnection(settings);
  const layout = pick(settings.layout, LAYOUTS, 'cards');
  const { data, error, mutate } = useNowPlaying(widgetId, settings, isVisible, !!connection);
  const sessions = data?.sessions ?? [];
  const now = useNow(isVisible && sessions.some(session => session.state === 'playing'));
  const title = t('widget.media-nowplaying.name');

  return (
    <CalmeWidget title={title} editMode={editMode} aside={sessions.length ? <span className="ndc-title-note">{t('widgets.media.streams', { count: sessions.length })}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-media', label: t('widgets.media.manage') }}>
          {(draft, change) => (
            <>
              <MediaConnectionField draft={draft} change={change} />
              <CalmeField label={t('widgets.display')}>
                <CalmeSegmented label={t('widgets.display')} value={pick(draft.layout, LAYOUTS, 'cards')} options={LAYOUTS.map(value => ({ value, label: t(`widgets.media.layout.${value}`) }))} onChange={value => change({ layout: value })} />
              </CalmeField>
              <CalmeRow label={t('widgets.media.showUsers')} info={t('widgets.media.showUsersHint')}>
                <CalmeSwitch label={t('widgets.media.showUsers')} checked={draft.showUsers === true} onChange={on => change({ showUsers: on || null })} />
              </CalmeRow>
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div className="ndw-media-box">
        {!connection ? <MediaSetup settings={settings} />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 96 }} /></div>
              : sessions.length === 0 ? (
                <div className="ndw-media-idle">
                  <Clapperboard size={20} aria-hidden="true" />
                  <span>{t('widgets.media.idle')}</span>
                  <span className="ndw-media-idle-server">{data.name}</span>
                </div>
              ) : (
                <ul className={`ndw-media-sessions is-${layout}`}>
                  {sessions.map(session => <Session key={session.id} session={session} layout={layout} elapsed={session.state === 'playing' ? Math.min(MAX_DRIFT, Math.max(0, now - data.fetchedAt)) : 0} />)}
                </ul>
              )}
      </div>
    </CalmeWidget>
  );
}

/** Sessions every 10 seconds while visible. */
function useNowPlaying(widgetId: string, settings: WidgetSettings, isVisible: boolean, enabled: boolean) {
  return useWidgetData<MediaNowPlayingResponse>('/api/widgets/media/now-playing', widgetId, settings, { refreshMs: 10_000, isVisible, method: 'GET', enabled });
}

/** Time played since the server read the sessions; bounded, so a clock gap between machines cannot run away. */
const MAX_DRIFT = 15_000;

function Session({ session, layout, elapsed }: { session: MediaSession; layout: Layout; elapsed: number }) {
  const { t } = useI18n();
  const line = useMediaLine();
  const { item } = session;
  const duration = item.durationMs;
  const position = session.positionMs === undefined ? undefined : Math.min(duration ?? Infinity, session.positionMs + elapsed);
  const paused = session.state !== 'playing';
  const method = session.method ? t(`widgets.media.method.${session.method}`) : undefined;
  const subtitle = line(item);
  const label = [item.title, subtitle, session.user, session.player].filter(Boolean).join(' · ');
  const meta = (
    <span className="ndw-media-meta">
      {session.user && <span className="ndw-media-user"><span className="ndw-media-avatar" aria-hidden="true">{session.user.trim()[0]?.toUpperCase()}</span>{session.user}</span>}
      {session.player && <span className="ndw-media-player">{session.player}</span>}
    </span>
  );
  const badges = (
    <span className="ndw-media-badges">
      {session.quality && <span className="ndw-media-badge">{session.quality}</span>}
      {method && <span className="ndw-media-badge" title={session.bitrateKbps ? t('widgets.media.bitrate', { value: Math.round(session.bitrateKbps / 100) / 10 }) : undefined}>{method}</span>}
    </span>
  );

  if (layout === 'compact') {
    return (
      <li className={`ndw-media-row ${paused ? 'is-paused' : ''}`} aria-label={label}>
        <MediaPoster item={item} width={34} />
        <span className="ndw-media-row-text">
          <span className="ndw-media-title">{item.title}</span>
          <span className="ndw-media-sub">{[subtitle, session.user].filter(Boolean).join(' · ')}</span>
          <MediaProgress position={position} duration={duration} paused={paused} />
        </span>
        {paused ? <Pause size={13} className="ndw-media-paused-icon" aria-label={t('widgets.media.paused')} /> : duration && position !== undefined && <span className="ndw-media-time">{t('widgets.media.remaining', { time: clock(duration - position) })}</span>}
      </li>
    );
  }

  return (
    <li className={`ndw-media-card ${paused ? 'is-paused' : ''}`} aria-label={label}>
      {item.backdrop && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ndw-media-card-art" src={item.backdrop} alt="" loading="lazy" decoding="async" />
      )}
      <span className="ndw-media-card-shade" aria-hidden="true" />
      <span className="ndw-media-card-body">
        <span className="ndw-media-card-poster">
          <MediaPoster item={item} width={66} eager />
          {paused && <span className="ndw-media-pause" aria-label={t('widgets.media.paused')}><Pause size={16} /></span>}
        </span>
        <span className="ndw-media-card-text">
          {item.link
            ? <a className="ndw-media-title" href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a>
            : <span className="ndw-media-title">{item.title}</span>}
          {subtitle && <span className="ndw-media-sub">{subtitle}</span>}
          {meta}
          {badges}
        </span>
      </span>
      <span className="ndw-media-card-foot">
        <MediaProgress position={position} duration={duration} paused={paused} />
        <span className="ndw-media-times">
          <span>{clock(position)}</span>
          <span>{clock(duration)}</span>
        </span>
      </span>
    </li>
  );
}
