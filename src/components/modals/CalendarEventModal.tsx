import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, Clock, AlignLeft, Trash2 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import ConfirmModal from './ConfirmModal';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';

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
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t("Ajouter un événement")} tabIndex={-1} className="nd-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{t("Ajouter un événement")}</h2>
          <button aria-label="Fermer" className="nd-btn" onClick={closeModal} style={{ padding: 8 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--nd-text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={14} />
            <span style={{ textTransform: 'capitalize' }}>{formattedDate}</span>
          </div>

          {calendarEventModal.events && calendarEventModal.events.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                {t("Événements existants")}
              </div>
              {calendarEventModal.events.map(ev => {
                const isLocal = config?.localEvents?.some(le => le.id === ev.id);
                return (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--nd-card-bg)', borderRadius: 'var(--nd-card-radius)', border: '1px solid var(--nd-card-border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--nd-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
                      {!ev.isAllDay && ev.start && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginTop: '4px' }}>
                          {new Date(ev.start).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {isLocal && (
                      <button 
                        type="button"
                        className="nd-action-icon danger"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteEvent(ev.id); }}
                        title={t("Supprimer cet événement")}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--nd-text-muted)' }}>{t("Titre de l'événement")}</label>
            <input
              type="text"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--nd-bg)',
                border: '1px solid var(--nd-border)',
                borderRadius: 'var(--nd-card-radius)',
                color: 'var(--nd-text)',
                outline: 'none',
                fontSize: '0.85rem'
              }}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t("Ex: Réunion d'équipe")}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
              <input 
                type="checkbox" 
                checked={isAllDay} 
                onChange={e => setIsAllDay(e.target.checked)} 
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--nd-text)' }}>{t("Toute la journée")}</span>
            </label>

            {!isAllDay && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <Clock size={14} style={{ color: 'var(--nd-text-muted)' }} />
                <input
                  type="time"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: 'var(--nd-bg)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: 'var(--nd-card-radius)',
                    color: 'var(--nd-text)',
                    outline: 'none',
                    fontSize: '0.85rem'
                  }}
                  value={time}
                  onChange={e => setTime(e.target.value)}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 500, color: 'var(--nd-text-muted)' }}>
              <AlignLeft size={14} /> {t("Description (Optionnel)")}
            </label>
            <textarea
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--nd-bg)',
                border: '1px solid var(--nd-border)',
                borderRadius: 'var(--nd-card-radius)',
                color: 'var(--nd-text)',
                outline: 'none',
                fontSize: '0.85rem',
                resize: 'vertical'
              }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t("Détails de l'événement...")}
              rows={3}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button className="nd-btn" onClick={() => setCalendarEventModal({ open: false })}>
            Annuler
          </button>
          <button 
            className="nd-btn nd-btn-primary" 
            onClick={handleSave} 
            disabled={!title.trim()}
            style={{ opacity: !title.trim() ? 0.5 : 1, cursor: !title.trim() ? 'not-allowed' : 'pointer' }}
          >
            Enregistrer
          </button>
        </div>
      </div>
      
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
