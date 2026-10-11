import type { LocalCalendarEvent } from '@/lib/types';

/** All-day dates are calendar dates, independent of the browser's time zone. */
export function eventStartDate(event: { start: string | null; isAllDay?: boolean }): Date | null {
  if (!event.start) return null;
  return new Date(event.isAllDay ? `${event.start.slice(0, 10)}T00:00:00` : event.start);
}

export function eventFormDate(event: LocalCalendarEvent): string {
  const start = eventStartDate(event)!;
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}

export function eventSchedule(date: string, time: string, isAllDay: boolean, original?: LocalCalendarEvent) {
  const start = new Date(`${date}T${isAllDay ? '00:00:00Z' : `${time}:00`}`).toISOString();
  let end: string | undefined;
  if (original?.end) {
    const previousDuration = new Date(original.end).getTime() - new Date(original.start).getTime();
    const duration = Boolean(original.isAllDay) === isAllDay && previousDuration > 0
      ? previousDuration
      : isAllDay ? 86_400_000 : 3_600_000;
    end = new Date(new Date(start).getTime() + duration).toISOString();
  }
  return { start, ...(end ? { end } : {}), isAllDay };
}
