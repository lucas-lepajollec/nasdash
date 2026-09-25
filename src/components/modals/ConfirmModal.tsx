import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
}: ConfirmModalProps) {
  const { t } = useI18n();
  const resolvedConfirmLabel = confirmLabel ?? t('Supprimer');
  const resolvedCancelLabel = cancelLabel ?? t('Annuler');
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useDialogAccessibility(onClose, isOpen);

  if (!isOpen) return null;

  // Calme: a plain dialog, left aligned, the destructive action in red.
  return createPortal(
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ zIndex: 99999 }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1} className="nd-modal ndc-confirm nd-animate-in" onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId} style={{ margin: 0 }}>{title}</h2>
        {description && <p id={descriptionId} className="ndc-confirm-text">{description}</p>}
        <div className="ndc-confirm-actions">
          <button type="button" className="nd-btn" onClick={onClose}>{resolvedCancelLabel}</button>
          <button type="button" className="nd-btn ndc-btn-danger" onClick={() => { onConfirm(); onClose(); }}>{resolvedConfirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
