'use client';

import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarWidget() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="nd-sidebar-card nd-animate-in nd-stagger-2" style={{ minHeight: '250px', opacity: 0 }}></div>;
  }

  const today = new Date();
  
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    // Adjust to make Monday the first day of the week (0 = Monday, 6 = Sunday)
    return day === 0 ? 6 : day - 1;
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  
  const days = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const resetToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (day: number) => {
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  // Generate calendar grid
  const blanks = Array.from({ length: firstDay }, (_, i) => (
    <div key={`blank-${i}`} style={{ padding: '6px', textAlign: 'center', opacity: 0 }}></div>
  ));
  
  const daysInMonthEls = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const isCurrentDay = isToday(day);
    
    return (
      <div 
        key={`day-${day}`} 
        style={{ 
          padding: '6px 0', 
          textAlign: 'center', 
          fontSize: '0.8rem',
          fontWeight: isCurrentDay ? 700 : 500,
          color: isCurrentDay ? '#fff' : 'var(--nd-text)',
          background: isCurrentDay ? 'var(--nd-accent)' : 'transparent',
          borderRadius: '6px',
          boxShadow: isCurrentDay ? '0 2px 10px rgba(var(--nd-accent-rgb), 0.3)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '28px',
          width: '28px',
          margin: '0 auto',
          cursor: 'default'
        }}
      >
        {day}
      </div>
    );
  });

  const totalSlots = [...blanks, ...daysInMonthEls];
  
  return (
    <div className="nd-sidebar-card nd-animate-in nd-stagger-2">
      <div className="nd-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CalendarIcon size={12} style={{ color: 'var(--nd-accent)' }} />
          <span>Calendrier</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={prevMonth} className="nd-action-icon" style={{ padding: '2px' }} title="Mois précédent">
            <ChevronLeft size={14} />
          </button>
          <button onClick={resetToToday} className="nd-action-icon" style={{ padding: '2px', fontSize: '0.65rem', fontWeight: 600, width: 'auto', paddingLeft: '6px', paddingRight: '6px' }} title="Aujourd'hui">
            {today.getDate()}
          </button>
          <button onClick={nextMonth} className="nd-action-icon" style={{ padding: '2px' }} title="Mois suivant">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      
      <div style={{ padding: '4px 0' }}>
        <div style={{ 
          textAlign: 'center', 
          fontSize: '0.9rem', 
          fontWeight: 700, 
          marginBottom: '12px',
          color: 'var(--nd-text)',
          textTransform: 'capitalize'
        }}>
          {monthNames[month]} {year}
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', 
          gap: '4px',
          marginBottom: '6px'
        }}>
          {days.map(day => (
            <div key={day} style={{ 
              textAlign: 'center', 
              fontSize: '0.7rem', 
              fontWeight: 600, 
              color: 'var(--nd-text-muted)' 
            }}>
              {day}
            </div>
          ))}
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', 
          gap: '4px 2px'
        }}>
          {totalSlots}
        </div>
      </div>
    </div>
  );
}
