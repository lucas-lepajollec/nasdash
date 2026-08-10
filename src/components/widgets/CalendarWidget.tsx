'use client';

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw, Plus, Clock, MapPin, AlignLeft } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useWidgetSize } from './WidgetContainer';

interface CalendarEvent {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  description?: string;
  location?: string;
  isAllDay?: boolean;
}

export default function CalendarWidget({ editMode, isVisible = true }: { editMode?: boolean; isVisible?: boolean }) {
  const { config, setCalendarEventModal, setViewEventModal } = useConfig();
  const { size: widgetSize } = useWidgetSize();
  const calendarUrl = config?.settings?.calendarUrl;
  const localEvents = config?.localEvents || [];

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const hideTitles = (config?.settings?.hideWidgetTitles ?? false) && !editMode;
  
  // Wait for client-side hydration to show actual date, to avoid SSR mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
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
  }, [calendarUrl, isVisible, localEvents]);

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

  // Helper: check if a day is today or in the future
  const isUpcomingOrToday = (day: number) => {
    const d = new Date(year, month, day, 23, 59, 59);
    const todayCutoff = new Date(realToday.getFullYear(), realToday.getMonth(), realToday.getDate(), 0, 0, 0);
    return d >= todayCutoff;
  };

  // Get upcoming events (filtered for today and future)
  const startOfToday = new Date(realToday.getFullYear(), realToday.getMonth(), realToday.getDate());
  const upcomingEvents = events
    .filter(e => e.start && new Date(e.start) >= startOfToday)
    .sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime());

  const hasEvents = upcomingEvents.length > 0;
  
  // Decide how many events to show in the list
  const displayedUpcoming = upcomingEvents.slice(0, widgetSize === 'wide' ? 6 : 3);

  // ==================== RENDER: COMPACT MONTH GRID (Narrow & Medium) ====================
  const renderCompactMonthGrid = (cellHeight = '28px', maxWidth = '340px') => {
    const days = [];
    
    // Empty slots before 1st of month
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(<div key={`empty-${i}`} style={{ opacity: 0 }}></div>);
    }
    
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const today = isToday(i);
      const dayEvents = getEventsForDay(i);
      const hasDayEvents = dayEvents.length > 0;

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
            height: cellHeight,
            fontSize: '0.72rem',
            fontWeight: today ? 700 : 500,
            color: today ? 'var(--nd-bg)' : 'var(--nd-text)',
            background: today ? 'var(--nd-accent)' : 'transparent',
            borderRadius: 'var(--nd-card-radius)',
            position: 'relative',
            cursor: 'pointer'
          }}
        >
          {i}
          {hasDayEvents && !today && (
            <div style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--nd-accent)' }} />
          )}
          {hasDayEvents && today && (
            <div style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--nd-bg)' }} />
          )}
          
          {hasDayEvents && (
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

    return (
      <div style={{ flex: 1, minWidth: 0, maxWidth: maxWidth, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--nd-text)', textTransform: 'capitalize' }}>
            {monthNames[month]} {year}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button aria-label="Mois précédent" onClick={prevMonth} style={{ background: 'transparent', border: 'none', color: 'var(--nd-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px' }}>
              <ChevronLeft size={13} />
            </button>
            <button aria-label="Mois suivant" onClick={nextMonth} style={{ background: 'transparent', border: 'none', color: 'var(--nd-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px' }}>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Weekday labels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px', textAlign: 'center', marginBottom: '6px' }}>
          {daysOfWeek.map((day, idx) => (
            <div key={idx} style={{ fontSize: '0.62rem', color: 'var(--nd-text-muted)', fontWeight: 600 }}>
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px', textAlign: 'center' }}>
          {days}
        </div>
      </div>
    );
  };

  // ==================== RENDER: AGENDA LIST ====================
  const renderAgendaList = (showAll = false) => (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--nd-text-dimmed)', fontWeight: 700, letterSpacing: '0.5px' }}>
          Agenda / À venir
        </div>
        {editMode && (
          <button 
            className="nd-action-icon success"
            onClick={() => setCalendarEventModal({ 
              open: true, 
              date: `${realToday.getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, '0')}-${String(realToday.getDate()).padStart(2, '0')}`,
              events: []
            })}
            title="Ajouter un événement"
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: showAll ? 'auto' : 'visible', maxHeight: showAll ? '200px' : 'none' }}>
        {displayedUpcoming.map(e => {
          const start = new Date(e.start!);
          const isTodayEvent = start.toDateString() === realToday.toDateString();
          return (
            <div 
              key={e.id} 
              onClick={() => setViewEventModal({ open: true, event: e })}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                gap: 12, 
                fontSize: '0.72rem', 
                cursor: 'pointer',
                padding: '6px 8px',
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid var(--nd-card-border)',
                borderRadius: '8px',
                transition: 'all 0.2s'
              }}
              className="nd-weather-card-hover"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ 
                  background: isTodayEvent ? 'var(--nd-accent-glow)' : 'rgba(251, 146, 60, 0.1)', 
                  color: isTodayEvent ? 'var(--nd-accent)' : '#fb923c', 
                  padding: '3px 6px', 
                  borderRadius: '6px', 
                  fontWeight: 700, 
                  fontSize: '0.62rem', 
                  minWidth: '40px', 
                  textAlign: 'center' 
                }}>
                  {start.getDate()} {monthNames[start.getMonth()].substring(0, 3)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ color: 'var(--nd-text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.title}>
                    {e.title}
                  </div>
                  {e.start && !e.isAllDay && (
                    <div style={{ color: 'var(--nd-text-muted)', fontSize: '0.58rem', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                      <Clock size={9} /> {new Date(e.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ==================== RENDER: PREMIUM FULL MONTH PLANNER (Wide) ====================
  const renderFullMonthPlanner = () => {
    const cells = [];
    
    // Empty slots before 1st of month
    for (let i = 0; i < adjustedFirstDay; i++) {
      cells.push(
        <div 
          key={`empty-full-${i}`} 
          style={{ background: 'rgba(255,255,255,0.01)', minHeight: '85px', borderRight: '1px solid var(--nd-card-border)', borderBottom: '1px solid var(--nd-card-border)' }}
        />
      );
    }
    
    // Days
    for (let i = 1; i <= daysInMonth; i++) {
      const today = isToday(i);
      const dayEvents = getEventsForDay(i);
      const isSelected = false; // Add selection state later if needed

      cells.push(
        <div
          key={`day-full-${i}`}
          className="nd-calendar-day-full"
          onClick={() => setCalendarEventModal({ 
            open: true, 
            date: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
            events: dayEvents
          })}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            minHeight: '85px',
            padding: '6px',
            background: today ? 'rgba(0, 229, 255, 0.02)' : 'var(--nd-card-bg)',
            borderRight: '1px solid var(--nd-card-border)',
            borderBottom: '1px solid var(--nd-card-border)',
            transition: 'background var(--nd-transition)',
            position: 'relative',
            cursor: 'pointer'
          }}
        >
          {/* Day number container */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: today ? '20px' : 'auto',
              height: today ? '20px' : 'auto',
              borderRadius: today ? '50%' : 'none',
              background: today ? 'var(--nd-accent)' : 'transparent',
              color: today ? 'var(--nd-bg)' : 'var(--nd-text)',
              fontSize: '0.72rem',
              fontWeight: today ? 700 : 500,
              padding: today ? '0' : '2px 4px'
            }}>
              {i}
            </span>
          </div>

          {/* Event list inside the day cell */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, overflow: 'hidden' }}>
            {dayEvents.slice(0, 2).map((e, idx) => (
              <div
                key={e.id}
                onClick={(evt) => {
                  evt.stopPropagation();
                  setViewEventModal({ open: true, event: e });
                }}
                title={e.title}
                style={{
                  fontSize: '0.62rem',
                  padding: '2px 5px',
                  background: today ? 'rgba(255, 255, 255, 0.15)' : 'var(--nd-accent-glow)',
                  color: today ? 'var(--nd-text)' : 'var(--nd-accent)',
                  borderRadius: '4px',
                  border: today ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0, 229, 255, 0.1)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
                className="nd-event-capsule"
              >
                {e.start && !e.isAllDay && (
                  <span style={{ opacity: 0.7, marginRight: 3, fontWeight: 500 }}>
                    {new Date(e.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {e.title}
              </div>
            ))}
            {dayEvents.length > 2 && (
              <div style={{
                fontSize: '0.58rem',
                color: 'var(--nd-text-muted)',
                fontWeight: 600,
                paddingLeft: 3,
                marginTop: 1
              }}>
                + {dayEvents.length - 2} autres
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%' }}>
        {/* Planner Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--nd-text)', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--nd-accent)' }}>●</span> {monthNames[month]} {year}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button aria-label="Mois précédent" onClick={prevMonth} className="nd-btn" style={{ height: '28px', padding: '0 8px' }}>
              <ChevronLeft size={14} />
            </button>
            {!isCurrentMonth && (
              <button onClick={goToToday} className="nd-btn" style={{ height: '28px', padding: '0 10px', fontSize: '0.65rem' }}>
                <RotateCcw size={10} /> Revenir
              </button>
            )}
            <button aria-label="Mois suivant" onClick={nextMonth} className="nd-btn" style={{ height: '28px', padding: '0 8px' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Planner Grid Container */}
        <div style={{ 
          borderLeft: '1px solid var(--nd-card-border)', 
          borderTop: '1px solid var(--nd-card-border)', 
          borderRadius: 'var(--nd-card-radius)', 
          overflow: 'hidden', 
          background: 'var(--nd-card-bg)'
        }}>
          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--nd-card-border)' }}>
            {daysOfWeek.map((day, idx) => (
              <div key={idx} style={{ 
                fontSize: '0.65rem', 
                color: 'var(--nd-text-muted)', 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px', 
                textAlign: 'center', 
                padding: '8px 0',
                borderRight: '1px solid var(--nd-card-border)'
              }}>
                {day}
              </div>
            ))}
          </div>

          {/* Days cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {cells}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="nd-sidebar-card nd-animate-in nd-stagger-1" style={{ width: '100%', boxSizing: 'border-box' }}>
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
        .nd-calendar-day:nth-child(7n+1) .nd-calendar-tooltip,
        .nd-calendar-day:nth-child(7n+2) .nd-calendar-tooltip {
          left: -10px;
          transform: none;
        }
        .nd-calendar-day:nth-child(7n) .nd-calendar-tooltip,
        .nd-calendar-day:nth-child(7n+6) .nd-calendar-tooltip {
          left: auto;
          right: -10px;
          transform: none;
        }
        .nd-calendar-day-full:hover {
          background: rgba(255, 255, 255, 0.015) !important;
        }
        .nd-event-capsule:hover {
          opacity: 0.85;
          filter: brightness(1.1);
        }
      `}} />
      
      {/* Title Header (hidden if title hidden setting is true, unless in editMode) */}
      {(!hideTitles || editMode) && (
        <div className="nd-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CalendarIcon size={12} style={{ color: '#fb923c' }} /> Calendrier
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {loadingEvents && <div style={{ width: 10, height: 10, border: '2px solid rgba(251, 146, 60, 0.3)', borderTopColor: '#fb923c', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
            {!isCurrentMonth && widgetSize !== 'wide' && (
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

      {/* Conditionally hide agenda container IF there are no upcoming events */}
      {!hasEvents ? (
        // ==================== NO EVENTS STATE ====================
        widgetSize === 'wide' ? (
          // Wide View: Render full-width monthly planner grid
          renderFullMonthPlanner()
        ) : widgetSize === 'medium' ? (
          // Medium View: Render centered compact month grid with medium scaling
          renderCompactMonthGrid('36px', '100%')
        ) : (
          // Narrow View: Render standard compact month grid
          renderCompactMonthGrid('28px', '100%')
        )
      ) : (
        // ==================== HAS EVENTS STATE ====================
        <>
          {/* WIDE Layout: Side-by-Side Split (70% Full Planner, 30% Agenda) */}
          {widgetSize === 'wide' && (
            <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', width: '100%' }}>
              <div style={{ flex: '1 1 70%', paddingRight: 14, minWidth: 0 }}>
                {renderFullMonthPlanner()}
              </div>
              <div style={{ flex: '1 1 30%', borderLeft: '1px solid var(--nd-card-border)', paddingLeft: 14, minWidth: 0 }}>
                {renderAgendaList(true)}
              </div>
            </div>
          )}

          {/* MEDIUM Layout: Side-by-Side 60/40 Split */}
          {widgetSize === 'medium' && (
            <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', width: '100%' }}>
              <div style={{ flex: '0 0 260px', borderRight: '1px solid var(--nd-card-border)', paddingRight: 14, minWidth: 0 }}>
                {renderCompactMonthGrid('30px', '100%')}
              </div>
              <div style={{ flex: '1 1 0%', paddingLeft: 14, minWidth: 0 }}>
                {renderAgendaList(false)}
              </div>
            </div>
          )}

          {/* NARROW Layout: Stacked List */}
          {widgetSize === 'narrow' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
              {renderCompactMonthGrid('28px', '100%')}
              {renderAgendaList(false)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
