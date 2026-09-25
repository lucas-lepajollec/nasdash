'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, X } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
import { firstFreePlacement, insertWidget, newWidgetInstance, placementProblem, updateWidget } from '@/lib/pages/operations';
import { WIDGET_CATALOG, WIDGET_GROUP_ORDER, type WidgetCatalogEntry } from '@/lib/widgets/catalog';
import { usePages } from '@/providers/PagesProvider';
import { Emoji } from '../shared/Emoji';
import { useWidgetName, type LibraryTarget } from './PageView';

/**
 * The widget library: one searchable list. Clicking a widget adds it at the
 * first free spot of the page, then shows it.
 */

/** Scrolls to a freshly added widget and highlights it briefly. */
function reveal(widgetId: string) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const node = document.querySelector<HTMLElement>(`[data-widget-id="${widgetId}"]`);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.add('nd-page-widget--new');
    setTimeout(() => node.classList.remove('nd-page-widget--new'), 1600);
  }));
}

export function WidgetLibraryModal({ target, onClose }: { target: LibraryTarget; onClose: () => void }) {
  const { t } = useI18n();
  const { config, setCategoryModal } = useConfig();
  const { pages, getPage, applyToPage } = usePages();
  const dialogRef = useDialogAccessibility(onClose);
  const page = getPage(target.pageId);
  const [query, setQuery] = useState('');
  const widgetName = useWidgetName();
  const pagesDocument = useMemo(() => ({ pages: pages.map(candidate => getPage(candidate.id) ?? candidate) }), [getPage, pages]);

  if (!page) return null;
  const normalized = query.trim().toLocaleLowerCase();
  const matches = (text: string) => !normalized || text.toLocaleLowerCase().includes(normalized);

  const add = (entry: WidgetCatalogEntry, settings = {}) => {
    if (placementProblem(pagesDocument, page, entry.type)) return;
    const widget = newWidgetInstance(entry.type, settings, page);
    applyToPage(page.id, current => insertWidget(current, widget));
    onClose();
    reveal(widget.id);
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

  const categoryEntry = WIDGET_CATALOG.find(entry => entry.type === 'service-category')!;
  const onThisPage = new Set(page.widgets.filter(widget => widget.type === 'service-category').map(widget => widget.settings.categoryId));
  const categories = (config?.categories ?? [])
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
                  <button key={category.id} type="button" className="nd-page-library-card" disabled={!!unavailable(categoryEntry)} onClick={() => add(categoryEntry, { categoryId: category.id })}>
                    <span className="nd-page-library-card-icon"><Emoji emoji={category.emoji} /></span>
                    <span className="nd-page-library-card-text">
                      <strong>{t(category.title)}</strong>
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
                    <button key={entry.type} type="button" className="nd-page-library-card" disabled={!!problem} onClick={() => add(entry)}>
                      <span className="nd-page-library-card-icon"><Emoji emoji={entry.icon} /></span>
                      <span className="nd-page-library-card-text">
                        <strong>{t(entry.nameKey)}</strong>
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
      </div>
    </div>,
    document.body,
  );
}
