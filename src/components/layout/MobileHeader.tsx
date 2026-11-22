'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Search, X } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import type { TabDef } from '@/hooks/useTabs';
import { useI18n } from '@/i18n/I18nProvider';
import { MobileMenuSheet } from './MobileMenuSheet';
import { useShellControls } from './ShellControls';

/**
 * The phone header (screens up to 960 px; larger screens use the header
 * widgets of each page): the page's name in large type, then round glass
 * buttons for the search and the menu. It is the same on every page and has
 * no settings. The search is the dashboard's one search, shared with the
 * search widgets.
 */
export function MobileHeader({ pageTabs }: {
  /** Pages offered in the menu: the visible ones, in dock order. */
  pageTabs: TabDef[];
}) {
  const { t } = useI18n();
  const { config, user, logout } = useConfig();
  const shell = useShellControls();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  // A search in progress keeps the field open.
  const searchOpen = searching || shell.searchQuery !== '';
  useEffect(() => {
    if (searching) field.current?.focus();
  }, [searching]);
  const activeTab = shell.tabs.find(tab => tab.id === shell.activeTab);
  const close = () => { shell.setSearchQuery(''); setSearching(false); };

  return (
    <header className="nd-header nd-mhead">
      {searchOpen ? (
        <>
          <div className="nd-search">
            <Search size={17} className="nd-search-icon" aria-hidden="true" />
            <input
              ref={field}
              type="text"
              aria-label={t('Rechercher dans le tableau de bord')}
              value={shell.searchQuery}
              onChange={event => shell.setSearchQuery(event.target.value)}
              onKeyDown={event => { if (event.key === 'Escape') close(); }}
              placeholder={t('Rechercher…')}
            />
            {shell.searchQuery && (
              <button type="button" className="nd-mhead-clear" aria-label={t('Effacer la recherche')} onClick={() => { shell.setSearchQuery(''); field.current?.focus(); }}>
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          <button type="button" className="nd-mhead-cancel" onClick={close}>{t('Annuler')}</button>
        </>
      ) : (
        <>
          <p className="nd-mhead-title">{activeTab ? t(activeTab.name) : ''}</p>
          <div className="nd-mhead-actions">
            <button type="button" className="nd-glass nd-mhead-button" aria-label={t('mobile.search')} onClick={() => setSearching(true)}>
              <Search size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              data-tour="menu"
              className="nd-glass nd-mhead-button"
              aria-label={menuOpen ? t('Fermer le menu') : t('Ouvrir le menu')}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(open => !open)}
            >
              <MoreHorizontal size={18} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
      {menuOpen && (
        <MobileMenuSheet
          onClose={() => setMenuOpen(false)}
          tabs={pageTabs}
          activeTab={shell.activeTab}
          tabIcons={config?.settings?.tabIcons}
          onSwitchTab={shell.switchTab}
          isAdmin={user?.role === 'admin'}
          editMode={shell.editMode}
          onToggleEdit={shell.toggleEdit}
          onOpenSettings={shell.openSettings}
          secretMode={shell.showSensitive}
          onToggleSecret={shell.toggleSensitive}
          username={user && !user.isAnonymous ? user.username : undefined}
          onLogout={() => logout()}
          demo={config?.demoMode === true}
        />
      )}
    </header>
  );
}
