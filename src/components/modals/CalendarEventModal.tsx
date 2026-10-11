import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import ConfirmModal from './ConfirmModal';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import { eventFormDate, eventSchedule } from '@/widgets/calendar/eventDates';
import type { CalendarEventModalState } from '@/providers/ModalProvider';
import { CalmeRow, CalmeSwitch } from './settings/shared/CalmeControls';

export default function CalendarEventModal() {
  const { calendarEventModal, user } = useConfig();
  if (!calendarEventModal.open || !calendarEventModal.date || user?.role !== 'admin') return null;
  return <CalendarEventForm key={`${calendarEventModal.event?.id ?? 'new'}-${calendarEventModal.date}`} modal={calendarEventModal} />;
}

function CalendarEventForm({ modal }: { modal: CalendarEventModalState }) {
  const { t, locale } = useI18n();
  const { config, setCalendarEventModal, addLocalEvent, updateLocalEvent, deleteLocalEvent } = useConfig();
  const event = modal.event;
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<string | null>(null);
  const [title, setTitle] = useState(event ? (config?.demoMode ? t(event.title) : event.title) : '');
  const [description, setDescription] = useState(event?.description ? (config?.demoMode ? t(event.description) : event.description) : '');
  const [date, setDate] = useState(event ? eventFormDate(event) : modal.date!);
  const [time, setTime] = useState(event ? new Date(event.start).toTimeString().slice(0, 5) : '12:00');
  const [isAllDay, setIsAllDay] = useState(Boolean(event?.isAllDay));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const closeModal = () => { if (!pending) setCalendarEventModal({ open: false }); };
  const dialogRef = useDialogAccessibility(closeModal);
  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const handleSave = async () => {
    if (!title.trim() || !date || (!isAllDay && !time) || pending) return;
    setPending(true);
    setError('');
    try {
      const updates = { title: title.trim(), description: description.trim(), ...eventSchedule(date, time, isAllDay, event) };
      if (event) await updateLocalEvent(event.id, updates);
      else await addLocalEvent(updates);
      setCalendarEventModal({ open: false });
    } catch {
      setError(t('calendar.saveError'));
    } finally {
      setPending(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    setPending(true);
    setError('');
    try {
      await deleteLocalEvent(id);
      setCalendarEventModal({ open: false });
    } catch {
      setError(t('calendar.deleteError'));
    } finally {
      setPending(false);
      setConfirmDeleteEvent(null);
    }
  };

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <CalmeDialog
        dialogRef={dialogRef}
        label={event ? t("calendar.editEvent") : t("Ajouter un événement")}
        title={event ? t("calendar.editEvent") : t("Ajouter un événement")}
        subtitle={<span style={{ textTransform: 'capitalize' }}>{formattedDate}</span>}
        width={420}
        onClose={closeModal}
        footer={<>
          <button type="button" className="nd-btn" onClick={closeModal}>{t("Annuler")}</button>
          <button type="button" className="nd-btn nd-btn-accent" onClick={handleSave} disabled={pending || !title.trim() || !date || (!isAllDay && !time)}>{t("Enregistrer")}</button>
        </>}
      >
        {error && <p role="alert" className="ndc-dialog-hint">{error}</p>}
        {!event && modal.events && modal.events.length > 0 && (
          <CalmeField label={t("Événements existants")}>
            <div className="ndc-check-list">
              {modal.events.map(ev => {
                const isLocal = config?.localEvents?.some(le => le.id === ev.id);
                return (
                  <div key={ev.id} className="ndc-event-row">
                    <span className="ndc-set-list-sub" style={{ minWidth: 42 }}>{!ev.isAllDay && ev.start ? new Date(ev.start).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}</span>
                    <span className="ndc-sub-name">{t(ev.title)}</span>
                    {isLocal && <button type="button" className="ndc-icon-button" disabled={pending} title={t('calendar.editEvent')} aria-label={t('calendar.editEvent')} onClick={() => {
                      const local = config?.localEvents?.find(item => item.id === ev.id);
                      if (local) setCalendarEventModal({ open: true, date: eventFormDate(local), event: local });
                    }}><Pencil size={13} /></button>}
                    {isLocal && (
                      <button type="button" className="ndc-icon-button ndc-icon-danger" disabled={pending} onClick={(e) => { e.stopPropagation(); setConfirmDeleteEvent(ev.id); }} title={t("Supprimer cet événement")} aria-label={t("Supprimer cet événement")}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </CalmeField>
        )}
        <CalmeField label={t("Titre de l'événement")} htmlFor="event-title">
          <input id="event-title" type="text" className="nd-input" value={title} disabled={pending} onChange={e => setTitle(e.target.value)} placeholder={t("Ex: Réunion d'équipe")} autoFocus />
        </CalmeField>
        <CalmeField label={t('calendar.date')} htmlFor="event-date">
          <input id="event-date" type="date" className="nd-input" value={date} onChange={e => setDate(e.target.value)} disabled={pending} />
        </CalmeField>
        <CalmeRow label={t("Toute la journée")}>
          {!isAllDay && <input type="time" className="nd-input" style={{ width: 120 }} value={time} disabled={pending} onChange={e => setTime(e.target.value)} aria-label={t('calendar.calme.time')} />}
          <CalmeSwitch label={t("Toute la journée")} checked={isAllDay} onChange={setIsAllDay} />
        </CalmeRow>
        <CalmeField label={t("Description (Optionnel)")} htmlFor="event-description">
          <textarea id="event-description" className="nd-input" value={description} disabled={pending} onChange={e => setDescription(e.target.value)} placeholder={t("Détails de l'événement...")} rows={3} style={{ resize: 'vertical' }} />
        </CalmeField>
      </CalmeDialog>

      {/* Confirm Delete Modal */}
      {confirmDeleteEvent && (
        <ConfirmModal
          isOpen={true}
          title={t("Supprimer l'événement")}
          description={t("Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible.")}
          onConfirm={() => handleDeleteEvent(confirmDeleteEvent)}
          onClose={() => setConfirmDeleteEvent(null)}
        />
      )}
    </div>
  );
}
