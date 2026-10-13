'use client';

import { useEffect, useMemo, useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import type { CalendarDisplayEvent } from '@/lib/types';

/**
 * Events shown by the calendar widget: the local events from the config plus,
 * when a calendar address (ICS) is set, the events it returns. Shared by the
 * Classic and Calme versions.
 */
export function useCalendarEvents(isVisible: boolean) {
  const { config } = useConfig();
  const calendarUrl = config?.settings?.calendarUrl;
  const configured = Boolean(calendarUrl || config?.settings?.calendarConfigured);
  const localEvents = useMemo(() => config?.localEvents || [], [config?.localEvents]);
  const [events, setEvents] = useState<CalendarDisplayEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisible) return;
    const controller = new AbortController();
    setError(null);
    const fetchEvents = async () => {
      let combined: CalendarDisplayEvent[] = localEvents.map(e => ({ ...e, start: e.start || null, end: e.end || null }));
      if (!configured) {
        setEvents(combined);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/calendar', { signal: controller.signal, cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'calendar.fetchFailed');
        if (!Array.isArray(data.events)) throw new Error('calendar.invalidFeed');
        if (data && data.events) combined = [...combined, ...data.events];
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'calendar.fetchFailed');
      } finally {
        if (!controller.signal.aborted) { setEvents(combined); setLoading(false); }
      }
    };
    void fetchEvents();
    return () => controller.abort();
  }, [calendarUrl, configured, isVisible, localEvents]);

  return { events, loading, error };
}

export function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
