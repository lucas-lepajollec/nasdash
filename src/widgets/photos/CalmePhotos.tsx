'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Play, X } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { Photo, PhotosResponse } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { demoFetch } from '@/lib/demoTransport';
import { CalmeField } from '@/components/shared/CalmeDialog';
import CustomSelect from '@/components/shared/CustomSelect';
import { CalmeRow, CalmeSegmented, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import { DialogPortal } from '@/widgets/devices/ColorDialog';
import { CalmeWidget } from '../calme';
import { bounded, chartHeight, DataError, pick, useBoxWidth, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { chosenConnection, ConnectionPicker } from '@/components/widgets/content/ConnectionPicker';
import { packMosaic, wantedSpan } from './mosaic';

export type PhotosDisplay = 'slideshow' | 'grid' | 'mosaic' | 'strip';
const DISPLAYS: readonly PhotosDisplay[] = ['slideshow', 'grid', 'mosaic', 'strip'];
export type PhotosMode = 'random' | 'recent' | 'favorites' | 'album' | 'memories';
const MODES: readonly PhotosMode[] = ['random', 'recent', 'favorites', 'album', 'memories'];
/** Slideshow pace, in seconds. */
const INTERVALS = ['10', '30', '60', '300'] as const;
const TYPES = ['immich', 'photoprism'] as const;

/** Random selections change once an hour, the same for every screen in that hour. */
const hourSeed = () => String(Math.floor(Date.now() / 3_600_000));

/**
 * Photos from an Immich or PhotoPrism library connected in Settings →
 * Integrations: a slideshow, a grid, a mosaic or a strip. Photos come through
 * the NasDash server (no address or key reaches the browser). A click opens
 * the photo large, with its date, place and a link to the library.
 */
export default function CalmePhotos({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const connection = chosenConnection(config?.integrations, TYPES, settings.integrationId);
  const display = pick(settings.display, DISPLAYS, 'slideshow');
  const [seed, setSeed] = useState(hourSeed);
  const { data, error, mutate } = useWidgetData<PhotosResponse>('/api/widgets/photos', widgetId, settings, {
    refreshMs: 30 * 60_000, isVisible, method: 'GET', params: { seed }, enabled: !!connection,
  });
  useEffect(() => {
    if (!isVisible) return;
    const timer = window.setInterval(() => setSeed(hourSeed()), 60_000);
    return () => window.clearInterval(timer);
  }, [isVisible]);
  const [ref, width] = useBoxWidth<HTMLDivElement>();
  const [open, setOpen] = useState<number | null>(null);
  const title = t('widget.photos.name');
  const photos = data?.photos ?? [];

  return (
    <CalmeWidget title={title} editMode={editMode}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} width={600} shared={{ tab: 'widget-photos', label: t('widgets.photos.manage') }}>
          {(draft, change) => <PhotosSettings draft={draft} change={change} />}
        </WidgetSettingsButton>
      )}
      <div ref={ref} className="ndw-photos-box">
        {!connection ? (settings.integrationId ? <div className="ndc-empty ndc-empty--error">{t('widgets.dns.connectionGone')}</div> : <SetupGuide kind="photos" />)
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: chartHeight(width, 0.6, 140, 360) }} /></div>
              : photos.length === 0 ? <div className="ndc-empty">{t('widgets.photos.none')}</div>
                : <PhotosBody photos={photos} display={display} settings={settings} width={width} visible={isVisible} onOpen={setOpen} />}
      </div>
      {open !== null && photos[open] && (
        <PhotoViewer photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} provider={data?.provider} />
      )}
    </CalmeWidget>
  );
}

function usePhotoText() {
  const { locale } = useI18n();
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }), [locale]);
  return (photo: Photo) => [photo.takenAt ? date.format(photo.takenAt) : undefined, photo.place].filter(Boolean).join(' · ');
}

/** Photos shown at once by a display; the slideshow one, the strip all of them. */
function perViewOf(display: PhotosDisplay, settings: WidgetSettings): number {
  return display === 'slideshow' ? 1 : bounded(settings.perPage, 2, 24, display === 'mosaic' ? 7 : 8);
}

/**
 * Which photos of the loaded selection are on screen. With "change by
 * itself" (always on for random photos) the next ones come in every
 * interval, pausing while the pointer is over the widget; otherwise arrows
 * move through them. The selection wraps around, so it never stops.
 */
function usePhotoCycle(total: number, step: number, auto: boolean, interval: number, visible: boolean) {
  const [start, setStart] = useState(0);
  const [paused, setPaused] = useState(false);
  // A browser tab in the background loads no new photo.
  const shown = usePageShown();
  const active = visible && shown;
  const current = total ? start % total : 0;
  useEffect(() => {
    if (!auto || !active || paused || total <= step) return;
    const timer = window.setTimeout(() => setStart(value => (value + step) % total), interval * 1000);
    return () => window.clearTimeout(timer);
  }, [auto, active, paused, total, step, interval, start]);
  const move = (direction: 1 | -1) => setStart(value => ((value + direction * step) % total + total) % total);
  const hover = { onPointerEnter: () => setPaused(true), onPointerLeave: () => setPaused(false) };
  return { start: current, move, hover };
}

/** Whether the browser tab is in front. */
function usePageShown(): boolean {
  const [shown, setShown] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const update = () => setShown(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return shown;
}

/** `count` photos from `start`, wrapping to the beginning. */
function windowOf(photos: Photo[], start: number, count: number): { photo: Photo; index: number }[] {
  return Array.from({ length: Math.min(count, photos.length) }, (_, offset) => {
    const index = (start + offset) % photos.length;
    return { photo: photos[index], index };
  });
}

function PhotosBody({ photos, display, settings, width, visible, onOpen }: {
  photos: Photo[]; display: PhotosDisplay; settings: WidgetSettings; width: number; visible: boolean; onOpen: (index: number) => void;
}) {
  const { t } = useI18n();
  const caption = usePhotoText();
  const auto = autoOf(settings);
  const interval = Number(pick(String(settings.interval), INTERVALS, '30'));
  const perView = perViewOf(display, settings);
  const cycle = usePhotoCycle(photos.length, display === 'strip' ? 1 : perView, auto, interval, visible);
  const thumb = (photo: Photo, index: number, className: string, style?: React.CSSProperties) => (
    <button key={photo.id} type="button" className={`ndw-photo ${className}`} style={style} onClick={() => onOpen(index)} title={caption(photo) || undefined} aria-label={caption(photo) || t('widgets.photos.open')}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.thumb} alt="" loading="lazy" decoding="async" />
      {photo.video && <span className="ndw-photo-video" aria-hidden="true"><Play size={12} /></span>}
    </button>
  );
  const pager = photos.length > perView && !auto && (
    <div className="ndw-pager">
      <button type="button" className="ndc-icon-button" onClick={() => cycle.move(-1)} aria-label={t('widgets.photos.previous')} title={t('widgets.photos.previous')}><ChevronLeft size={14} /></button>
      <span className="ndw-pager-count">{t('widgets.grid.page', { current: Math.floor(cycle.start / perView) + 1, total: Math.ceil(photos.length / perView) })}</span>
      <button type="button" className="ndc-icon-button" onClick={() => cycle.move(1)} aria-label={t('widgets.photos.next')} title={t('widgets.photos.next')}><ChevronRight size={14} /></button>
    </div>
  );

  if (display === 'grid' || display === 'mosaic') {
    const shown = windowOf(photos, cycle.start, perView);
    const columns = display === 'mosaic' ? Math.max(2, Math.min(6, Math.round(width / 150))) : 0;
    return (
      <div className="ndw-photo-pages" {...cycle.hover}>
        {/* The key restarts the fade each time other photos come in. */}
        <div key={cycle.start} className={display === 'grid' ? 'ndw-photo-grid' : 'ndw-photo-mosaic'} style={display === 'mosaic' ? { gridTemplateColumns: `repeat(${columns}, 1fr)`, gridAutoRows: Math.max(56, Math.round(width / columns * 0.62)) } : undefined}>
          {display === 'grid'
            ? shown.map(({ photo, index }) => thumb(photo, index, 'is-square'))
            : <Mosaic shown={shown} columns={columns} render={(photo, index, style) => thumb(photo, index, 'is-tile', style)} />}
        </div>
        {pager}
      </div>
    );
  }
  if (display === 'strip') return <Strip photos={photos} start={cycle.start} auto={auto} hover={cycle.hover} render={(photo, index) => thumb(photo, index, 'is-strip')} />;
  return <Slideshow photos={photos} current={cycle.start} onMove={cycle.move} hover={cycle.hover} captions={settings.captions !== false} height={chartHeight(width, 0.62, 140, 520)} onOpen={onOpen} />;
}

/** Mixed sizes (wide, tall, a large one now and then), placed so no hole stays; computed once per page. */
function Mosaic({ shown, columns, render }: { shown: { photo: Photo; index: number }[]; columns: number; render: (photo: Photo, index: number, style: React.CSSProperties) => React.ReactNode }) {
  const shape = shown.map(({ photo }) => `${photo.id}:${photo.width ?? 0}x${photo.height ?? 0}`).join(',');
  const tiles = useMemo(
    () => packMosaic(shown.map(({ photo }, position) => wantedSpan(photo.width && photo.height ? photo.width / photo.height : 1.5, position, columns)), columns),
    // The page's photos and the column count are the whole input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shape, columns],
  );
  return <>{shown.map(({ photo, index }, position) => render(photo, index, { gridRow: `${tiles[position].row + 1} / span ${tiles[position].rows}`, gridColumn: `${tiles[position].column + 1} / span ${tiles[position].columns}` }))}</>;
}

/** Every photo in a sideways row; by itself it slides one photo at a time. */
function Strip({ photos, start, auto, hover, render }: {
  photos: Photo[]; start: number; auto: boolean; hover: { onPointerEnter: () => void; onPointerLeave: () => void }; render: (photo: Photo, index: number) => React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = ref.current;
    if (!auto || !row) return;
    const cell = row.children[start] as HTMLElement | undefined;
    // Back to the beginning once the last photo is in view.
    const left = cell && cell.offsetLeft + row.clientWidth <= row.scrollWidth + cell.offsetWidth ? cell.offsetLeft - row.offsetLeft : 0;
    row.scrollTo({ left: start === 0 ? 0 : left, behavior: 'smooth' });
  }, [auto, start]);
  return <div ref={ref} className="ndw-photo-strip" {...hover}>{photos.map((photo, index) => render(photo, index))}</div>;
}

/** One photo at a time, crossfading; arrows show on hover. */
function Slideshow({ photos, current, onMove, hover, captions, height, onOpen }: {
  photos: Photo[]; current: number; onMove: (direction: 1 | -1) => void; hover: { onPointerEnter: () => void; onPointerLeave: () => void };
  captions: boolean; height: number; onOpen: (index: number) => void;
}) {
  const { t } = useI18n();
  const caption = usePhotoText();
  // The next photo is fetched ahead, so the fade never shows an empty frame.
  const next = photos[(current + 1) % photos.length];
  const text = caption(photos[current]);
  return (
    <div className="ndw-slideshow" style={{ height }} {...hover}>
      {photos.map((photo, position) => (position === current || photo === next) && (
        <button key={photo.id} type="button" className={`ndw-slide ${position === current ? 'is-current' : ''}`} onClick={() => onOpen(position)} tabIndex={position === current ? 0 : -1} aria-hidden={position !== current} aria-label={text || t('widgets.photos.open')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.preview} alt="" decoding="async" />
        </button>
      ))}
      {captions && text && <span className="ndw-slide-caption">{text}</span>}
      {photos.length > 1 && (
        <>
          <button type="button" className="ndw-slide-arrow is-prev" onClick={() => onMove(-1)} aria-label={t('widgets.photos.previous')} title={t('widgets.photos.previous')}><ChevronLeft size={16} /></button>
          <button type="button" className="ndw-slide-arrow is-next" onClick={() => onMove(1)} aria-label={t('widgets.photos.next')} title={t('widgets.photos.next')}><ChevronRight size={16} /></button>
        </>
      )}
    </div>
  );
}

/** Random photos always change by themselves; other selections when asked. */
function autoOf(settings: WidgetSettings): boolean {
  return settings.mode === undefined || settings.mode === 'random' || settings.auto !== false;
}

/** The photo large: arrows and keyboard move through the selection, Escape closes. */
function PhotoViewer({ photos, index, onIndex, onClose, provider }: { photos: Photo[]; index: number; onIndex: (index: number) => void; onClose: () => void; provider?: string }) {
  const { t } = useI18n();
  const caption = usePhotoText();
  const photo = photos[index];
  const move = (step: number) => onIndex((index + step + photos.length) % photos.length);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  return (
    <DialogPortal onClose={onClose}>
      {ref => (
        <div ref={ref as React.Ref<HTMLDivElement>} className="ndw-viewer" role="dialog" aria-modal="true" aria-label={caption(photo) || t('widget.photos.name')} tabIndex={-1}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ndw-viewer-image" src={photo.preview} alt={caption(photo)} />
          <div className="ndw-viewer-bar">
            <span className="ndw-viewer-text">{caption(photo)}<span className="ndw-viewer-count">{index + 1} / {photos.length}</span></span>
            <span className="ndw-viewer-tools">
              {photo.link && <a className="nd-btn nd-btn-compact" href={photo.link} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} />{t('widgets.photos.openIn', { name: provider === 'photoprism' ? 'PhotoPrism' : 'Immich' })}</a>}
              {photos.length > 1 && <button type="button" className="ndc-icon-button" onClick={() => move(-1)} aria-label={t('widgets.photos.previous')} title={t('widgets.photos.previous')}><ChevronLeft size={16} /></button>}
              {photos.length > 1 && <button type="button" className="ndc-icon-button" onClick={() => move(1)} aria-label={t('widgets.photos.next')} title={t('widgets.photos.next')}><ChevronRight size={16} /></button>}
              <button type="button" className="ndc-icon-button" onClick={onClose} aria-label={t('Fermer')} title={t('Fermer')}><X size={16} /></button>
            </span>
          </div>
        </div>
      )}
    </DialogPortal>
  );
}

function PhotosSettings({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const display = pick(draft.display, DISPLAYS, 'slideshow');
  const mode = pick(draft.mode, MODES, 'random');
  const connection = chosenConnection(config?.integrations, TYPES, draft.integrationId);
  return (
    <>
      <CalmeField label={t('widgets.connection')}>
        <ConnectionPicker types={TYPES} section="photos" value={typeof draft.integrationId === 'string' ? draft.integrationId : undefined} onChange={id => change({ integrationId: id, albumId: null })} />
      </CalmeField>
      <CalmeField label={t('widgets.photos.source')}>
        <CalmeSegmented label={t('widgets.photos.source')} value={mode} options={MODES.map(value => ({ value, label: t(`widgets.photos.mode.${value}`) }))} onChange={value => change({ mode: value })} />
      </CalmeField>
      {mode === 'album' && connection && (
        <CalmeField label={t('widgets.photos.album')}>
          <AlbumSelect integrationId={connection.id} value={typeof draft.albumId === 'string' ? draft.albumId : ''} onChange={id => change({ albumId: id })} />
        </CalmeField>
      )}
      <CalmeRow label={t('widgets.photos.count')}>
        <CalmeSlider label={t('widgets.photos.count')} value={bounded(draft.count, 4, 60, 12)} min={4} max={60} step={1} onChange={value => change({ count: value })} onCommit={value => change({ count: value })} format={String} />
      </CalmeRow>
      <CalmeField label={t('widgets.display')}>
        <CalmeSegmented label={t('widgets.display')} value={display} options={DISPLAYS.map(value => ({ value, label: t(`widgets.photos.display.${value}`) }))} onChange={value => change({ display: value })} />
      </CalmeField>
      {(display === 'grid' || display === 'mosaic') && (
        <CalmeRow label={t('widgets.photos.perPage')}>
          <CalmeSlider label={t('widgets.photos.perPage')} value={perViewOf(display, draft)} min={2} max={24} step={1} onChange={value => change({ perPage: value })} onCommit={value => change({ perPage: value })} format={String} />
        </CalmeRow>
      )}
      <CalmeRow label={t('widgets.photos.auto')} info={t(mode === 'random' ? 'widgets.photos.autoRandom' : 'widgets.photos.autoHint')}>
        <CalmeSwitch label={t('widgets.photos.auto')} checked={autoOf(draft)} disabled={mode === 'random'} onChange={on => change({ auto: on ? null : false })} />
      </CalmeRow>
      {autoOf(draft) && (
        <CalmeField label={t('widgets.photos.interval')}>
          <CalmeSegmented label={t('widgets.photos.interval')} value={pick(String(draft.interval), INTERVALS, '30')} options={INTERVALS.map(value => ({ value, label: t(`widgets.photos.interval.${value}`) }))} onChange={value => change({ interval: Number(value) })} />
        </CalmeField>
      )}
      {display === 'slideshow' && (
        <CalmeRow label={t('widgets.photos.captions')}>
          <CalmeSwitch label={t('widgets.photos.captions')} checked={draft.captions !== false} onChange={on => change({ captions: on ? null : false })} />
        </CalmeRow>
      )}
    </>
  );
}

/** Albums of the chosen library, asked to the server (administrators only). */
function AlbumSelect({ integrationId, value, onChange }: { integrationId: string; value: string; onChange: (id: string) => void }) {
  const { t } = useI18n();
  const [albums, setAlbums] = useState<{ id: string; name: string; count?: number }[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setAlbums(null); setFailed(false);
    demoFetch(`/api/widgets/photos/albums?${new URLSearchParams({ integrationId })}`)
      .then(async response => {
        if (!response.ok) throw new Error();
        const payload = await response.json() as { albums: { id: string; name: string; count?: number }[] };
        if (!cancelled) setAlbums(payload.albums);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [integrationId]);
  if (failed) return <p className="ndw-note ndw-down">{t('widgets.photos.albumsFailed')}</p>;
  if (!albums) return <p className="ndw-note">{t('widgets.photos.albumsLoading')}</p>;
  if (albums.length === 0) return <p className="ndw-note">{t('widgets.photos.noAlbum')}</p>;
  return (
    <CustomSelect
      ariaLabel={t('widgets.photos.album')}
      value={albums.some(album => album.id === value) ? value : ''}
      onChange={onChange}
      options={[...(albums.some(album => album.id === value) ? [] : [{ value: '', label: t('widgets.photos.albumChoose') }]), ...albums.map(album => ({ value: album.id, label: album.count === undefined ? album.name : `${album.name} (${album.count})` }))]}
    />
  );
}

