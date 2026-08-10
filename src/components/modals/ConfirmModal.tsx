import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';

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
  confirmLabel = 'Supprimer',
  cancelLabel = 'Annuler'
}: ConfirmModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useDialogAccessibility(onClose, isOpen);

  if (!isOpen) return null;

  return createPortal(
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ zIndex: 99999 }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="nd-modal nd-animate-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 400, textAlign: 'center', padding: '32px 24px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ 
            width: 48, height: 48, borderRadius: '50%', 
            background: 'rgba(239, 68, 68, 0.1)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            color: 'var(--nd-red)', flexShrink: 0 
          }}>
            <AlertTriangle size={24} />
          </div>
        </div>

        <h2 id={titleId} className="nd-modal-title" style={{ margin: '0 0 8px 0', fontSize: '1.25rem', lineHeight: 1.2 }}>{title}</h2>

        {description && (
          <p id={descriptionId} style={{ color: 'var(--nd-text-muted)', fontSize: '0.95rem', marginBottom: 32, lineHeight: 1.5 }}>
            {description}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="nd-btn" onClick={onClose} style={{ padding: '0 24px' }}>
            {cancelLabel}
          </button>
          <button
            className="nd-btn"
            style={{ padding: '0 24px', background: 'var(--nd-red)', borderColor: 'var(--nd-red)', color: '#fff', fontWeight: 600 }}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
