import ICAL from 'ical.js';
import type { CalendarDisplayEvent } from './types';

export class CalendarParseError extends Error {
  constructor(public readonly key: string) { super(key); }
}

function dateText(time: ICAL.Time, property?: ICAL.Property): string {
  if (time.isDate) return `${time.toString().slice(0, 10)}T00:00:00.000Z`;
  const tzid = property?.getParameter('tzid');
  if (typeof tzid === 'string' && time.zone.tzid === 'floating') {
    // Some producers omit VTIMEZONE for an IANA zone; use the runtime's zone database.
    let formatter: Intl.DateTimeFormat;
    try { formatter = new Intl.DateTimeFormat('en-GB', { timeZone: tzid, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); }
    catch { throw new CalendarParseError('calendar.invalidTimezone'); }
    const wall = Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second);
    let instant = wall;
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
      const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
      instant += wall - shown;
    }
    return new Date(instant).toISOString();
  }
  // Floating times deliberately remain local in the visitor's calendar.
  if (time.zone.tzid === 'floating') return time.toString();
  return time.toJSDate().toISOString();
}

/** Parse RFC5545 text, exceptions and bounded recurring instances without leaking ICAL objects. */
export function parseCalendarIcs(text: string, now = new Date()): CalendarDisplayEvent[] {
  let calendar: ICAL.Component;
  try { calendar = new ICAL.Component(ICAL.parse(text)); }
  catch { throw new CalendarParseError('calendar.invalidFeed'); }
  if (calendar.name !== 'vcalendar') throw new CalendarParseError('calendar.invalidFeed');
  const from = new Date(now); from.setUTCFullYear(from.getUTCFullYear() - 1);
  const until = new Date(now); until.setUTCFullYear(until.getUTCFullYear() + 2);
  const events: CalendarDisplayEvent[] = [];
  const deadline = Date.now() + 250;
  let iterations = 0;
  const components = calendar.getAllSubcomponents('vevent');
  const exceptions = components.filter(item => item.hasProperty('recurrence-id'));
  for (const component of components) {
    if (component.hasProperty('recurrence-id')) continue;
    const event = new ICAL.Event(component, { exceptions: exceptions.filter(item => item.getFirstPropertyValue('uid') === component.getFirstPropertyValue('uid')) });
    if (!component.hasProperty('dtstart') || !event.summary) continue;
    if (component.getFirstPropertyValue('status') === 'CANCELLED') continue;
    const add = (item: ICAL.Event, start: ICAL.Time, end: ICAL.Time, suffix = '') => {
      if (item.component.getFirstPropertyValue('status') === 'CANCELLED') return;
      if (events.length >= 2000) throw new CalendarParseError('calendar.tooManyEvents');
      events.push({ id: `${item.uid || `event-${events.length}`}${suffix}`, title: item.summary,
        start: dateText(start, item.component.getFirstProperty('dtstart') ?? undefined),
        end: dateText(end, item.component.getFirstProperty('dtend') ?? item.component.getFirstProperty('dtstart') ?? undefined),
        description: item.description || undefined, location: item.location || undefined, isAllDay: start.isDate });
    };
    if (!event.isRecurring()) { add(event, event.startDate, event.endDate); continue; }
    const iterator = event.iterator();
    let occurrence: ICAL.Time | null;
    while ((occurrence = iterator.next())) {
      if (++iterations > 10000 || Date.now() > deadline) throw new CalendarParseError('calendar.tooManyEvents');
      const details = event.getOccurrenceDetails(occurrence);
      const startText = dateText(details.startDate, details.item.component.getFirstProperty('dtstart') ?? undefined);
      const start = new Date(startText).getTime();
      if (start > until.getTime()) break;
      if (start >= from.getTime()) add(details.item, details.startDate, details.endDate, `@${occurrence.toString()}`);
    }
  }
  return events;
}
