'use client';

import { Eye, EyeOff, LogIn, LogOut, Pencil, Settings, User } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { useShellControls } from '@/components/layout/ShellControls';
import { CalmeWidget } from '../calme';
import type { WidgetViewProps } from '../types';
import { HeaderWidgetSettings, readAlign } from '../page-menu/HeaderWidgetDialog';

/**
 * The dashboard buttons, as a widget: hide sensitive information, edit mode
 * and settings (administrators), then the account (or sign in). Required on
 * every page, like the menu, so they can never be lost.
 */
export default function PageActionsView({ instance, editMode, onUpdateSettings }: WidgetViewProps) {
  const { t } = useI18n();
  const { user, logout } = useConfig();
  const shell = useShellControls();
  const align = readAlign(instance.settings, 'end');
  const title = t('widget.page-actions.name');
  const isAdmin = user?.role === 'admin';
  return (
    <CalmeWidget title={title} editMode={editMode} bare hideTitle>
      {editMode && <HeaderWidgetSettings kind="actions" title={title} settings={instance.settings} fallbackAlign="end" onSave={onUpdateSettings} />}
      <div className={`nd-hw nd-hw--${align} nd-hw-actions`}>
        <button
          type="button"
          data-tour="privacy"
          className={`nd-btn ${!shell.showSensitive ? 'nd-btn-active' : ''}`}
          onClick={shell.toggleSensitive}
          title={shell.showSensitive ? t('Masquer les infos') : t('Afficher les infos')}
          aria-label={shell.showSensitive ? t('Masquer les infos') : t('Afficher les infos')}
          aria-pressed={!shell.showSensitive}
        >
          {shell.showSensitive ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
        </button>
        {isAdmin && (
          <>
            <button
              type="button"
              data-tour="edit"
              className={`nd-btn ${shell.editMode ? 'nd-btn-active' : ''}`}
              onClick={shell.toggleEdit}
              title={t('Mode édition')}
              aria-label={t('Mode édition')}
              aria-pressed={shell.editMode}
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              data-settings-trigger="true"
              data-tour="settings"
              className="nd-btn"
              onClick={event => shell.openSettings(event.currentTarget)}
              title={t('Paramètres globaux')}
              aria-label={t('Paramètres globaux')}
            >
              <Settings size={14} aria-hidden="true" />
            </button>
          </>
        )}
        <span className="nd-hw-divider" aria-hidden="true" />
        {user && !user.isAnonymous ? (
          <span className="nd-hw-account">
            <span className="nd-hw-user">
              <User size={13} aria-hidden="true" />
              <span className="nd-hw-user-name">{user.username}</span>
            </span>
            <button type="button" className="nd-btn nd-hw-logout" onClick={() => logout()} title={t('Se déconnecter')} aria-label={t('Se déconnecter')}>
              <LogOut size={14} aria-hidden="true" />
            </button>
          </span>
        ) : (
          <a href="/login" className="nd-btn nd-hw-login" title={t('Se connecter')} aria-label={t('Se connecter')}>
            <LogIn size={14} aria-hidden="true" />
          </a>
        )}
      </div>
    </CalmeWidget>
  );
}
