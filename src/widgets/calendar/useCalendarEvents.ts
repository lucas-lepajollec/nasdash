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
  const localEvents = useMemo(() => config?.localEvents || [], [config?.localEvents]);
  const [events, setEvents] = useState<CalendarDisplayEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isVisible) return;
    const fetchEvents = async () => {
      let combined: CalendarDisplayEvent[] = localEvents.map(e => ({ ...e, start: e.start || null, end: e.end || null }));
      if (!calendarUrl) {
        setEvents(combined);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/calendar?url=${encodeURIComponent(calendarUrl)}`);
        const data = await res.json();
        if (data && data.events) combined = [...combined, ...data.events];
      } catch (e) {
        console.error('Failed to fetch calendar events:', e);
      } finally {
        setEvents(combined);
        setLoading(false);
      }
    };
    fetchEvents();
  }, [calendarUrl, isVisible, localEvents]);

  return { events, loading };
}

export function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
