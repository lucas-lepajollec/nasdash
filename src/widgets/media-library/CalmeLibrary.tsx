'use client';

import React, { useMemo, useState } from 'react';
import { BookOpen, Clapperboard, Disc3, Film, ImagePlus, Mic2, Music, Tv, Upload, X } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { MediaCounts, MediaLibraryResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeDialog, CalmeField, CalmeCheckRow } from '@/components/shared/CalmeDialog';
import { DialogPortal } from '@/widgets/devices/ColorDialog';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { DataError, pick, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { MediaConnectionField, MediaSetup, useMediaConnection } from '@/components/widgets/media/shared';

type Count = keyof MediaCounts;
const COUNTS: readonly Count[] = ['movies', 'series', 'episodes', 'artists', 'albums', 'tracks', 'books'];
const ICONS: Record<Count, typeof Film> = { movies: Film, series: Tv, episodes: Clapperboard, artists: Mic2, albums: Disc3, tracks: Music, books: BookOpen };
const LIBRARY_ICONS = { movies: Film, series: Tv, music: Music, books: BookOpen, other: Clapperboard } as const;
/** One tile per shelf: its main total large, the others beneath, over the newest title's art. */
const SHELVES: readonly { id: string; counts: Count[]; cover?: string }[] = [
  { id: 'movies', counts: ['movies'], cover: 'movies' },
  { id: 'series', counts: ['series', 'episodes'], cover: 'series' },
  { id: 'music', counts: ['albums', 'artists', 'tracks'], cover: 'music' },
  { id: 'books', counts: ['books'] },
];

/**
 * What a Jellyfin, Emby or Plex server holds: movies, series, episodes,
 * music, books (the ones it has, or the ones chosen), and its libraries.
 */
export default function CalmeLibrary({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t, locale } = useI18n();
  const connection = useMediaConnection(settings);
  const { data, error, mutate } = useWidgetData<MediaLibraryResponse>('/api/widgets/media/library', widgetId, settings, { refreshMs: 15 * 60_000, isVisible, method: 'GET', enabled: !!connection });
  const number = useMemo(() => ({ full: new Intl.NumberFormat(locale), short: new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }) }), [locale]);
  const title = t('widget.media-library.name');
  const chosen = Array.isArray(settings.counts) ? COUNTS.filter(id => (settings.counts as unknown[]).includes(id)) : [...COUNTS];
  // Zero totals hidden unless the widget keeps them.
  const shown = data ? chosen.filter(id => data.counts[id] !== undefined && (settings.zeros === true || (data.counts[id] ?? 0) > 0)) : [];
  const own = imagesOf(settings);

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data ? <span className="ndc-title-note">{data.name}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-media', label: t('widgets.media.manage') }}>
          {(draft, change) => <LibrarySettings draft={draft} change={change} />}
        </WidgetSettingsButton>
      )}
      <div className="ndw-media-box">
        {!connection ? <MediaSetup settings={settings} />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 64 }} /></div>
              : (
                <>
                  <div className="ndw-media-shelves">
                    {SHELVES.map(shelf => {
                      const ids = shelf.counts.filter(id => shown.includes(id));
                      if (!ids.length) return null;
                      const [main, ...more] = ids;
                      const Icon = ICONS[main];
                      // A picture chosen for the shelf, else the server's (newest or random title).
                      const cover = own[shelf.id] ?? data.covers?.[shelf.cover as keyof NonNullable<MediaLibraryResponse['covers']>];
                      return (
                        <div key={shelf.id} className={`ndw-media-shelf is-${shelf.id} ${cover ? 'has-cover' : ''}`} title={ids.map(id => `${number.full.format(data.counts[id] ?? 0)} ${t(`widgets.media.count.${id}`)}`).join(' · ')}>
                          {cover && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img className="ndw-media-shelf-art" src={cover} alt="" loading="lazy" decoding="async" />
                          )}
                          <span className="ndw-media-shelf-shade" aria-hidden="true" />
                          <span className="ndw-media-shelf-head"><Icon size={14} aria-hidden="true" />{t(`widgets.media.shelf.${shelf.id}`)}</span>
                          <span className="ndw-media-shelf-value">{number.short.format(data.counts[main] ?? 0)}<span className="ndw-media-shelf-unit">{t(`widgets.media.count.${main}`)}</span></span>
                          {more.length > 0 && (
                            <span className="ndw-media-shelf-more">
                              {more.map(id => <span key={id}>{number.short.format(data.counts[id] ?? 0)} {t(`widgets.media.count.${id}`)}</span>)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {settings.libraries === true && data.libraries.length > 0 && (
                    <div className="ndw-media-library-chips">
                      {data.libraries.map(library => {
                        const Icon = LIBRARY_ICONS[library.kind] ?? Clapperboard;
                        return (
                          <span key={library.name} className="ndw-media-library-chip">
                            <Icon size={12} aria-hidden="true" />
                            <span>{library.name}</span>
                            {library.count !== undefined && <span className="ndw-media-library-count">{number.short.format(library.count)}</span>}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
      </div>
    </CalmeWidget>
  );
}

type ShelfId = 'movies' | 'series' | 'music' | 'books';
const SHELF_IDS: readonly ShelfId[] = ['movies', 'series', 'music', 'books'];
const COVERS = ['newest', 'random', 'none'] as const;
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
      <CalmeField label={t('widgets.media.cover')} info={t('widgets.media.coverHint')}>
        <CalmeSegmented label={t('widgets.media.cover')} value={pick(draft.cover, COVERS, 'newest')} options={COVERS.map(value => ({ value, label: t(`widgets.media.cover.${value}`) }))} onChange={value => change({ cover: value === 'newest' ? null : value })} />
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
      <CalmeRow label={t('widgets.media.showLibraries')}>
        <CalmeSwitch label={t('widgets.media.showLibraries')} checked={draft.libraries === true} onChange={on => change({ libraries: on || null })} />
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
