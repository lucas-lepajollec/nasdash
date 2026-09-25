'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeInfo } from '@/components/modals/settings/shared/CalmeControls';

/**
 * A form dialog laid out like the Calme settings: a title (and one short
 * line), fields one under the other with their explanation in an ⓘ, and a
 * footer with the destructive action apart on the left. The caller keeps the
 * overlay, the portal and the dialog accessibility hook.
 */
export function CalmeDialog({ dialogRef, label, title, subtitle, onClose, children, footer, danger, width = 460 }: {
  dialogRef: React.Ref<HTMLDivElement>;
  label: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Main actions, on the right. */
  footer: React.ReactNode;
  /** Destructive action, on the left. */
  danger?: React.ReactNode;
  width?: number;
}) {
  const { t } = useI18n();
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className="nd-modal ndc-dialog nd-animate-in"
      style={{ maxWidth: width }}
      onClick={event => event.stopPropagation()}
    >
      <header className="ndc-dialog-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button type="button" className="ndc-icon-button" onClick={onClose} aria-label={t('Fermer')}><X size={16} /></button>
      </header>
      <div className="ndc-dialog-body">{children}</div>
      <footer className="ndc-dialog-foot">
        {danger ?? <span />}
        <div className="ndc-dialog-actions">{footer}</div>
      </footer>
    </div>
  );
}

/** One field: its label (with an optional ⓘ) above the control. */
export function CalmeField({ label, info, children, htmlFor }: { label: React.ReactNode; info?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="ndc-field-block">
      <label className="ndc-field-label" htmlFor={htmlFor}>{label}{info && <CalmeInfo text={info} />}</label>
      {children}
    </div>
  );
}

/** A check row (checkbox look) for multiple choices in a list. */
export function CalmeCheckRow({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} className="ndc-check-row" onClick={onChange}>
      <span className={`ndc-checkbox ${checked ? 'is-on' : ''}`} aria-hidden="true" />
      {children}
    </button>
  );
}
