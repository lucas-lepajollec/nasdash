'use client';

import React, { useState } from 'react';
import { Disc3, Film, Tv } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { MEDIA_SERVER_TYPES, type MediaItem } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import { hueOf } from '@/components/widgets/content/kit';
import { chosenConnection, ConnectionPicker } from '@/components/widgets/content/ConnectionPicker';

/** The media server a widget reads: its choice, else the first saved one. */
export function useMediaConnection(settings: WidgetSettings) {
  const { config } = useConfig();
  return chosenConnection(config?.integrations, MEDIA_SERVER_TYPES, settings.integrationId);
}

/** What a media widget shows before it has a server. */
export function MediaSetup({ settings }: { settings: WidgetSettings }) {
  const { t } = useI18n();
  return settings.integrationId ? <div className="ndc-empty ndc-empty--error">{t('widgets.dns.connectionGone')}</div> : <SetupGuide kind="media" />;
}

export function MediaConnectionField({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <CalmeField label={t('widgets.media.server')}>
      <ConnectionPicker types={MEDIA_SERVER_TYPES} section="media" value={typeof draft.integrationId === 'string' ? draft.integrationId : undefined} onChange={id => change({ integrationId: id })} />
    </CalmeField>
  );
}

/** "S2 · E5" for an episode, the year for a movie, the artist for an album. */
export function useMediaLine() {
  const { t } = useI18n();
  return (item: MediaItem): string => {
    if (item.kind === 'episode') {
      const code = item.season !== undefined && item.episode !== undefined ? t('widgets.media.episodeCode', { season: item.season, episode: item.episode }) : '';
      return [item.subtitle, code].filter(Boolean).join(' · ');
    }
    if (item.kind === 'movie') return item.year ? String(item.year) : '';
    return item.subtitle ?? (item.year ? String(item.year) : '');
  };
}

/** "1:02:03" or "12:03". */
export function clock(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms)) return '';
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

const KIND_ICON = { movie: Film, episode: Tv, series: Tv, album: Disc3, track: Disc3, video: Film, other: Film } as const;

/**
 * A poster (2:3, or square for music), loaded lazily; while it loads or
 * when the server has none, a tinted tile with the kind's icon and the
 * title's first letter.
 */
export function MediaPoster({ item, width, className = '', eager, frame }: { item: MediaItem; width: number; className?: string; eager?: boolean; frame?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const square = item.kind === 'album' || item.kind === 'track';
  // In a row of posters, square covers sit in the same 2:3 frame, over a blur of themselves.
  const framed = frame && square;
  const Icon = KIND_ICON[item.kind] ?? Film;
  const source = item.poster && failed !== item.poster ? item.poster : null;
  return (
    <span
      className={`ndw-media-poster ${square && !framed ? 'is-square' : ''} ${framed ? 'is-framed' : ''} ${source && loaded === source ? 'is-loaded' : ''} ${className}`}
      style={{ width, '--ndw-hue': hueOf(item.subtitle || item.title) } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className="ndw-media-poster-fallback"><Icon size={Math.round(width / 4)} /><span>{(item.title.trim()[0] ?? '?').toUpperCase()}</span></span>
      {source && framed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ndw-media-poster-blur" src={source} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" />
      )}
      {source && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={framed ? 'ndw-media-poster-cover' : undefined} src={source} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={() => setLoaded(source)} onError={() => setFailed(source)} />
      )}
    </span>
  );
}

/** A thin progress line; `indeterminate` while the position is unknown. */
export function MediaProgress({ position, duration, paused }: { position?: number; duration?: number; paused?: boolean }) {
  const share = position !== undefined && duration ? Math.min(100, Math.max(0, (position / duration) * 100)) : undefined;
  return (
    <span className={`ndw-media-progress ${paused ? 'is-paused' : ''}`} aria-hidden="true">
      <span style={{ width: `${share ?? 0}%` }} />
    </span>
  );
}
