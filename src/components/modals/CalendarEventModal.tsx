import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import ConfirmModal from './ConfirmModal';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSwitch } from './settings/shared/CalmeControls';

export default function CalendarEventModal() {
  const { t, locale } = useI18n();
  const { config, calendarEventModal, setCalendarEventModal, addLocalEvent, deleteLocalEvent, user } = useConfig();
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('12:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const closeModal = () => setCalendarEventModal({ open: false });
  const dialogRef = useDialogAccessibility(
    closeModal,
    Boolean(calendarEventModal.open && calendarEventModal.date && user?.role === 'admin'),
  );

  if (!calendarEventModal.open || !calendarEventModal.date || user?.role !== 'admin') return null;

  const dateParts = calendarEventModal.date.split('-');
  const displayDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
  const formattedDate = displayDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const handleSave = async () => {
    if (!title.trim()) return;

    let startIso = '';
    if (isAllDay) {
      // YYYYMMDD string format for all day, handled by parser or ISO format
      // Just save standard ISO for local
      startIso = new Date(calendarEventModal.date + 'T00:00:00Z').toISOString();
    } else {
      startIso = new Date(`${calendarEventModal.date}T${time}:00`).toISOString();
    }

    await addLocalEvent({
      title: title.trim(),
      description: description.trim(),
      start: startIso,
      isAllDay
    });

    setCalendarEventModal({ open: false });
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteLocalEvent(id);
    setConfirmDeleteEvent(null);
    setCalendarEventModal({ open: false }); // close to refresh state cleanly
  };

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <CalmeDialog
        dialogRef={dialogRef}
        label={t("Ajouter un événement")}
        title={t("Ajouter un événement")}
        subtitle={<span style={{ textTransform: 'capitalize' }}>{formattedDate}</span>}
        width={420}
        onClose={closeModal}
        footer={<>
          <button type="button" className="nd-btn" onClick={closeModal}>{t("Annuler")}</button>
          <button type="button" className="nd-btn nd-btn-accent" onClick={handleSave} disabled={!title.trim()}>{t("Enregistrer")}</button>
        </>}
      >
        {calendarEventModal.events && calendarEventModal.events.length > 0 && (
          <CalmeField label={t("Événements existants")}>
            <div className="ndc-check-list">
              {calendarEventModal.events.map(ev => {
                const isLocal = config?.localEvents?.some(le => le.id === ev.id);
                return (
                  <div key={ev.id} className="ndc-event-row">
                    <span className="ndc-set-list-sub" style={{ minWidth: 42 }}>{!ev.isAllDay && ev.start ? new Date(ev.start).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}</span>
                    <span className="ndc-sub-name">{t(ev.title)}</span>
                    {isLocal && (
                      <button type="button" className="ndc-icon-button ndc-icon-danger" onClick={(e) => { e.stopPropagation(); setConfirmDeleteEvent(ev.id); }} title={t("Supprimer cet événement")} aria-label={t("Supprimer cet événement")}>
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
          <input id="event-title" type="text" className="nd-input" value={title} onChange={e => setTitle(e.target.value)} placeholder={t("Ex: Réunion d'équipe")} autoFocus />
        </CalmeField>
        <CalmeRow label={t("Toute la journée")}>
          {!isAllDay && <input type="time" className="nd-input" style={{ width: 120 }} value={time} onChange={e => setTime(e.target.value)} aria-label={t('calendar.calme.time')} />}
          <CalmeSwitch label={t("Toute la journée")} checked={isAllDay} onChange={setIsAllDay} />
        </CalmeRow>
        <CalmeField label={t("Description (Optionnel)")} htmlFor="event-description">
          <textarea id="event-description" className="nd-input" value={description} onChange={e => setDescription(e.target.value)} placeholder={t("Détails de l'événement...")} rows={3} style={{ resize: 'vertical' }} />
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
