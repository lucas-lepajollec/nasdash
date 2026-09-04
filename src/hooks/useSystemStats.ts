'use client';

import { useState, useEffect } from 'react';
import { SystemStats } from '@/lib/types';
import { useI18n } from '@/i18n/I18nProvider';

let globalEventSource: EventSource | null = null;
let globalStats: SystemStats | null = null;
let globalHistory: { cpu: number; latency: number; time: string }[] = [];
const listeners = new Set<() => void>();
let reconnectTimer: NodeJS.Timeout | null = null;
let isConnecting = false;
let visibilityHandlerAdded = false;
let activeLocale = 'en-US';

function notify() {
  listeners.forEach((l) => l());
}

function connect() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  if (globalEventSource || isConnecting) return;

  isConnecting = true;
  const es = new EventSource('/api/system');
  globalEventSource = es;

  es.onopen = () => {
    isConnecting = false;
  };

  es.onmessage = (event) => {
    try {
      const data: SystemStats = JSON.parse(event.data);
      globalStats = data;
      const now = new Date().toLocaleTimeString(activeLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const latency = data.network?.latency || 0;
      globalHistory = [...globalHistory, { cpu: 0, latency, time: now }].slice(-60);
      notify();
    } catch {
      // ignore
    }
  };

  es.onerror = () => {
    disconnect();
    reconnectTimer = setTimeout(() => {
      if (listeners.size > 0) connect();
    }, 5000);
  };
}

function disconnect() {
  if (globalEventSource) {
    globalEventSource.close();
    globalEventSource = null;
  }
  isConnecting = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

// Add global visibility listener once
if (typeof document !== 'undefined' && !visibilityHandlerAdded) {
  visibilityHandlerAdded = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      disconnect();
    } else {
      if (listeners.size > 0) {
        connect();
      }
    }
  });
}

export function useSystemStats() {
  const { locale } = useI18n();
  const [, forceRender] = useState({});

  useEffect(() => {
    activeLocale = locale;
    const listener = () => forceRender({});
    listeners.add(listener);

    if (listeners.size === 1) {
      connect();
    }
    
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        disconnect();
      }
    };
  }, [locale]);

  return { stats: globalStats, history: globalHistory };
}
