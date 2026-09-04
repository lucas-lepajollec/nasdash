import React from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';

export default function ViewEventModal() {
  const { t, locale } = useI18n();
  const { viewEventModal, setViewEventModal } = useConfig();
  const viewEvent = viewEventModal.event;
  const closeModal = () => setViewEventModal({ open: false });
  const dialogRef = useDialogAccessibility(closeModal, Boolean(viewEventModal.open && viewEvent));

  if (!viewEventModal.open || !viewEvent) return null;

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t(viewEvent.title)} tabIndex={-1} className="nd-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '350px', width: '100%', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--nd-text)', lineHeight: 1.3, paddingRight: '12px', margin: 0 }}>
            {t(viewEvent.title)}
          </h3>
          <button aria-label={t("Fermer")} className="nd-btn" onClick={closeModal} style={{ padding: 8 }}>
            <X size={16} />
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--nd-text-muted)' }}>
            <CalendarIcon size={14} />
            <span style={{ textTransform: 'capitalize' }}>
              {viewEvent.start ? new Date(viewEvent.start).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
              {!viewEvent.isAllDay && viewEvent.start && t('event.atTime', { time: new Date(viewEvent.start).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}
              {viewEvent.isAllDay && t("(Toute la journée)")}
            </span>
          </div>
          
          {viewEvent.description && (
            <div style={{ padding: '12px', background: 'var(--nd-bg)', borderRadius: 'var(--nd-card-radius)', border: '1px solid var(--nd-border)', color: 'var(--nd-text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {t(viewEvent.description)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button className="nd-btn nd-btn-primary" onClick={() => setViewEventModal({ open: false })}>
            {t("Fermer")}
          </button>
        </div>
      </div>
    </div>
  );
}
