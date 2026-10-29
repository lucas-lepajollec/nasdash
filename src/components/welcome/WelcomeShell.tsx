'use client';

import React, { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { DEFAULT_WALLPAPER } from '@/lib/wallpapers';

/** How the dashboard's surfaces look (Appearance), so the screens before it look the same. */
export interface SetupGlass { opacity: number; blur: number; dim: number }
export interface SetupStatus { pending: boolean; wallpaper: string; mode: 'light' | 'dark'; language: string | null; glass?: SetupGlass }
export const DEFAULT_GLASS: SetupGlass = { opacity: 0.6, blur: 24, dim: 0.15 };

/** Whether this installation is new, and its sign-in wallpaper (`/api/setup`, readable before signing in). */
export function useSetupStatus(): SetupStatus | null {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/setup', { cache: 'no-store' })
      .then(response => response.ok ? response.json() as Promise<SetupStatus> : Promise.reject(new Error(String(response.status))))
      .then(value => { if (!cancelled) setStatus(value); })
      .catch(() => { if (!cancelled) setStatus({ pending: false, wallpaper: DEFAULT_WALLPAPER, mode: 'dark', language: null, glass: DEFAULT_GLASS }); });
    return () => { cancelled = true; };
  }, []);
  return status;
}

/** `abcd efgh jkmn` or `ABCDEFGHJKMN` → `ABCD-EFGH-JKMN`; anything else is returned as typed (trimmed). */
export function normalizeSetupCode(value: string): string {
  const compact = value.toUpperCase().replace(/[\s-]/g, '');
  return /^[A-Z0-9]{12}$/.test(compact) ? `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8)}` : value.trim();
}

/** The time as the clock widget draws it: large and light, the date under it. */
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
    <div className="ndw-clock" aria-hidden="true">
      <span className="ndw-clock-time">{now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
      <span className="ndw-clock-date">{now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
    </div>
  );
}

/**
 * The wallpaper with its veil, the name and the time, around NasDash's own surfaces. The glass (opacity, blur,
 * veil) is the dashboard's, from Appearance, so arriving on the dashboard changes nothing but the content.
 */
export function WelcomeShell({ wallpaper, mode, glass = DEFAULT_GLASS, children }: { wallpaper: string; mode: 'light' | 'dark'; glass?: SetupGlass; children: React.ReactNode }) {
  // Before signing in the dashboard's settings are not readable: light or dark comes from /api/setup.
  useEffect(() => { document.body.classList.toggle('light', mode === 'light'); }, [mode]);
  const style = {
    '--ndw-opacity': String(glass.opacity),
    '--ndw-blur': `${glass.blur}px`,
    '--nd-wallpaper-dim': String(glass.dim),
  } as React.CSSProperties;
  return (
    <main className="ndw" style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a full-screen local image, already sized */}
      <img className="ndw-wallpaper" src={wallpaper} alt="" />
      <div className="ndw-brand">NasDash</div>
      <Clock />
      {children}
    </main>
  );
}
