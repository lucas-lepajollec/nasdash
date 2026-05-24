'use client';

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';

interface CalendarEvent {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  description?: string;
  location?: string;
  isAllDay?: boolean;
}

export default function CalendarWidget({ editMode }: { editMode?: boolean }) {
  const { config, setCalendarEventModal } = useConfig();
  const calendarUrl = config?.settings?.calendarUrl;
  const localEvents = config?.localEvents || [];

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const { setViewEventModal } = useConfig();
  const hideTitles = config?.settings?.hideWidgetTitles ?? false;
  
  // Wait for client-side hydration to show actual date, to avoid SSR mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      let combinedEvents: CalendarEvent[] = localEvents.map(e => ({
        ...e,
        start: e.start || null,
        end: e.end || null
      }));
      
      if (!calendarUrl) {
        setEvents(combinedEvents);
        return;
      }
      setLoadingEvents(true);
      try {
        const res = await fetch(`/api/calendar?url=${encodeURIComponent(calendarUrl)}`);
        const data = await res.json();
        if (data && data.events) {
          combinedEvents = [...combinedEvents, ...data.events];
        }
      } catch (e) {
        console.error('Failed to fetch calendar events:', e);
      } finally {
        setEvents(combinedEvents);
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [calendarUrl, localEvents]);

  const daysOfWeek = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  if (!mounted) {
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1" style={{ height: '280px', opacity: 0 }}></div>
    );
  }

  const realToday = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const isCurrentMonth = month === realToday.getMonth() && year === realToday.getFullYear();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Start on Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date(realToday.getFullYear(), realToday.getMonth(), 1));

  const isToday = (day: number) => {
    return day === realToday.getDate() && month === realToday.getMonth() && year === realToday.getFullYear();
  };

  const getEventsForDay = (day: number) => {
    const startOfDay = new Date(year, month, day, 0, 0, 0);
    const endOfDay = new Date(year, month, day, 23, 59, 59);

    return events.filter(e => {
      if (!e.start) return false;
      const eventStart = new Date(e.start);
      return eventStart >= startOfDay && eventStart <= endOfDay;
    });
  };

  const renderDays = () => {
    const days = [];
    // Empty slots before 1st of month
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(<div key={`empty-${i}`} style={{ opacity: 0 }}></div>);
    }
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const today = isToday(i);
      const dayEvents = getEventsForDay(i);
      const hasEvents = dayEvents.length > 0;

      days.push(
        <div 
          key={i} 
          className="nd-calendar-day"
          onClick={() => setCalendarEventModal({ 
            open: true, 
            date: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
            events: dayEvents
          })}
          style={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '28px',
            fontSize: '0.75rem',
            fontWeight: today ? 700 : 500,
            color: today ? 'var(--nd-bg)' : 'var(--nd-text)',
            background: today ? 'var(--nd-accent)' : 'transparent',
            borderRadius: 'var(--nd-card-radius)',
            position: 'relative',
            cursor: 'pointer' // Always pointer to add events
          }}
        >
          {i}
          {hasEvents && !today && (
            <div style={{ position: 'absolute', bottom: '2px', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--nd-accent)' }} />
          )}
          {hasEvents && today && (
            <div style={{ position: 'absolute', bottom: '2px', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--nd-bg)' }} />
          )}
          
          {hasEvents && (
            <div className="nd-calendar-tooltip">
              {dayEvents.map((e, idx) => (
                <div key={idx} style={{ marginBottom: idx === dayEvents.length - 1 ? 0 : 4, borderBottom: idx === dayEvents.length - 1 ? 'none' : '1px solid var(--nd-card-border)', paddingBottom: idx === dayEvents.length - 1 ? 0 : 4 }}>
                  <div style={{ fontWeight: 600, color: 'var(--nd-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
                  {e.start && !e.isAllDay && (
                    <div style={{ color: 'var(--nd-text-muted)', fontSize: '0.65rem' }}>
                      {new Date(e.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return days;
  };

  // Get upcoming events
  const startOfToday = new Date(realToday.getFullYear(), realToday.getMonth(), realToday.getDate());
  const upcomingEvents = events
    .filter(e => e.start && new Date(e.start) >= startOfToday)
    .sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime())
    .slice(0, 2);

  return (
    <div className="nd-sidebar-card nd-animate-in nd-stagger-1">
      <style dangerouslySetInnerHTML={{__html: `
        .nd-calendar-day .nd-calendar-tooltip {
          visibility: hidden;
          opacity: 0;
          position: absolute;
          bottom: calc(100% + 5px);
          left: 50%;
          transform: translateX(-50%);
          background: var(--nd-bg);
          border: 1px solid var(--nd-card-border);
          border-radius: var(--nd-card-radius);
          padding: 8px 12px;
          width: max-content;
          max-width: 200px;
          z-index: 50;
          pointer-events: none;
          transition: opacity 0.2s, visibility 0.2s;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          text-align: left;
        }
        .nd-calendar-day:hover .nd-calendar-tooltip {
          visibility: visible;
          opacity: 1;
        }
        /* Aligner à gauche pour Lundi et Mardi */
        .nd-calendar-day:nth-child(7n+1) .nd-calendar-tooltip,
        .nd-calendar-day:nth-child(7n+2) .nd-calendar-tooltip {
          left: -10px;
          transform: none;
        }
        /* Aligner à droite pour Samedi et Dimanche */
        .nd-calendar-day:nth-child(7n) .nd-calendar-tooltip,
        .nd-calendar-day:nth-child(7n+6) .nd-calendar-tooltip {
          left: auto;
          right: -10px;
          transform: none;
        }
      `}} />
      {!hideTitles && (
        <div className="nd-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CalendarIcon size={12} style={{ color: '#fb923c' }} /> Calendrier
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {loadingEvents && <div style={{ width: 10, height: 10, border: '2px solid rgba(251, 146, 60, 0.3)', borderTopColor: '#fb923c', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
            {!isCurrentMonth && (
              <button 
                className="nd-btn"
                onClick={goToToday}
                style={{
                  fontSize: '0.65rem', 
                  padding: '4px 8px', 
                  height: 'auto',
                  borderWidth: '1px'
                }}
                title="Revenir au mois en cours"
              >
                <RotateCcw size={10} /> Revenir
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* HEADER CALENDRIER (Mois & Nav) */}
      <div style={{ marginTop: hideTitles ? '0' : '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--nd-text)', textTransform: 'capitalize' }}>
              {monthNames[month]} {year}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={prevMonth} style={{ background: 'transparent', border: 'none', color: 'var(--nd-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '4px' }}>
              <ChevronLeft size={14} />
            </button>
            <button onClick={nextMonth} style={{ background: 'transparent', border: 'none', color: 'var(--nd-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '4px' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '8px' }}>
          {daysOfWeek.map((day, idx) => (
            <div key={idx} style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', fontWeight: 600 }}>
              {day}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px 8px', textAlign: 'center' }}>
          {renderDays()}
        </div>

        {/* Upcoming events list */}
        {upcomingEvents.length > 0 && (
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--nd-card-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--nd-text-dimmed)', fontWeight: 700, letterSpacing: '0.5px' }}>
              À venir
            </div>
            {upcomingEvents.map(e => {
              const start = new Date(e.start!);
              return (
                <div 
                  key={e.id} 
                  onClick={() => setViewEventModal({ open: true, event: e })}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.7rem', cursor: 'pointer' }}
                >
                  <div style={{ background: 'rgba(251, 146, 60, 0.1)', color: '#fb923c', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, fontSize: '0.6rem', minWidth: '40px', textAlign: 'center' }}>
                    {start.getDate()} {monthNames[start.getMonth()].substring(0, 3)}
                  </div>
                  <div style={{ flex: 1, color: 'var(--nd-text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.title}>
                    {e.title}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
