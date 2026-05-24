'use client';

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';

export default function ClockWidget() {
  const [time, setTime] = useState(new Date());
  const { config } = useConfig();

  // Settings
  const timezone = config?.settings?.clockTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const design = config?.settings?.clockDesign || 'default';
  const hideTitles = config?.settings?.hideWidgetTitles ?? false;

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone
      }).format(date);
    } catch (e) {
      return new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    }
  };

  const formatSeconds = (date: Date) => {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        second: '2-digit',
        timeZone: timezone
      }).format(date);
    } catch (e) {
      return new Intl.DateTimeFormat('fr-FR', {
        second: '2-digit'
      }).format(date);
    }
  };

  const formatDate = (date: Date) => {
    try {
      const formatted = new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: timezone
      }).format(date);
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (e) {
      return '';
    }
  };

  const timeStr = formatTime(time);
  const hours = timeStr.split(':')[0];
  const mins = timeStr.split(':')[1];
  const secs = formatSeconds(time);
  const dateStr = formatDate(time);

  // Default design
  if (design === 'default') {
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1" style={{ display: 'flex', flexDirection: 'column' }}>
        {!hideTitles && (
          <div className="nd-section-title">
            <Clock size={12} style={{ color: 'var(--nd-accent)' }} /> Horloge
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0 8px 0', position: 'relative' }}>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
            <span style={{ fontSize: '3.2rem', fontWeight: 800, lineHeight: 1, color: 'var(--nd-text)', fontVariantNumeric: 'tabular-nums', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
              {hours}
              <span style={{ animation: 'nd-pulse-opacity 2s infinite ease-in-out', display: 'inline-block', transform: 'translateY(-2px)' }}>:</span>
              {mins}
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--nd-accent)', fontVariantNumeric: 'tabular-nums', opacity: 0.8 }}>
              {secs}
            </span>
          </div>

          <div style={{ marginTop: '8px', fontSize: '0.85rem', fontWeight: 500, color: 'var(--nd-text-muted)', textTransform: 'capitalize', letterSpacing: '0.5px' }}>
            {dateStr}
          </div>
        </div>
      </div>
    );
  }

  // Minimal design
  if (design === 'minimal') {
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1" style={{ display: 'flex', flexDirection: 'column' }}>
        {!hideTitles && (
          <div className="nd-section-title">
            <Clock size={12} style={{ color: 'var(--nd-accent)' }} /> Horloge
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '16px 0 8px 0' }}>
          <div style={{ fontSize: '3.2rem', fontWeight: 300, lineHeight: 1, color: 'var(--nd-text)', letterSpacing: '-2px' }}>
            {hours}<span style={{ opacity: 0.3 }}>:</span>{mins}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--nd-text-muted)', fontWeight: 500, letterSpacing: '1px', textTransform: 'lowercase' }}>
            {dateStr}
          </div>
        </div>
      </div>
    );
  }

  // Terminal design
  if (design === 'glow') {
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1" style={{ display: 'flex', flexDirection: 'column' }}>
        {!hideTitles && (
          <div className="nd-section-title">
            <Clock size={12} style={{ color: 'var(--nd-accent)' }} /> Horloge
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', marginTop: hideTitles ? '0' : '4px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--nd-text-muted)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', opacity: 0.7 }}>
          <span>admin@nas:~</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--nd-text)' }}>
            <span style={{ color: 'var(--nd-accent)' }}>./clock</span> --format="HH:MM:SS"
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '2.5rem', fontWeight: 600, color: 'var(--nd-text)', display: 'flex', alignItems: 'baseline' }}>
            {hours}<span style={{ opacity: 0.4 }}>:</span>{mins}
            <span style={{ fontSize: '1.2rem', color: 'var(--nd-text-muted)', marginLeft: '6px', fontWeight: 500 }}>{secs}</span>
            <span style={{ width: '10px', height: '2rem', background: 'var(--nd-accent)', marginLeft: '12px', animation: 'nd-pulse-opacity 1s infinite step-end', transform: 'translateY(4px)' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '16px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--nd-text)' }}>
            <span style={{ color: 'var(--nd-accent)' }}>./date</span> --format="long"
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--nd-text-muted)', opacity: 0.9 }}>
            {dateStr}
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Split Cards design (Flip-like)
  if (design === 'split') {
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1" style={{ display: 'flex', flexDirection: 'column' }}>
        {!hideTitles && (
          <div className="nd-section-title">
            <Clock size={12} style={{ color: 'var(--nd-accent)' }} /> Horloge
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.4) 100%)', border: '1px solid var(--nd-card-border)', borderRadius: '6px', padding: '8px 10px', fontSize: '2.2rem', fontWeight: 800, color: 'var(--nd-text)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 6px rgba(0,0,0,0.2)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(0,0,0,0.5)', boxShadow: '0 1px 0 rgba(255,255,255,0.05)' }} />
              {hours}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--nd-accent)', opacity: 0.8 }} />
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--nd-accent)', opacity: 0.8 }} />
            </div>
            <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.4) 100%)', border: '1px solid var(--nd-card-border)', borderRadius: '6px', padding: '8px 10px', fontSize: '2.2rem', fontWeight: 800, color: 'var(--nd-text)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 6px rgba(0,0,0,0.2)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(0,0,0,0.5)', boxShadow: '0 1px 0 rgba(255,255,255,0.05)' }} />
              {mins}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
              <div style={{ background: 'var(--nd-accent-glow)', border: '1px solid var(--nd-accent)', borderRadius: '4px', padding: '2px 4px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--nd-accent)', marginLeft: '2px' }}>
                {secs}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--nd-text-muted)', fontWeight: 500, letterSpacing: '0.5px' }}>
            {dateStr}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
