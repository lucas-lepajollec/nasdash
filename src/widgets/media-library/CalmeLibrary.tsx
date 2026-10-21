'use client';

import React, { useMemo, useState } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MediaCounts, MediaLibrary, MediaLibraryResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeDialog, CalmeField, CalmeCheckRow } from '@/components/shared/CalmeDialog';
import { DialogPortal } from '@/widgets/devices/ColorDialog';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { DataError, pick, useBoxWidth, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { Backdrop, Figure } from '@/components/widgets/media/visual';
import { MediaConnectionField, MediaSetup, useMediaConnection } from '@/components/widgets/media/shared';

type Count = keyof MediaCounts;
const COUNTS: readonly Count[] = ['movies', 'series', 'episodes', 'artists', 'albums', 'tracks', 'books'];

/**
 * What a Jellyfin, Emby or Plex server holds: the totals large, then each
 * library: the ones with pictures as a card of their newest posters (or a
 * picture chosen for their kind), music and books as text, each with what
 * arrived this week.
 */
export default function CalmeLibrary({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t, locale } = useI18n();
  const connection = useMediaConnection(settings);
  const { data, error, mutate, stale } = useWidgetData<MediaLibraryResponse>('/api/widgets/media/library', widgetId, settings, { refreshMs: 15 * 60_000, isVisible, method: 'GET', enabled: !!connection });
  const [box, width] = useBoxWidth<HTMLDivElement>();
  const number = useMemo(() => ({ full: new Intl.NumberFormat(locale), short: new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }) }), [locale]);
  const title = t('widget.media-library.name');
  const chosen = Array.isArray(settings.counts) ? COUNTS.filter(id => (settings.counts as unknown[]).includes(id)) : [...COUNTS];
  // Zero totals hidden unless the widget keeps them.
  const shown = data ? chosen.filter(id => data.counts[id] !== undefined && (settings.zeros === true || (data.counts[id] ?? 0) > 0)) : [];
  const own = imagesOf(settings);
  const display = pick(settings.display, LIBRARY_DISPLAYS, 'shelves');
  const libraries = data?.libraries ?? [];
  const pictured = libraries.filter(library => library.kind !== 'music' && library.kind !== 'books' && (library.covers?.length || own[library.kind]));
  const plain = libraries.filter(library => !pictured.includes(library));
  const added = libraries.reduce((sum, library) => sum + (library.added ?? 0), 0);
  const columns = Math.max(1, Math.min(6, Math.floor((width + 14) / { small: 180, medium: 230, large: 300 }[pick(settings.shelf, SHELF_SIZES, 'medium')])));

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data ? <span className="ndc-title-note">{data.name}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-media', label: t('widgets.media.manage') }}>
          {(draft, change) => <LibrarySettings draft={draft} change={change} />}
        </WidgetSettingsButton>
      )}
      <div ref={box} className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <MediaSetup settings={settings} />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 64 }} /><span className="ndw-skeleton-row" style={{ height: 140 }} /></div>
              : (
                <div className="ndw-mx-stack">
                  <div className="ndw-mx-figures is-wrap">
                    {shown.map(id => <Figure key={id} size="large" value={number.full.format(data.counts[id] ?? 0)} unit={t(`widgets.media.count.${id}`)} />)}
                    {added > 0 && <span className="ndw-mx-figures-end"><span className="ndw-mx-meta">{t('widgets.media.addedWeek', { count: added })}</span></span>}
                  </div>
                  {display === 'shelves' && pictured.length > 0 && (
                    <div className={`ndw-mx-shelves is-${pick(settings.shelf, SHELF_SIZES, 'medium')}`} style={{ '--ndw-cols': Math.min(columns, pictured.length) } as React.CSSProperties}>
                      {pictured.map((library, index) => <Shelf key={library.name} library={library} own={own[library.kind]} offset={index * 4000} active={isVisible} number={number.full} />)}
                    </div>
                  )}
                  {(display === 'text' ? libraries : plain).length > 0 && (
                    <div className="ndw-mx-plain" style={{ '--ndw-cols': Math.max(1, Math.min(2, Math.floor((width + 14) / 360))) } as React.CSSProperties}>
                      {(display === 'text' ? libraries : plain).map(library => <PlainLibrary key={library.name} library={library} number={number.full} />)}
                    </div>
                  )}
                </div>
              )}
      </div>
    </CalmeWidget>
  );
}

/** "2 732 episodes", "+8 this week": the details of one library. */
function useDetail() {
  const { t } = useI18n();
  return (library: MediaLibrary, number: Intl.NumberFormat) => [
    library.episodes !== undefined ? `${number.format(library.episodes)} ${t('widgets.media.count.episodes')}` : '',
    library.added ? t('widgets.media.addedShort', { count: library.added }) : '',
  ].filter(Boolean).join(' · ');
}

/** A library with pictures: three of its posters fanned out over a blur of the middle one, crossfading as they turn. */
function Shelf({ library, own, offset, active, number }: { library: MediaLibrary; own?: string; offset: number; active: boolean; number: Intl.NumberFormat }) {
  const detail = useDetail();
  const covers = library.covers ?? [];
  const shift = useRotation(covers.length, offset, active);
  const trioAt = (at: number) => covers.length >= 3 ? [0, 1, 2].map(step => covers[(at + step) % covers.length]) : covers.slice(0, 1);
  // The previous trio stays beneath while the new one fades in over it.
  const [layers, setLayers] = useState<{ shift: number; previous?: number }>({ shift });
  if (layers.shift !== shift) setLayers({ shift, previous: layers.shift });
  const trio = trioAt(shift), before = layers.previous === undefined ? undefined : trioAt(layers.previous);
  const middle = (list: string[]) => list[list.length === 3 ? 1 : 0];
  React.useEffect(() => {
    // Warm the next pictures so the next turn fades instead of popping.
    if (covers.length > 3) for (const url of trioAt(shift + 1)) { const image = new Image(); image.src = url; }
  });
  return (
    <div className="ndw-mx-shelf">
      {own ? <Backdrop src={own} /> : (
        <>
          {before && <Backdrop key={`b-${layers.previous}`} src={middle(before)} blur className="is-under" />}
          {trio.length > 0 && <Backdrop key={`b-${shift}`} src={middle(trio)} blur />}
        </>
      )}
      {!own && trio.length > 0 && (
        <span className="ndw-mx-fan" aria-hidden="true">
          {before && <Fan key={`f-${layers.previous}`} urls={before} under />}
          <Fan key={`f-${shift}`} urls={trio} />
        </span>
      )}
      <span className="ndw-mx-shelf-foot">
        <span className="ndw-media-row-text">
          <span className="ndw-mx-title">{library.name}</span>
          <span className="ndw-media-sub">{detail(library, number)}</span>
        </span>
        {library.count !== undefined && <span className="ndw-mx-shelf-count">{number.format(library.count)}</span>}
      </span>
    </div>
  );
}

/** One fanned trio; faded in once its pictures have loaded. */
function Fan({ urls, under }: { urls: string[]; under?: boolean }) {
  const [loaded, setLoaded] = useState(0);
  return (
    <span className={`ndw-mx-fan-set ${under ? 'is-under' : ''} ${loaded >= urls.length ? 'is-loaded' : ''}`}>
      {urls.map((url, position) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${url}-${position}`} className={`is-${urls.length === 3 ? position : 1}`} src={url} alt="" decoding="async" onLoad={() => setLoaded(value => value + 1)} onError={() => setLoaded(value => value + 1)} />
      ))}
    </span>
  );
}

/** Music, books, or any library shown as text: its figures in a row. */
function PlainLibrary({ library, number }: { library: MediaLibrary; number: Intl.NumberFormat }) {
  const { t } = useI18n();
  const figures: [string, number | undefined][] = library.kind === 'music'
    ? [['artists', library.count], ['albums', library.albums], ['tracks', library.tracks]]
    : [[library.kind === 'books' ? 'books' : library.kind === 'series' ? 'series' : 'movies', library.count], ['episodes', library.episodes]];
  return (
    <div className="ndw-mx-plain-item">
      <span className="ndw-media-row-text">
        <span className="ndw-mx-title">{library.name}</span>
        <span className="ndw-media-sub">{library.added ? t('widgets.media.addedShort', { count: library.added }) : t('widgets.media.nothingThisWeek')}</span>
      </span>
      <span className="ndw-mx-figures">
        {figures.filter(([, value]) => value !== undefined).map(([id, value]) => <Figure key={id} size="medium" label={t(`widgets.media.count.${id}`)} value={number.format(value!)} />)}
      </span>
    </div>
  );
}

type ShelfId = 'movies' | 'series' | 'music' | 'books';
const SHELF_IDS: readonly ShelfId[] = ['movies', 'series', 'music', 'books'];
const COVERS = ['random', 'newest', 'none'] as const;
const SHELF_SIZES = ['small', 'medium', 'large'] as const;
const LIBRARY_DISPLAYS = ['shelves', 'text'] as const;
/** Each picture stays this long before the next fades in. */
const ROTATE_MS = 12_000;

/** Which picture leads now: moves on every 12 s; `offset` staggers libraries so they never change together. */
function useRotation(count: number, offset: number, active: boolean): number {
  const [index, setIndex] = useState(0);
  React.useEffect(() => {
    if (!active || count < 2) return;
    let timer = window.setTimeout(function next() {
      setIndex(value => value + 1);
      timer = window.setTimeout(next, ROTATE_MS);
    }, ROTATE_MS + offset);
    return () => window.clearTimeout(timer);
  }, [active, offset, count]);
  return count ? index % count : 0;
}
/** Uploaded pictures only (this NasDash's own files). */
const OWN_IMAGE = /^\/api\/logos\/[A-Za-z0-9._-]+$/;

/** Pictures chosen per shelf in the widget's settings. */
function imagesOf(settings: WidgetSettings): Partial<Record<string, string>> {
  const value = settings.images;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => (SHELF_IDS as readonly string[]).includes(entry[0]) && typeof entry[1] === 'string' && OWN_IMAGE.test(entry[1])));
}

function LibrarySettings({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  const current = Array.isArray(draft.counts) ? COUNTS.filter(id => (draft.counts as unknown[]).includes(id)) : null;
  const images = imagesOf(draft);
  const [picking, setPicking] = useState<ShelfId | null>(null);
  return (
    <>
      <MediaConnectionField draft={draft} change={change} />
      <CalmeField label={t('widgets.display')}>
        <CalmeSegmented label={t('widgets.display')} value={pick(draft.display, LIBRARY_DISPLAYS, 'shelves')} options={LIBRARY_DISPLAYS.map(value => ({ value, label: t(`widgets.media.library.${value}`) }))} onChange={value => change({ display: value === 'shelves' ? null : value })} />
      </CalmeField>
      <CalmeField label={t('widgets.media.cover')} info={t('widgets.media.coverHint')}>
        <CalmeSegmented label={t('widgets.media.cover')} value={pick(draft.cover, COVERS, 'random')} options={COVERS.map(value => ({ value, label: t(`widgets.media.cover.${value}`) }))} onChange={value => change({ cover: value === 'random' ? null : value })} />
      </CalmeField>
      <CalmeField label={t('widgets.media.shelfSize')}>
        <CalmeSegmented label={t('widgets.media.shelfSize')} value={pick(draft.shelf, SHELF_SIZES, 'medium')} options={SHELF_SIZES.map(value => ({ value, label: t(`widgets.media.size.${value}`) }))} onChange={value => change({ shelf: value === 'medium' ? null : value })} />
      </CalmeField>
      <CalmeField label={t('widgets.media.ownImages')} info={t('widgets.media.ownImagesHint')}>
        <div className="ndw-media-shelf-picks">
          {SHELF_IDS.map(id => (
            <span key={id} className="ndw-media-shelf-pick">
              <button type="button" className="ndw-media-shelf-thumb" onClick={() => setPicking(id)} aria-label={t('widgets.media.chooseImage', { shelf: t(`widgets.media.shelf.${id}`) })}>
                {images[id]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={images[id]} alt="" />
                  : <ImagePlus size={15} aria-hidden="true" />}
              </button>
              <span className="ndw-media-shelf-pick-name">{t(`widgets.media.shelf.${id}`)}</span>
              {images[id] && <button type="button" className="ndc-icon-button" onClick={() => change({ images: { ...images, [id]: null } as WidgetSettings[string] })} aria-label={t('widgets.media.autoImage')} title={t('widgets.media.autoImage')}><X size={12} /></button>}
            </span>
          ))}
        </div>
      </CalmeField>
      <CalmeField label={t('widgets.media.counts')}>
        <div className="ndc-dlg-stack">
          {COUNTS.map(id => (
            <CalmeCheckRow key={id} checked={current ? current.includes(id) : true} onChange={() => {
              const base = current ?? [...COUNTS];
              const next = base.includes(id) ? base.filter(item => item !== id) : COUNTS.filter(item => item === id || base.includes(item));
              change({ counts: next.length === COUNTS.length ? null : next });
            }}>
              <span className="ndc-dlg-name">{t(`widgets.media.count.${id}`)}</span>
            </CalmeCheckRow>
          ))}
        </div>
      </CalmeField>
      <CalmeRow label={t('widgets.media.hideZeros')} info={t('widgets.media.hideZerosHint')}>
        <CalmeSwitch label={t('widgets.media.hideZeros')} checked={draft.zeros !== true} onChange={on => change({ zeros: on ? null : true })} />
      </CalmeRow>
      {picking && <ImagePicker title={t('widgets.media.chooseImage', { shelf: t(`widgets.media.shelf.${picking}`) })} current={images[picking]} onClose={() => setPicking(null)} onPick={url => { change({ images: { ...images, [picking]: url } as WidgetSettings[string] }); setPicking(null); }} />}
    </>
  );
}

/** This NasDash's pictures (wallpapers, then uploaded images), or a new upload. */
function ImagePicker({ title, current, onClose, onPick }: { title: string; current?: string; onClose: () => void; onPick: (url: string) => void }) {
  const { t } = useI18n();
  const [files, setFiles] = useState<{ name: string; url: string }[] | null>(null);
  const [failed, setFailed] = useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const load = React.useCallback(async () => {
    try {
      const [backgrounds, logos] = await Promise.all(['/api/logos?type=background', '/api/logos'].map(async url => ((await (await fetch(url)).json()) as { files?: { name: string; url: string }[] }).files ?? []));
      setFiles([...backgrounds, ...logos]);
    } catch { setFailed(true); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('type', 'background');
    const response = await fetch('/api/upload', { method: 'POST', body: form }).catch(() => null);
    if (!response?.ok) { setFailed(true); return; }
    const saved = await response.json().catch(() => null) as { url?: string } | null;
    if (saved?.url && OWN_IMAGE.test(saved.url)) onPick(saved.url); else void load();
  };
  return (
    <DialogPortal onClose={onClose}>
      {ref => (
        <CalmeDialog dialogRef={ref} label={title} title={title} onClose={onClose} width={620}
          footer={<>
            <button type="button" className="nd-btn" onClick={() => input.current?.click()}><Upload size={13} />{t('widgets.media.uploadImage')}</button>
            <button type="button" className="nd-btn" onClick={onClose}>{t('Annuler')}</button>
          </>}>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
          {failed ? <p className="ndw-note ndw-down">{t('widgets.media.imagesFailed')}</p>
            : !files ? <p className="ndw-note">{t('widgets.media.imagesLoading')}</p>
              : files.length === 0 ? <p className="ndw-note">{t('widgets.media.noImages')}</p>
                : (
                  <div className="ndw-media-image-grid">
                    {files.filter(file => OWN_IMAGE.test(file.url)).map(file => (
                      <button key={file.url} type="button" className={`ndw-media-image-choice ${file.url === current ? 'is-current' : ''}`} onClick={() => onPick(file.url)} title={file.name}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={file.url} alt={file.name} loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
        </CalmeDialog>
      )}
    </DialogPortal>
  );
}
