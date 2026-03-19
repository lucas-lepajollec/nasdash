'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SystemStats } from '@/lib/types';

export function useSystemStats() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [history, setHistory] = useState<{ cpu: number; latency: number; time: string }[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/system');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: SystemStats = JSON.parse(event.data);
        setStats(data);
        setHistory(prev => {
          const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const latency = data.network?.latency || 0;
          const next = [...prev, { cpu: data.cpu.load, latency, time: now }];
          return next.slice(-60); // Keep last 60 data points (2 min)
        });
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      // Reconnect after 5 seconds
      setTimeout(connect, 5000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  return { stats, history };
}
