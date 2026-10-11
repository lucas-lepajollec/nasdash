import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeDialog } from '@/components/shared/CalmeDialog';
import ConfirmModal from './ConfirmModal';
import { eventFormDate, eventStartDate } from '@/widgets/calendar/eventDates';

export default function ViewEventModal() {
  const { t, locale } = useI18n();
  const { viewEventModal, setViewEventModal, setCalendarEventModal, config, user, deleteLocalEvent } = useConfig();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const viewEvent = viewEventModal.event;
  const localEvent = user?.role === 'admin' ? config?.localEvents?.find(event => event.id === viewEvent?.id) : undefined;
  const closeModal = () => {
    if (pending) return;
    setConfirmDelete(false);
    setError('');
    setViewEventModal({ open: false });
  };
  const dialogRef = useDialogAccessibility(closeModal, Boolean(viewEventModal.open && viewEvent));

  if (!viewEventModal.open || !viewEvent) return null;

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <CalmeDialog
        dialogRef={dialogRef}
        label={t(viewEvent.title)}
        title={t(viewEvent.title)}
        subtitle={<span style={{ textTransform: 'capitalize' }}>
          {eventStartDate(viewEvent)?.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }) ?? ''}
          {!viewEvent.isAllDay && viewEvent.start && t('event.atTime', { time: new Date(viewEvent.start).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}
          {viewEvent.isAllDay && t("(Toute la journée)")}
        </span>}
        width={400}
        onClose={closeModal}
        danger={localEvent && <button type="button" className="nd-btn ndc-btn-danger" disabled={pending} onClick={() => setConfirmDelete(true)}>{t('Supprimer')}</button>}
        footer={<>
          {localEvent && <>
            <button type="button" className="nd-btn nd-btn-accent" disabled={pending} onClick={() => {
              closeModal();
              setCalendarEventModal({ open: true, date: eventFormDate(localEvent), event: localEvent });
            }}>{t('Modifier')}</button>
          </>}
          <button type="button" className="nd-btn" disabled={pending} onClick={closeModal}>{t("Fermer")}</button>
        </>}
      >
        {error && <p role="alert" className="ndc-dialog-hint">{error}</p>}
        {viewEvent.description
          ? <p className="ndc-dialog-hint" style={{ whiteSpace: 'pre-wrap', color: 'var(--nd-text)' }}>{t(viewEvent.description)}</p>
          : <p className="ndc-dialog-hint">{t('calendar.calme.noDescription')}</p>}
      </CalmeDialog>
      <ConfirmModal
        isOpen={confirmDelete && Boolean(localEvent)}
        title={t("Supprimer l'événement")}
        description={t("Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible.")}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!localEvent || pending) return;
          setPending(true);
          setError('');
          void deleteLocalEvent(localEvent.id).then(() => {
            setViewEventModal({ open: false });
          }).catch(() => setError(t('calendar.deleteError'))).finally(() => setPending(false));
        }}
      />
    </div>
  );
}
