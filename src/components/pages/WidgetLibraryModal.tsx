'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, Search, X } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
import { firstFreePlacement, insertWidget, newWidgetInstance, placementProblem, updateWidget } from '@/lib/pages/operations';
import { WIDGET_CATALOG, WIDGET_GROUP_ORDER, type WidgetCatalogEntry } from '@/lib/widgets/catalog';
import { usePages } from '@/providers/PagesProvider';
import { Emoji } from '../shared/Emoji';
import { useVisibleCategories } from '@/hooks/useVisibleCategories';
import { useWidgetName, type LibraryTarget } from './PageView';
import type { WidgetSettings } from '@/lib/pages/types';

/**
 * The widget library: one searchable list. Clicking widgets selects them;
 * "Add" places them all at the first free spots of the page, then shows
 * them. Showing a hidden widget or creating a category acts at once.
 */

/** Scrolls to freshly added widgets (the first one) and highlights them briefly. */
function reveal(...widgetIds: string[]) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    widgetIds.forEach((widgetId, index) => {
      const node = document.querySelector<HTMLElement>(`[data-widget-id="${widgetId}"]`);
      if (!node) return;
      if (index === 0) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.classList.add('nd-page-widget--new');
      setTimeout(() => node.classList.remove('nd-page-widget--new'), 1600);
    });
  }));
}

/** A widget chosen in the library, waiting for "Add". */
interface Pick { key: string; entry: WidgetCatalogEntry; settings: WidgetSettings }

export function WidgetLibraryModal({ target, onClose }: { target: LibraryTarget; onClose: () => void }) {
  const { t } = useI18n();
  const { config, setCategoryModal } = useConfig();
  const { pages, getPage, applyToPage } = usePages();
  const dialogRef = useDialogAccessibility(onClose);
  const page = getPage(target.pageId);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Pick[]>([]);
  const widgetName = useWidgetName();
  const visibleCategories = useVisibleCategories();
  const pagesDocument = useMemo(() => ({ pages: pages.map(candidate => getPage(candidate.id) ?? candidate) }), [getPage, pages]);

  if (!page) return null;
  const normalized = query.trim().toLocaleLowerCase();
  const matches = (text: string) => !normalized || text.toLocaleLowerCase().includes(normalized);

  const isPicked = (key: string) => picked.some(item => item.key === key);
  const toggle = (key: string, entry: WidgetCatalogEntry, settings: WidgetSettings = {}) => {
    setPicked(current => current.some(item => item.key === key) ? current.filter(item => item.key !== key) : [...current, { key, entry, settings }]);
  };

  /** Places every picked widget, one after the other, each at the first spot still free. */
  const addPicked = () => {
    const ids: string[] = [];
    let next = page;
    for (const { entry, settings } of picked) {
      if (placementProblem(pagesDocument, next, entry.type)) continue;
      const widget = newWidgetInstance(entry.type, settings, next);
      next = insertWidget(next, widget);
      ids.push(widget.id);
    }
    if (ids.length) applyToPage(page.id, current => ids.reduce((result, id) => insertWidget(result, next.widgets.find(widget => widget.id === id)!), current));
    onClose();
    reveal(...ids);
  };

  /** Shows a hidden widget again, at the first free spot. */
  const show = (widgetId: string) => {
    applyToPage(page.id, current => {
      const visible = current.widgets.filter(widget => !widget.hidden);
      return updateWidget(current, widgetId, widget => {
        const { hidden: _hidden, ...rest } = widget;
        void _hidden;
        return { ...rest, ...firstFreePlacement(visible, widget.w, widget.h) };
      });
    });
    onClose();
    reveal(widgetId);
  };

  const unavailable = (entry: WidgetCatalogEntry) => (
    placementProblem(pagesDocument, page, entry.type) ? t('pages.library.alreadyPlaced') : null
  );
  /** A widget allowed once can be picked once: a second one of its kind waits until the first is unpicked. */
  const blocked = (key: string, entry: WidgetCatalogEntry) => !isPicked(key) && (!!unavailable(entry)
    || (entry.maxInstances !== undefined && picked.some(item => item.entry.type === entry.type)));


  const categoryEntry = WIDGET_CATALOG.find(entry => entry.type === 'service-category')!;
  const onThisPage = new Set(page.widgets.filter(widget => widget.type === 'service-category').map(widget => widget.settings.categoryId));
  // Secret categories are only offered while secret sections are revealed.
  const categories = visibleCategories
    .filter(category => matches(t(category.title)))
    .sort((a, b) => a.order - b.order);
  const groups = WIDGET_GROUP_ORDER.map(group => ({
    group,
    entries: WIDGET_CATALOG.filter(entry => entry.group === group && entry.type !== 'service-category' && !entry.internal)
      .filter(entry => matches(`${t(entry.nameKey)} ${t(entry.descriptionKey)}`)),
  })).filter(({ entries }) => entries.length > 0);
  const showCategories = categories.length > 0 || !normalized;
  const hidden = page.widgets.filter(widget => widget.hidden && matches(widgetName(widget)));

  return createPortal(
    <div className="nd-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} style={{ zIndex: 100000 }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="nd-library-title" tabIndex={-1} className="nd-modal nd-page-library nd-animate-in">
        <header className="nd-page-library-header">
          <h2 id="nd-library-title">{t('pages.library.title')}</h2>
          <label className="nd-page-library-search">
            <Search size={14} aria-hidden="true" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('pages.library.search')} aria-label={t('pages.library.search')} autoFocus />
          </label>
          <button type="button" className="nd-page-icon-button" onClick={onClose} aria-label={t('Fermer')}><X size={16} /></button>
        </header>

        <div className="nd-page-library-body">
          {hidden.length > 0 && (
            <section className="nd-page-library-section">
              <h3>{t('pages.library.hiddenTitle')}</h3>
              <div className="nd-page-library-grid">
                {hidden.map(widget => (
                  <button key={widget.id} type="button" className="nd-page-library-card" onClick={() => show(widget.id)}>
                    <span className="nd-page-library-card-icon"><Emoji emoji={WIDGET_CATALOG.find(entry => entry.type === widget.type)?.icon ?? '🧩'} /></span>
                    <span className="nd-page-library-card-text">
                      <strong>{widgetName(widget)}</strong>
                      <span>{t('pages.widget.show')}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {showCategories && (
            <section className="nd-page-library-section">
              <h3>{t('pages.library.categoriesTitle')}</h3>
              <div className="nd-page-library-grid">
                {categories.map(category => (
                  <button key={category.id} type="button" className={`nd-page-library-card ${isPicked(`category:${category.id}`) ? 'is-picked' : ''}`} aria-pressed={isPicked(`category:${category.id}`)} disabled={blocked(`category:${category.id}`, categoryEntry)} onClick={() => toggle(`category:${category.id}`, categoryEntry, { categoryId: category.id })}>
                    <span className="nd-page-library-card-icon"><Emoji emoji={category.emoji} /></span>
                    {isPicked(`category:${category.id}`) && <span className="nd-page-library-check" aria-hidden="true"><Check size={12} /></span>}
                    <span className="nd-page-library-card-text">
                      <strong>{t(category.title)}{category.isSecret && <span className="ndc-tag" style={{ marginLeft: 6 }}>{t('pages.library.secret')}</span>}</strong>
                      <span>{onThisPage.has(category.id) ? t('pages.library.onThisPage') : t('pages.library.serviceCount', { count: category.services.length })}</span>
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className="nd-page-library-card nd-page-library-card--new"
                  onClick={() => {
                    setCategoryModal({ open: true, placement: { pageId: page.id } });
                    onClose();
                  }}
                >
                  <span className="nd-page-library-card-icon"><Plus size={18} /></span>
                  <span className="nd-page-library-card-text">
                    <strong>{t('pages.library.newCategory')}</strong>
                    <span>{t('pages.library.newCategoryHint')}</span>
                  </span>
                </button>
              </div>
            </section>
          )}

          {groups.map(({ group, entries }) => (
            <section key={group} className="nd-page-library-section">
              <h3>{t(`pages.library.group.${group}`)}</h3>
              <div className="nd-page-library-grid">
                {entries.map(entry => {
                  const problem = unavailable(entry);
                  return (
                    <button key={entry.type} type="button" className={`nd-page-library-card ${isPicked(entry.type) ? 'is-picked' : ''}`} aria-pressed={isPicked(entry.type)} disabled={blocked(entry.type, entry)} onClick={() => toggle(entry.type, entry)}>
                      <span className="nd-page-library-card-icon"><Emoji emoji={entry.icon} /></span>
                      {isPicked(entry.type) && <span className="nd-page-library-check" aria-hidden="true"><Check size={12} /></span>}
                      <span className="nd-page-library-card-text">
                        <strong>{t(entry.nameKey)}{entry.experimental && <span className="nd-page-library-badge">{t('pages.library.experimental')}</span>}</strong>
                        <span>{problem ?? t(entry.descriptionKey)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {!showCategories && groups.length === 0 && hidden.length === 0 && (
            <p className="nd-page-library-empty">{t('pages.library.noResult')}</p>
          )}
        </div>

        <footer className="nd-page-library-footer">
          <span className="nd-page-library-footer-text">{picked.length ? t('pages.library.picked', { count: picked.length }) : t('pages.library.pickHint')}</span>
          {picked.length > 0 && <button type="button" className="nd-btn" onClick={() => setPicked([])}>{t('pages.library.clear')}</button>}
          <button type="button" className="nd-btn nd-btn-accent" disabled={!picked.length} onClick={addPicked}>{picked.length > 1 ? t('pages.library.addMany', { count: picked.length }) : t('pages.library.add')}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
