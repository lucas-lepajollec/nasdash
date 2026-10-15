import React, { useId, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
import { Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** A second, quieter way through (delete a folder with its content…), between cancel and confirm. */
  alternative?: { label: string; onConfirm: () => void | Promise<void> };
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  alternative,
}: ConfirmModalProps) {
  const { t } = useI18n();
  const resolvedConfirmLabel = confirmLabel ?? t('Supprimer');
  const resolvedCancelLabel = cancelLabel ?? t('Annuler');
  const titleId = useId();
  const descriptionId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!isOpen) setError(''); }, [isOpen]);
  const close = () => { if (!pending) onClose(); };
  const dialogRef = useDialogAccessibility(close, isOpen);
  const confirm = async (action: () => void | Promise<void> = onConfirm) => {
    if (pending) return;
    setPending(true); setError('');
    try { await action(); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('errors.dockerAction')); }
    finally { setPending(false); }
  };

  if (!isOpen) return null;

  // Calme: a plain dialog, left aligned, the destructive action in red.
  return createPortal(
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }} style={{ zIndex: 99999 }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1} className="nd-modal ndc-confirm nd-animate-in" onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId} style={{ margin: 0 }}>{title}</h2>
        {description && <p id={descriptionId} className="ndc-confirm-text">{description}</p>}
        {error && <p role="alert" className="ndc-dialog-hint" style={{ color: 'var(--nd-red)' }}>{error}</p>}
        <div className="ndc-confirm-actions">
          <button type="button" className="nd-btn" disabled={pending} onClick={close}>{resolvedCancelLabel}</button>
          {alternative && <button type="button" className="nd-btn" disabled={pending} onClick={() => { void confirm(alternative.onConfirm); }}>{alternative.label}</button>}
          <button type="button" className="nd-btn ndc-btn-danger" disabled={pending} aria-busy={pending} onClick={() => { void confirm(); }}>{pending && <Loader2 size={14} className="nd-spin" aria-hidden="true" />}{resolvedConfirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
