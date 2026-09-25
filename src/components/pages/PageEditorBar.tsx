'use client';

import React, { useEffect, useState } from 'react';
import { Check, Loader2, Plus, Redo2, Undo2, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { usePages } from '@/providers/PagesProvider';
import ConfirmModal from '../modals/ConfirmModal';

/**
 * Floating bar shown while building pages. Layout changes are drafts until
 * "Save"; undo/redo also respond to Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or +Y).
 */
export function PageEditorBar({ onAddWidget }: { onAddWidget: () => void }) {
  const { t } = useI18n();
  const {
    editing, undo, redo, canUndo, canRedo, dirty, saving, saveError, conflict, resolveConflict,
    finishEditing, cancelEditing,
  } = usePages();
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, redo, undo]);

  if (!editing) return null;

  return (
    <>
      <div className="nd-page-editor-bar" role="toolbar" aria-label={t('pages.editor.toolbar')}>
        <span className="nd-page-editor-status" aria-live="polite">
          <span className={`nd-page-editor-dot ${dirty ? 'is-dirty' : ''}`} aria-hidden="true" />
          {saving ? t('pages.editor.saving') : dirty ? t('pages.editor.unsaved') : t('pages.editor.editing')}
        </span>
        <div className="nd-page-editor-group">
          <button type="button" className="nd-page-icon-button" onClick={undo} disabled={!canUndo || saving} title={t('pages.editor.undo')} aria-label={t('pages.editor.undo')}>
            <Undo2 size={15} />
          </button>
          <button type="button" className="nd-page-icon-button" onClick={redo} disabled={!canRedo || saving} title={t('pages.editor.redo')} aria-label={t('pages.editor.redo')}>
            <Redo2 size={15} />
          </button>
        </div>
        <button type="button" className="nd-btn nd-page-editor-add" onClick={onAddWidget} disabled={saving}>
          <Plus size={14} /> <span>{t('pages.editor.addWidget')}</span>
        </button>
        <div className="nd-page-editor-group">
          <button type="button" className="nd-btn" onClick={() => (dirty ? setConfirmCancel(true) : cancelEditing())} disabled={saving}>
            <X size={14} /> <span>{t('Annuler')}</span>
          </button>
          <button type="button" className="nd-btn nd-btn-accent" onClick={() => void finishEditing()} disabled={saving}>
            {saving ? <Loader2 size={14} className="nd-spin" /> : <Check size={14} />} <span>{dirty ? t('pages.editor.save') : t('pages.editor.done')}</span>
          </button>
        </div>
      </div>
      {(saveError || conflict) && (
        <div className="nd-page-editor-alert" role="alert">
          <span>{conflict ? t('pages.editor.conflict') : t('pages.editor.saveFailed', { error: t(saveError ?? '') })}</span>
          {conflict && (
            <span className="nd-page-editor-alert-actions">
              <button type="button" className="nd-btn" onClick={() => void resolveConflict('reload')}>{t('pages.editor.conflictReload')}</button>
              <button type="button" className="nd-btn nd-btn-accent" onClick={() => void resolveConflict('overwrite')}>{t('pages.editor.conflictKeep')}</button>
            </span>
          )}
        </div>
      )}
      <ConfirmModal
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => { setConfirmCancel(false); cancelEditing(); }}
        title={t('pages.editor.discardTitle')}
        description={t('pages.editor.discardDescription')}
        confirmLabel={t('pages.editor.discard')}
        cancelLabel={t('pages.editor.keepEditing')}
      />
    </>
  );
}
