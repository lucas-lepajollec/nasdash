'use client';

import { Search, X } from 'lucide-react';
import { useShellControls } from '@/components/layout/ShellControls';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeWidget } from '../calme';
import type { WidgetViewProps } from '../types';

/**
 * The dashboard search, as a widget. Every search widget shows the same query:
 * typing in one filters the page (widgets whose content does not match step
 * aside, see `src/lib/search/match.ts`) and updates the others.
 */
export default function PageSearchView({ editMode }: WidgetViewProps) {
  const { t } = useI18n();
  const { searchQuery, setSearchQuery } = useShellControls();
  return (
    <CalmeWidget title={t('widget.page-search.name')} editMode={editMode} bare hideTitle>
      <div className="nd-hw">
        <div className="nd-search nd-hw-search" data-tour="search">
          <Search size={13} className="nd-search-icon" aria-hidden="true" />
          <input
            type="search"
            aria-label={t('Rechercher dans le tableau de bord')}
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            onKeyDown={event => { if (event.key === 'Escape') setSearchQuery(''); }}
            placeholder={t('Rechercher…')}
          />
          {searchQuery && (
            <button type="button" className="nd-hw-search-clear" aria-label={t('Effacer la recherche')} onClick={() => setSearchQuery('')}>
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </CalmeWidget>
  );
}
