'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, LogIn, LogOut, Pencil, Settings } from 'lucide-react';
import type { TabDef, TabId } from '@/hooks/useTabs';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
import { Emoji } from '../shared/Emoji';

interface MobileMenuSheetProps {
  onClose: () => void;
  tabs: TabDef[];
  activeTab?: TabId;
  tabIcons?: Record<string, string>;
  onSwitchTab?: (id: TabId) => void;
  isAdmin: boolean;
  editMode: boolean;
  onToggleEdit: () => void;
  onOpenSettings: (trigger?: HTMLButtonElement) => void;
  secretMode: boolean;
  onToggleSecret?: () => void;
  username?: string;
  onLogout: () => void;
}

/** Pulling the sheet down this far closes it. */
const CLOSE_DISTANCE = 90;

/** The phone menu: a glass sheet rising from the bottom, with the pages first and the actions below. */
export function MobileMenuSheet(props: MobileMenuSheetProps) {
  const { t } = useI18n();
  const { onClose } = props;
  const dialogRef = useDialogAccessibility(onClose);
  const drag = useRef<{ y: number; dy: number } | null>(null);

  // The page behind stays still while the sheet is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const sheet = dialogRef.current;
    // Pulling down a page list that is scrolled scrolls it back, it does not close.
    const pages = (event.target as HTMLElement).closest('.nd-sheet-pages');
    const scrolled = pages !== null && pages.scrollTop > 0;
    drag.current = sheet && sheet.scrollTop <= 0 && !scrolled ? { y: event.touches[0].clientY, dy: 0 } : null;
  };
  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const sheet = dialogRef.current;
    if (!drag.current || !sheet) return;
    drag.current.dy = Math.max(0, event.touches[0].clientY - drag.current.y);
    sheet.style.transition = 'none';
    sheet.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onTouchEnd = () => {
    const sheet = dialogRef.current;
    const pulled = drag.current?.dy ?? 0;
    drag.current = null;
    if (!sheet) return;
    if (pulled >= CLOSE_DISTANCE) { onClose(); return; }
    sheet.style.transition = '';
    sheet.style.transform = '';
  };

  const sheet = (
    <div className="nd-sheet-layer">
      <div className="nd-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('Menu')}
        tabIndex={-1}
        className="nd-sheet nd-glass"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <button type="button" className="nd-sheet-grabber" aria-label={t('Fermer le menu')} onClick={onClose}>
          <span aria-hidden="true" />
        </button>

        {props.tabs.length > 0 && (
          <>
            <p className="nd-sheet-label">{t('mobile.pages')}</p>
            <div className="nd-sheet-pages">
              {props.tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className="nd-sheet-page"
                  aria-current={tab.id === props.activeTab ? 'page' : undefined}
                  onClick={() => { props.onSwitchTab?.(tab.id); onClose(); }}
                >
                  <span className="nd-sheet-page-icon" aria-hidden="true"><Emoji emoji={props.tabIcons?.[tab.id] || tab.icon} /></span>
                  <span className="nd-sheet-page-name">{t(tab.name)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="nd-sheet-actions">
          {props.isAdmin && (
            <button type="button" className="nd-sheet-action" data-tour="edit" onClick={() => { props.onToggleEdit(); onClose(); }}>
              <Pencil size={18} aria-hidden="true" />
              <span>{props.editMode ? t('mobile.finishEditing') : t('mobile.editPage')}</span>
            </button>
          )}
          <button type="button" className="nd-sheet-action" data-tour="privacy" aria-pressed={!props.secretMode} onClick={props.onToggleSecret}>
            {props.secretMode ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            <span>{props.secretMode ? t('Masquer les infos') : t('Afficher les infos')}</span>
          </button>
          {props.isAdmin && (
            <button
              type="button"
              className="nd-sheet-action"
              data-settings-trigger="true"
              data-tour="settings"
              onClick={(event) => { props.onOpenSettings(event.currentTarget); onClose(); }}
            >
              <Settings size={18} aria-hidden="true" />
              <span>{t('Paramètres')}</span>
            </button>
          )}
          {props.username ? (
            <button type="button" className="nd-sheet-action" onClick={props.onLogout}>
              <LogOut size={18} aria-hidden="true" />
              <span>{t('Se déconnecter')}</span>
              <span className="nd-sheet-action-note">{props.username}</span>
            </button>
          ) : (
            <a className="nd-sheet-action" href="/login">
              <LogIn size={18} aria-hidden="true" />
              <span>{t('Se connecter')}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
