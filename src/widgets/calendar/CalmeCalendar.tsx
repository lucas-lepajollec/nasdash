'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import type { CalendarDisplayEvent } from '@/lib/types';
import { CalmeWidget } from '../calme';
import { isoDay, useCalendarEvents } from './useCalendarEvents';

/**
 * Calme calendar: a quiet month grid (today in accent, a dot under days with
 * events) and the upcoming events beside it. The layout follows the block
 * width (container queries in design-calme.css): stacked when narrow, side by
 * side from 520 px, and event titles inside the days from 760 px. Clicking a
 * day opens its events, clicking an event opens it, as in the Classic version.
 */
export default function CalmeCalendar({ editMode, isVisible = true }: { editMode?: boolean; isVisible?: boolean }) {
  const { t, locale } = useI18n();
  const { setCalendarEventModal, setViewEventModal } = useConfig();
  const { events, loading } = useCalendarEvents(isVisible);
  const [current, setCurrent] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const title = t('Calendrier');
  if (!mounted) return <CalmeWidget title={title} editMode={editMode}><div className="ndc-calendar" style={{ minHeight: 240 }} /></CalmeWidget>;

  const now = new Date();
  const year = current.getFullYear();
  const month = current.getMonth();
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // weeks start on Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2024, 0, index + 1)),
  );
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
  const time = (event: CalendarDisplayEvent) => event.start && !event.isAllDay
    ? new Date(event.start).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  const eventsOn = (day: number) => {
    const from = new Date(year, month, day, 0, 0, 0);
    const to = new Date(year, month, day, 23, 59, 59);
    return events.filter(event => event.start && new Date(event.start) >= from && new Date(event.start) <= to);
  };
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = events
    .filter(event => event.start && new Date(event.start) >= startOfToday)
    .sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime())
    .slice(0, 6);

  const openDay = (day: number, dayEvents: CalendarDisplayEvent[]) =>
    setCalendarEventModal({ open: true, date: isoDay(year, month, day), events: dayEvents });
  const addToday = () => setCalendarEventModal({ open: true, date: isoDay(now.getFullYear(), now.getMonth(), now.getDate()), events: [] });

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < offset; i++) cells.push(<span key={`blank-${i}`} aria-hidden="true" />);
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEvents = eventsOn(day);
    const today = isCurrentMonth && day === now.getDate();
    cells.push(
      <button
        key={day}
        type="button"
        className={`ndc-cal-day ${today ? 'is-today' : ''} ${dayEvents.length ? 'has-events' : ''}`}
        onClick={() => openDay(day, dayEvents)}
        title={dayEvents.map(event => [time(event), t(event.title)].filter(Boolean).join(' ')).join('\n') || undefined}
      >
        <span className="ndc-cal-num">{day}</span>
        {dayEvents.length > 0 && (
          <span className="ndc-cal-cell-events">
            {dayEvents.slice(0, 2).map(event => (
              <span
                key={event.id}
                className="ndc-cal-chip"
                onClick={click => { click.stopPropagation(); setViewEventModal({ open: true, event }); }}
              >
                {t(event.title)}
              </span>
            ))}
            {dayEvents.length > 2 && <span className="ndc-cal-more">{t('calendar.moreEvents', { count: dayEvents.length - 2 })}</span>}
          </span>
        )}
      </button>,
    );
  }

  return (
    <CalmeWidget
      title={title}
      editMode={editMode}
      aside={loading ? <span className="nd-spinner" style={{ width: 10, height: 10 }} /> : undefined}
    >
      <div className="ndc-calendar">
        <div className="ndc-cal-month">
          <div className="ndc-cal-head">
            <span className="ndc-cal-label">{monthLabel}</span>
            {!isCurrentMonth && (
              <button type="button" className="ndc-cal-today" onClick={() => setCurrent(new Date(now.getFullYear(), now.getMonth(), 1))} title={t('Revenir au mois en cours')}>
                {t('Revenir')}
              </button>
            )}
            <button type="button" className="ndc-icon-button" aria-label={t('Mois précédent')} onClick={() => setCurrent(new Date(year, month - 1, 1))}><ChevronLeft size={14} /></button>
            <button type="button" className="ndc-icon-button" aria-label={t('Mois suivant')} onClick={() => setCurrent(new Date(year, month + 1, 1))}><ChevronRight size={14} /></button>
          </div>
          <div className="ndc-cal-grid ndc-cal-weekdays" aria-hidden="true">
            {weekdays.map((day, index) => <span key={index}>{day}</span>)}
          </div>
          <div className="ndc-cal-grid">{cells}</div>
        </div>

        {(upcoming.length > 0 || editMode) && (
          <div className="ndc-cal-agenda">
            <div className="ndc-cal-agenda-head">
              <span className="ndc-sub">{t('calendar.calme.upcoming')}</span>
              {editMode && (
                <button type="button" className="ndc-icon-button" onClick={addToday} title={t('Ajouter un événement')} aria-label={t('Ajouter un événement')}><Plus size={13} /></button>
              )}
            </div>
            <ul className="ndc-cal-list">
              {upcoming.map(event => {
                const start = new Date(event.start!);
                const isToday = start.toDateString() === now.toDateString();
                return (
                  <li key={event.id}>
                    <button type="button" className="ndc-cal-event" onClick={() => setViewEventModal({ open: true, event })}>
                      <span className={`ndc-cal-date ${isToday ? 'is-today' : ''}`}>
                        {isToday ? t('calendar.calme.today') : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(start).replace('.', '')}
                      </span>
                      <span className="ndc-cal-event-title">{t(event.title)}</span>
                      {time(event) && <span className="ndc-cal-time">{time(event)}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </CalmeWidget>
  );
}
