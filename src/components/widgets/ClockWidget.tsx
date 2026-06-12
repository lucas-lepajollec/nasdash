'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Globe } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useWidgetSize } from './WidgetContainer';

export default function ClockWidget({ editMode }: { editMode?: boolean }) {
  const { config } = useConfig();
  const { size: widgetSize } = useWidgetSize();
  const [time, setTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  // Settings
  const timezone = config?.settings?.clockTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const design = config?.settings?.clockDesign || 'default';
  const hideTitles = (config?.settings?.hideWidgetTitles ?? false) && !editMode;

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!mounted) return null;

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

  // ==================== DESIGN 1: DEFAULT ====================
  if (design === 'default') {
    if (widgetSize === 'wide') {
      return (
        <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', padding: '16px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: '3.6rem', fontWeight: 800, lineHeight: 1, color: 'var(--nd-text)', fontVariantNumeric: 'tabular-nums', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                {hours}
                <span style={{ animation: 'nd-pulse-opacity 2s infinite ease-in-out', display: 'inline-block' }}>:</span>
                {mins}
              </span>
              <span style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--nd-accent)', fontVariantNumeric: 'tabular-nums', opacity: 0.8 }}>
                {secs}
              </span>
            </div>

            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, var(--nd-card-border), transparent)', opacity: 0.5 }} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--nd-text)', letterSpacing: '0.2px' }}>
                {dateStr}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--nd-text-muted)' }}>
                <Globe size={12} /> {timezone.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (widgetSize === 'medium') {
      return (
        <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: '2.8rem', fontWeight: 800, lineHeight: 1, color: 'var(--nd-text)', fontVariantNumeric: 'tabular-nums' }}>
              {hours}<span style={{ animation: 'nd-pulse-opacity 2s infinite ease-in-out' }}>:</span>{mins}
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--nd-accent)', fontVariantNumeric: 'tabular-nums' }}>
              {secs}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--nd-text)' }}>{dateStr}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)' }}>{timezone}</span>
          </div>
        </div>
      );
    }

    // Narrow
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1" style={{ display: 'flex', flexDirection: 'column' }}>
        {!hideTitles && (
          <div className="nd-section-title">
            <Clock size={12} style={{ color: 'var(--nd-accent)' }} /> Horloge
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: hideTitles ? '8px 0' : '16px 0 8px 0', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, color: 'var(--nd-text)', fontVariantNumeric: 'tabular-nums', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
              {hours}
              <span style={{ animation: 'nd-pulse-opacity 2s infinite ease-in-out', display: 'inline-block', transform: 'translateY(-2px)' }}>:</span>
              {mins}
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--nd-accent)', fontVariantNumeric: 'tabular-nums', opacity: 0.8 }}>
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

  // ==================== DESIGN 2: MINIMAL ====================
  if (design === 'minimal') {
    if (widgetSize === 'wide') {
      return (
        <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', padding: '16px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 24 }}>
            <div style={{ fontSize: '3.6rem', fontWeight: 200, lineHeight: 1, color: 'var(--nd-text)', letterSpacing: '-2px', flexShrink: 0 }}>
              {hours}<span style={{ opacity: 0.3 }}>:</span>{mins}<span style={{ fontSize: '1.4rem', fontWeight: 300, color: 'var(--nd-text-muted)', marginLeft: 8 }}>{secs}</span>
            </div>

            <div style={{ flex: 1, height: '1px', background: 'var(--nd-card-border)', opacity: 0.4 }} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <div style={{ fontSize: '1.1rem', color: 'var(--nd-text)', fontWeight: 400, letterSpacing: '0.5px' }}>
                {dateStr.toLowerCase()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--nd-text-muted)', fontWeight: 400 }}>
                {timezone}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (widgetSize === 'medium') {
      return (
        <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
          <div style={{ fontSize: '2.8rem', fontWeight: 200, lineHeight: 1, color: 'var(--nd-text)', letterSpacing: '-1px' }}>
            {hours}<span style={{ opacity: 0.3 }}>:</span>{mins}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--nd-text-muted)', fontWeight: 400, textTransform: 'lowercase' }}>
            {dateStr}
          </div>
        </div>
      );
    }

    // Narrow
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1" style={{ display: 'flex', flexDirection: 'column' }}>
        {!hideTitles && (
          <div className="nd-section-title">
            <Clock size={12} style={{ color: 'var(--nd-accent)' }} /> Horloge
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: hideTitles ? '8px 0' : '16px 0 8px 0' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 300, lineHeight: 1, color: 'var(--nd-text)', letterSpacing: '-2px' }}>
            {hours}<span style={{ opacity: 0.3 }}>:</span>{mins}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--nd-text-muted)', fontWeight: 500, letterSpacing: '1px', textTransform: 'lowercase' }}>
            {dateStr}
          </div>
        </div>
      </div>
    );
  }

  // ==================== DESIGN 3: GLOW (TERMINAL) ====================
  if (design === 'glow') {
    if (widgetSize === 'wide') {
      return (
        <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', padding: '16px 32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 12 }}>
            <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--nd-text-muted)', display: 'flex', justifyContent: 'space-between', opacity: 0.7 }}>
              <span>admin@nas:~</span>
              <span>{timezone}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--nd-text)' }}>
                  <span style={{ color: 'var(--nd-accent)' }}>./clock</span> --format="HH:MM:SS"
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '2.8rem', fontWeight: 600, color: 'var(--nd-text)', display: 'flex', alignItems: 'baseline', lineHeight: 1 }}>
                  {hours}<span style={{ opacity: 0.4 }}>:</span>{mins}
                  <span style={{ fontSize: '1.2rem', color: 'var(--nd-text-muted)', marginLeft: '6px', fontWeight: 500 }}>{secs}</span>
                  <span style={{ width: '8px', height: '1.8rem', background: 'var(--nd-accent)', marginLeft: '8px', animation: 'nd-pulse-opacity 1s infinite step-end', transform: 'translateY(2px)' }} />
                </div>
              </div>
              
              <div style={{ flex: 1, borderTop: '1px dashed var(--nd-text-muted)', opacity: 0.3 }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--nd-text)' }}>
                  <span style={{ color: 'var(--nd-accent)' }}>./date</span> --format="long"
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--nd-text-muted)' }}>
                  {dateStr}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (widgetSize === 'medium') {
      return (
        <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', justifyContent: 'center', padding: '14px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 8 }}>
            <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--nd-text-muted)', display: 'flex', justifyContent: 'space-between', opacity: 0.7 }}>
              <span>admin@nas:~</span>
              <span>{timezone}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--nd-text)' }}>
                  <span style={{ color: 'var(--nd-accent)' }}>./clock</span> --format="HH:MM:SS"
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '2.8rem', fontWeight: 600, color: 'var(--nd-text)', display: 'flex', alignItems: 'baseline', lineHeight: 1 }}>
                  {hours}<span style={{ opacity: 0.4 }}>:</span>{mins}
                  <span style={{ fontSize: '1.2rem', color: 'var(--nd-text-muted)', marginLeft: '6px', fontWeight: 500 }}>{secs}</span>
                  <span style={{ width: '8px', height: '1.8rem', background: 'var(--nd-accent)', marginLeft: '8px', animation: 'nd-pulse-opacity 1s infinite step-end', transform: 'translateY(2px)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--nd-text)' }}>
                  <span style={{ color: 'var(--nd-accent)' }}>./date</span> --format="long"
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--nd-text-muted)' }}>
                  {dateStr}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Narrow
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1" style={{ display: 'flex', flexDirection: 'column' }}>
        {!hideTitles && (
          <div className="nd-section-title">
            <Clock size={12} style={{ color: 'var(--nd-accent)' }} /> Horloge
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', padding: hideTitles ? '8px 0' : '16px 0 8px 0' }}>
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

  // ==================== DESIGN 4: SPLIT (FLIP CARD) ====================
  if (design === 'split') {
    if (widgetSize === 'wide') {
      return (
        <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', padding: '16px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.4) 100%)', border: '1px solid var(--nd-card-border)', borderRadius: '6px', padding: '12px 14px', fontSize: '2.8rem', fontWeight: 800, color: 'var(--nd-text)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 6px rgba(0,0,0,0.2)', position: 'relative', lineHeight: 1 }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(0,0,0,0.5)', boxShadow: '0 1px 0 rgba(255,255,255,0.05)' }} />
                {hours}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nd-accent)', opacity: 0.8 }} />
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nd-accent)', opacity: 0.8 }} />
              </div>
              <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.4) 100%)', border: '1px solid var(--nd-card-border)', borderRadius: '6px', padding: '12px 14px', fontSize: '2.8rem', fontWeight: 800, color: 'var(--nd-text)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 6px rgba(0,0,0,0.2)', position: 'relative', lineHeight: 1 }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(0,0,0,0.5)', boxShadow: '0 1px 0 rgba(255,255,255,0.05)' }} />
                {mins}
              </div>
              <div style={{ background: 'var(--nd-accent-glow)', border: '1px solid var(--nd-accent)', borderRadius: '4px', padding: '4px 6px', fontSize: '0.95rem', fontWeight: 800, color: 'var(--nd-accent)', marginLeft: '4px' }}>
                {secs}
              </div>
            </div>

            <div style={{ flex: 1, height: '2px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--nd-text)' }}>{dateStr}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--nd-text-muted)' }}>{timezone}</span>
            </div>
          </div>
        </div>
      );
    }

    if (widgetSize === 'medium') {
      return (
        <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', justifyContent: 'center', padding: '14px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.4) 100%)', border: '1px solid var(--nd-card-border)', borderRadius: '6px', padding: '12px 14px', fontSize: '2.8rem', fontWeight: 800, color: 'var(--nd-text)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 6px rgba(0,0,0,0.2)', position: 'relative', lineHeight: 1 }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(0,0,0,0.5)', boxShadow: '0 1px 0 rgba(255,255,255,0.05)' }} />
                {hours}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nd-accent)', opacity: 0.8 }} />
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nd-accent)', opacity: 0.8 }} />
              </div>
              <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.4) 100%)', border: '1px solid var(--nd-card-border)', borderRadius: '6px', padding: '12px 14px', fontSize: '2.8rem', fontWeight: 800, color: 'var(--nd-text)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 6px rgba(0,0,0,0.2)', position: 'relative', lineHeight: 1 }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(0,0,0,0.5)', boxShadow: '0 1px 0 rgba(255,255,255,0.05)' }} />
                {mins}
              </div>
              <div style={{ background: 'var(--nd-accent-glow)', border: '1px solid var(--nd-accent)', borderRadius: '4px', padding: '4px 6px', fontSize: '0.95rem', fontWeight: 800, color: 'var(--nd-accent)', marginLeft: '4px' }}>
                {secs}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--nd-text)' }}>{dateStr}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>{timezone}</span>
            </div>
          </div>
        </div>
      );
    }

    // Narrow
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
