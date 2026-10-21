'use client';

import React from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import { MUSIC_SERVER_TYPES, type MusicAlbum } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import { chosenConnection, ConnectionPicker } from '@/components/widgets/content/ConnectionPicker';
import { MediaPoster } from '@/components/widgets/media/shared';
import { musicPlayer, PlayButton, useCanPlay } from './player';

/** The music server a widget reads: its choice, else the first saved one (Jellyfin, Emby, Plex, Navidrome). */
export function useMusicConnection(settings: WidgetSettings) {
  const { config } = useConfig();
  return chosenConnection(config?.integrations, MUSIC_SERVER_TYPES, settings.integrationId);
}

export function MusicSetup({ settings }: { settings: WidgetSettings }) {
  const { t } = useI18n();
  return settings.integrationId ? <div className="ndc-empty ndc-empty--error">{t('widgets.dns.connectionGone')}</div> : <SetupGuide kind="media" />;
}

export function MusicServerField({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <CalmeField label={t('widgets.music.server')}>
      <ConnectionPicker types={MUSIC_SERVER_TYPES} section="media" value={typeof draft.integrationId === 'string' ? draft.integrationId : undefined} onChange={id => change({ integrationId: id })} />
    </CalmeField>
  );
}

/** A square cover (the media poster in its album shape). */
export function Cover({ id, title, cover, size }: { id: string; title: string; cover?: string; size: number }) {
  return <MediaPoster item={{ id, kind: 'album', title, poster: cover }} width={size} />;
}

/** An album as a cover with its title, artist and one more line beneath; a play button over the cover for signed-in users. */
export function AlbumCard({ album, line, widgetId }: { album: MusicAlbum; line?: string; widgetId?: string }) {
  const { t } = useI18n();
  const canPlay = useCanPlay();
  const body = (
    <>
      <span className="ndw-music-cover">
        <Cover id={album.id} title={album.title} cover={album.cover} size={240} />
        {canPlay && widgetId && <span className="ndw-music-cover-play"><PlayButton size="large" label={t('widgets.music.playOne', { name: album.title })} playingKey={`album:${album.id}`} onPlay={() => void musicPlayer.playCollection(widgetId, 'album', album.id)} /></span>}
      </span>
      <span className="ndw-mx-rail-title">{album.title}</span>
      {album.artist && <span className="ndw-mx-rail-sub">{album.artist}</span>}
      {line && <span className="ndw-mx-rail-sub is-quiet">{line}</span>}
    </>
  );
  return album.link
    ? <a className="ndw-mx-rail-item" href={album.link} target="_blank" rel="noopener noreferrer" title={album.title}>{body}</a>
    : <span className="ndw-mx-rail-item" title={album.title}>{body}</span>;
}
