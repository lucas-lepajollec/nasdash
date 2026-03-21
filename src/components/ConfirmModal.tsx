import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="nd-modal-overlay" onClick={onClose} style={{ zIndex: 99999 }}>
      <div className="nd-modal nd-animate-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center', padding: '32px 24px' }}>
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

        <h2 className="nd-modal-title" style={{ margin: '0 0 8px 0', fontSize: '1.25rem', lineHeight: 1.2 }}>{title}</h2>

        {description && (
          <p style={{ color: 'var(--nd-text-muted)', fontSize: '0.95rem', marginBottom: 32, lineHeight: 1.5 }}>
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
