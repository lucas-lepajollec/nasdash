'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function ClockWidget() {
  const [time, setTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!mounted) {
    // Return placeholder with same dimensions to avoid layout shift
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1" style={{ minHeight: '140px', opacity: 0 }}></div>
    );
  }

  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');
  
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = time.toLocaleDateString('fr-FR', options);
  // Capitalize first letter of date
  const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  return (
    <div className="nd-sidebar-card nd-animate-in nd-stagger-1" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="nd-section-title" style={{ zIndex: 2, position: 'relative' }}>
        <Clock size={12} style={{ color: 'var(--nd-accent)' }} />
        Horloge locale
      </div>
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '10px 0',
        zIndex: 2,
        position: 'relative'
      }}>
        <div style={{ 
          fontSize: '3.5rem', 
          fontWeight: 800, 
          lineHeight: 1,
          background: 'linear-gradient(135deg, var(--nd-text) 0%, var(--nd-text-muted) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          display: 'flex',
          alignItems: 'baseline'
        }}>
          {hours}:{minutes}
          <span style={{ fontSize: '1.2rem', marginLeft: '4px', opacity: 0.5, WebkitTextFillColor: 'var(--nd-text-muted)' }}>{seconds}</span>
        </div>
        <div style={{ 
          marginTop: '8px',
          fontSize: '0.85rem', 
          fontWeight: 600, 
          color: 'var(--nd-text-muted)',
          textTransform: 'capitalize'
        }}>
          {formattedDate}
        </div>
      </div>

      {/* Decorative background element */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '150px',
        height: '150px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--nd-accent) 0%, transparent 70%)',
        opacity: 0.05,
        zIndex: 0,
        pointerEvents: 'none'
      }} />
    </div>
  );
}
