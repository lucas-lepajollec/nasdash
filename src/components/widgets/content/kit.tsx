'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight, Pencil, Settings2 } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { demoFetch } from '@/lib/demoTransport';
import { useAuth } from '@/providers/AuthProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSlider } from '@/components/modals/settings/shared/CalmeControls';
import { WidgetHeaderActions } from '@/components/widgets/WidgetHeaderActions';
import { DialogPortal } from '@/widgets/devices/ColorDialog';
import { useOpenSettings } from '@/components/integrations/useOpenSettings';

/**
 * Shared pieces of the content widgets (RSS, markets, quotes, DNS, photos,
 * bookmarks): their data hook, their settings dialog, relative times and the
 * site icon with its letter fallback. Contracts: `src/lib/widgetData/contracts.ts`.
 */

/** A failed data request, with the server's translation key. */
export class WidgetDataError extends Error {
  constructor(readonly key: string, readonly status: number, readonly parameters?: Record<string, string | number>) {
    super(key);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as (T & { error?: string; parameters?: Record<string, string | number> }) | null;
  if (!response.ok || !payload) throw new WidgetDataError(payload?.error || 'widgets.error.network', response.status, payload?.parameters);
  return payload;
}

/**
 * Data of one widget instance. The server reads the widget's saved settings;
 * an admin also sends the current ones, so changes show before the page is
 * saved (and in the public demo, whose pages live in the browser). Refreshes
 * every `refreshMs` while visible, never while hidden.
 */
export function useWidgetData<T>(route: string, widgetId: string, settings: WidgetSettings, options: { refreshMs: number; isVisible?: boolean; method?: 'GET' | 'POST'; params?: Record<string, string>; body?: Record<string, unknown>; enabled?: boolean }) {
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  const method = options.method ?? 'POST';
  const draft = admin ? settings : undefined;
  const draftKey = useMemo(() => (draft ? JSON.stringify(draft) : ''), [draft]);
  const paramsKey = JSON.stringify(options.params ?? {});
  const bodyKey = JSON.stringify(options.body ?? {});
  const key = options.enabled === false ? null : [route, widgetId, method, draftKey, paramsKey, bodyKey];
  return useSWR<T, WidgetDataError>(key, async () => {
    if (method === 'GET') {
      const query = new URLSearchParams({ widgetId, ...(options.params ?? {}) });
      if (draftKey) query.set('draft', draftKey);
      return readJson<T>(await demoFetch(`${route}?${query}`));
    }
    return readJson<T>(await demoFetch(route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetId, ...(draft ? { draft } : {}), ...(options.body ?? {}) }),
    }));
  }, {
    refreshInterval: options.isVisible === false ? 0 : options.refreshMs,
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 5_000,
    errorRetryCount: 2,
  });
}

/** "3 min", "2 h", "5 d": the age of a date, short, in the interface language. */
export function useRelativeTime() {
  const { locale } = useI18n();
  const format = useMemo(() => new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' }), [locale]);
  return (time: number | undefined, now = Date.now()) => {
    if (!time) return '';
    const seconds = Math.round((time - now) / 1000);
    const abs = Math.abs(seconds);
    if (abs < 60) return format.format(Math.round(seconds), 'second');
    if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute');
    if (abs < 86_400) return format.format(Math.round(seconds / 3600), 'hour');
    if (abs < 86_400 * 30) return format.format(Math.round(seconds / 86_400), 'day');
    if (abs < 86_400 * 365) return format.format(Math.round(seconds / (86_400 * 30)), 'month');
    return format.format(Math.round(seconds / (86_400 * 365)), 'year');
  };
}

/** The ✎ of a content widget in edit mode, and its dialog (nothing saved until "Save"). */
export function WidgetSettingsButton({ title, settings, onSave, width = 560, shared, children }: {
  title: string;
  settings: WidgetSettings;
  onSave: (settings: WidgetSettings) => void;
  width?: number;
  /** The widget type's shared settings (sources, connections), linked from the dialog. */
  shared?: { tab: string; label: string };
  children: (draft: WidgetSettings, change: (patch: WidgetSettings) => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <WidgetHeaderActions>
      <button type="button" className="nd-action-icon accent" onClick={event => { event.stopPropagation(); setOpen(true); }} title={title} aria-label={title}>
        <Pencil size={13} />
      </button>
      {open && <SettingsDialog title={title} settings={settings} width={width} onSave={onSave} shared={shared} onClose={() => setOpen(false)}>{children}</SettingsDialog>}
    </WidgetHeaderActions>
  );
}

function SettingsDialog({ title, settings, width, onSave, onClose, shared, children }: {
  title: string; settings: WidgetSettings; width: number; onSave: (settings: WidgetSettings) => void; onClose: () => void; shared?: { tab: string; label: string };
  children: (draft: WidgetSettings, change: (patch: WidgetSettings) => void) => React.ReactNode;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<WidgetSettings>(settings);
  const change = (patch: WidgetSettings) => setDraft(current => ({ ...current, ...patch }));
  return (
    <DialogPortal onClose={onClose}>
      {ref => (
        <CalmeDialog
          className="ndw-settings"
          dialogRef={ref}
          label={title}
          title={title}
          onClose={onClose}
          width={width}
          start={shared && <WidgetSettingsLink tab={shared.tab} label={shared.label} onOpen={onClose} />}
          footer={<>
            <button type="button" className="nd-btn" onClick={onClose}>{t('Annuler')}</button>
            <button type="button" className="nd-btn nd-btn-accent" onClick={() => { onSave(draft); onClose(); }}>{t('Enregistrer')}</button>
          </>}
        >
          <CloseWidgetDialog.Provider value={onClose}>{children(draft, change)}</CloseWidgetDialog.Provider>
        </CalmeDialog>
      )}
    </DialogPortal>
  );
}

/** Closes the widget dialog around a control, before it opens the settings elsewhere. */
export const CloseWidgetDialog = React.createContext<(() => void) | null>(null);

/**
 * From a widget's own dialog to its type's shared settings (the quotes,
 * the watchlist, the feeds…): the dialog closes, the settings open there.
 */
export function WidgetSettingsLink({ tab, label, onOpen }: { tab: string; label: string; onOpen?: () => void }) {
  const { openWidgetSettings } = useOpenSettings();
  return (
    <button type="button" className="nd-btn" onClick={() => { onOpen?.(); openWidgetSettings(tab); }}>
      <Settings2 size={13} />{label}
    </button>
  );
}

/** Hue (0–360) of a text: the same name always gets the same letter-tile colour. */
export function hueOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

/**
 * A site's own icon (fetched once by the server, then cached), or its first
 * letter on a tinted tile while it loads or when the site has none.
 */
export function SiteIcon({ url, name, widget, size = 18, className = '' }: { url?: string; name: string; widget?: { id: string; type: 'rss' | 'bookmarks' }; size?: number; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  // The server serves icons of a widget's saved sources; without a widget, of the
  // saved bookmarks (administrators, in the library settings).
  const source = url && /^https?:\/\//i.test(url) ? `/api/widgets/favicon?${new URLSearchParams({ url, ...(widget ? { widgetId: widget.id, type: widget.type } : { type: 'bookmarks' }) })}` : null;
  const letter = (name.trim()[0] ?? '?').toUpperCase();
  const style = { width: size, height: size, '--ndw-hue': hueOf(name || url || '?') } as React.CSSProperties;
  return (
    <span className={`ndw-site-icon ${className} ${source && failed !== source && loaded === source ? 'is-image' : ''}`} style={style} aria-hidden="true">
      {(!source || failed === source || loaded !== source) && <span className="ndw-site-letter" style={{ fontSize: Math.max(9, size * 0.5) }}>{letter}</span>}
      {source && failed !== source && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(source)} onError={() => setFailed(source)} style={loaded === source ? undefined : { position: 'absolute', opacity: 0 }} />
      )}
    </span>
  );
}

/** Message of a data error, translated, with a retry for transient failures. */
export function DataError({ error, onRetry }: { error: WidgetDataError | Error; onRetry?: () => void }) {
  const { t } = useI18n();
  const key = error instanceof WidgetDataError ? error.key : 'widgets.error.network';
  return (
    <div className="ndc-empty ndc-empty--error" role="status">
      <span>{t(key, error instanceof WidgetDataError ? error.parameters : undefined)}</span>
      {onRetry && <button type="button" className="nd-btn" onClick={onRetry}>{t('Réessayer')}</button>}
    </div>
  );
}

/** Settings value read as one of `allowed`, else `fallback`. */
export function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

/** Settings value read as an integer in [min, max], else `fallback`. */
export function bounded(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

/**
 * Width of an element, kept current as its block is resized: content widgets
 * size their charts and switch layouts from it (a stretched widget shows a
 * bigger chart, a wide one puts parts side by side).
 */
export function useBoxWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = useState(0);
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(entries => setWidth(Math.round(entries[0]?.contentRect.width ?? 0)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** A chart height that grows with its block's width, within bounds. */
export function chartHeight(width: number, ratio: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, width * ratio)));
}

/** Style choices of a content widget, each shown as a small sample in its own look. */
export function StylePicker<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly { value: T; name: string; sample: React.ReactNode; className?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="ndw-style-picker" role="radiogroup" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`ndw-style-option ${option.className ?? ''}`}
          onClick={() => onChange(option.value)}
        >
          <span className="ndw-style-sample" aria-hidden="true">{option.sample}</span>
          <span className="ndw-style-name">{option.name}</span>
        </button>
      ))}
    </div>
  );
}

export type GridMode = 'pages' | 'scroll';
export const GRID_MODES: readonly GridMode[] = ['pages', 'scroll'];
export const PER_PAGE_MIN = 2;
export const PER_PAGE_MAX = 24;

/**
 * Cards or tiles of a content widget: a grid shown page by page (arrows and
 * "2 / 3" under it), or a row that scrolls sideways and ends with a
 * "show more" that brings the next page in. Columns follow the block width.
 */
export function PagedGrid({ items, perPage, mode, minColumn, label }: {
  items: React.ReactNode[];
  perPage: number;
  mode: GridMode;
  /** Smallest card width (px) before a column is dropped. */
  minColumn: number;
  label: string;
}) {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const [shown, setShown] = useState(perPage);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  // A shorter list or another page size: never stay on a page that no longer exists.
  const current = Math.min(page, pages - 1);
  const style = { '--ndw-col': `${minColumn}px` } as React.CSSProperties;

  if (mode === 'scroll') {
    const visible = Math.max(shown, perPage);
    return (
      <div className="ndw-scroll-row" style={style} role="list" aria-label={label}>
        {items.slice(0, visible).map((item, index) => <div key={index} role="listitem" className="ndw-scroll-cell">{item}</div>)}
        {visible < items.length && (
          <button type="button" className="nd-btn nd-btn-compact ndw-scroll-more" onClick={() => setShown(visible + perPage)}>
            {t('widgets.grid.more', { count: Math.min(perPage, items.length - visible) })}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="ndw-paged" style={style}>
      <div className="ndw-paged-grid" role="list" aria-label={label}>
        {items.slice(current * perPage, current * perPage + perPage).map((item, index) => <div key={index} role="listitem" className="ndw-paged-cell">{item}</div>)}
      </div>
      {pages > 1 && (
        <div className="ndw-pager">
          <button type="button" className="ndc-icon-button" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label={t('widgets.grid.previous')} title={t('widgets.grid.previous')}><ChevronLeft size={14} /></button>
          <span className="ndw-pager-count">{t('widgets.grid.page', { current: current + 1, total: pages })}</span>
          <button type="button" className="ndc-icon-button" disabled={current === pages - 1} onClick={() => setPage(current + 1)} aria-label={t('widgets.grid.next')} title={t('widgets.grid.next')}><ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
}

/** Layout and page size of a paged grid, for a widget's dialog. */
export function PagedGridSettings({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <>
      <CalmeField label={t('widgets.grid.mode')} info={t('widgets.grid.modeHint')}>
        <CalmeSegmented label={t('widgets.grid.mode')} value={pick(draft.gridMode, GRID_MODES, 'pages')} options={GRID_MODES.map(value => ({ value, label: t(`widgets.grid.mode.${value}`) }))} onChange={value => change({ gridMode: value === 'pages' ? null : value })} />
      </CalmeField>
      <CalmeRow label={t('widgets.grid.perPage')}>
        <CalmeSlider label={t('widgets.grid.perPage')} value={perPageOf(draft)} min={PER_PAGE_MIN} max={PER_PAGE_MAX} step={1} onChange={value => change({ perPage: value })} onCommit={value => change({ perPage: value })} format={String} />
      </CalmeRow>
    </>
  );
}

export function perPageOf(settings: WidgetSettings): number {
  return bounded(settings.perPage, PER_PAGE_MIN, PER_PAGE_MAX, 8);
}

/**
 * Which saved sources a widget shows (feeds, symbols): all of them (new ones
 * appear by themselves), or a selection made of compact chips that scroll
 * past a few rows. `null` means all.
 */
export function SourceChoice({ label, items, value, onChange }: {
  label: string;
  items: readonly { id: string; name: string; detail?: string }[];
  value: unknown;
  onChange: (ids: string[] | null) => void;
}) {
  const { t } = useI18n();
  const selection = Array.isArray(value);
  const chosen = selection ? items.filter(item => (value as unknown[]).includes(item.id)).map(item => item.id) : items.map(item => item.id);
  const toggle = (id: string) => onChange(items.filter(item => (item.id === id) !== chosen.includes(item.id)).map(item => item.id));
  return (
    <div className="ndw-symbol-choice">
      <CalmeSegmented
        label={label}
        value={selection ? 'some' : 'all'}
        options={[{ value: 'all', label: t('widgets.sources.all', { count: items.length }) }, { value: 'some', label: t('widgets.sources.some') }]}
        onChange={next => onChange(next === 'all' ? null : chosen)}
      />
      {selection && (
        <div className="ndw-symbol-chips" role="group" aria-label={label}>
          {items.map(item => (
            <button key={item.id} type="button" aria-pressed={chosen.includes(item.id)} className="ndw-symbol-chip" onClick={() => toggle(item.id)} title={[item.name, item.detail].filter(Boolean).join(' · ')}>
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
