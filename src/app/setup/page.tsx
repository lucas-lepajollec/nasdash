'use client';

import React, { useEffect } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { FirstRunGuide } from '@/components/welcome/FirstRunGuide';
import { useSetupStatus } from '@/components/welcome/WelcomeShell';
import '../welcome.css';

/**
 * The first-run guide of a new installation, for its administrator. Anyone else, or an installation already set
 * up, is sent where they belong: sign-in or the dashboard.
 */
export default function SetupPage() {
  const status = useSetupStatus();
  const { user, authLoading } = useConfig();
  const ready = status !== null && !authLoading;
  const allowed = ready && status.pending && user?.role === 'admin' && !user.isAnonymous;

  useEffect(() => {
    if (!ready || allowed) return;
    window.location.replace(status.pending ? '/login' : '/');
  }, [ready, allowed, status]);

  if (!allowed || !status) return <div style={{ minHeight: '100dvh', background: '#0d1016' }} />;
  return <FirstRunGuide wallpaper={status.wallpaper} />;
}
