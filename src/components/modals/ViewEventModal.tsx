import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeDialog } from '@/components/shared/CalmeDialog';

export default function ViewEventModal() {
  const { t, locale } = useI18n();
  const { viewEventModal, setViewEventModal } = useConfig();
  const viewEvent = viewEventModal.event;
  const closeModal = () => setViewEventModal({ open: false });
  const dialogRef = useDialogAccessibility(closeModal, Boolean(viewEventModal.open && viewEvent));

  if (!viewEventModal.open || !viewEvent) return null;

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <CalmeDialog
        dialogRef={dialogRef}
        label={t(viewEvent.title)}
        title={t(viewEvent.title)}
        subtitle={<span style={{ textTransform: 'capitalize' }}>
          {viewEvent.start ? new Date(viewEvent.start).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
          {!viewEvent.isAllDay && viewEvent.start && t('event.atTime', { time: new Date(viewEvent.start).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}
          {viewEvent.isAllDay && t("(Toute la journée)")}
        </span>}
        width={400}
        onClose={closeModal}
        footer={<button type="button" className="nd-btn" onClick={closeModal}>{t("Fermer")}</button>}
      >
        {viewEvent.description
          ? <p className="ndc-dialog-hint" style={{ whiteSpace: 'pre-wrap', color: 'var(--nd-text)' }}>{t(viewEvent.description)}</p>
          : <p className="ndc-dialog-hint">{t('calendar.calme.noDescription')}</p>}
      </CalmeDialog>
    </div>
  );
}
