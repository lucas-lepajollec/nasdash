'use client';

import React, { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { DEFAULT_WALLPAPER } from '@/lib/wallpapers';

export interface SetupStatus { pending: boolean; wallpaper: string; mode: 'light' | 'dark'; language: string | null }

/** Whether this installation is new, and its sign-in wallpaper (`/api/setup`, readable before signing in). */
export function useSetupStatus(): SetupStatus | null {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/setup', { cache: 'no-store' })
      .then(response => response.ok ? response.json() as Promise<SetupStatus> : Promise.reject(new Error(String(response.status))))
      .then(value => { if (!cancelled) setStatus(value); })
      .catch(() => { if (!cancelled) setStatus({ pending: false, wallpaper: DEFAULT_WALLPAPER, mode: 'dark', language: null }); });
    return () => { cancelled = true; };
  }, []);
  return status;
}

/** `abcd efgh jkmn` or `ABCDEFGHJKMN` → `ABCD-EFGH-JKMN`; anything else is returned as typed (trimmed). */
export function normalizeSetupCode(value: string): string {
  const compact = value.toUpperCase().replace(/[\s-]/g, '');
  return /^[A-Z0-9]{12}$/.test(compact) ? `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8)}` : value.trim();
}

export function NasDashMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" />
      <circle cx="7" cy="7.5" r="0.9" fill="currentColor" /><circle cx="7" cy="16.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

function Clock() {
  const { locale } = useI18n();
  const [now, setNow] = useState<Date | null>(null);
  // Read after mounting (the server's time would not match the browser's), then every 30 s.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);
  if (!now) return null;
  return (
    <div className="ndw-welcome-clock" aria-hidden="true">
      <span className="ndw-welcome-time">{now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
      <span className="ndw-welcome-date">{now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
    </div>
  );
}

/** The wallpaper, the NasDash mark and, on the sign-in screen, the time: around one frosted card. */
export function WelcomeShell({ wallpaper, clock, children }: { wallpaper: string; clock?: boolean; children: React.ReactNode }) {
  return (
    <main className="ndw-welcome">
      {/* eslint-disable-next-line @next/next/no-img-element -- a full-screen local photo, already sized */}
      <img className="ndw-welcome-wallpaper" src={wallpaper} alt="" />
      <div className="ndw-welcome-brand"><NasDashMark />NasDash</div>
      {clock && <Clock />}
      {children}
    </main>
  );
}
