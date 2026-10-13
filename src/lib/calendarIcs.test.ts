import { describe, expect, it } from 'vitest';
import { parseCalendarIcs } from './calendarIcs';
const wrap = (event: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//NasDash//Audit test//EN\r\nBEGIN:VEVENT\r\nUID:test\r\nDTSTAMP:20261013T000000Z\r\n${event}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
const now = new Date('2026-10-13T00:00:00Z');
describe('calendar import compatibility', () => {
 it('handles IANA zones, weekly recurrences, folded text and escaped text', () => {
  const events = parseCalendarIcs(wrap('DTSTART;TZID=Europe/Paris:20261013T120000\r\nDTEND;TZID=Europe/Paris:20261013T130000\r\nRRULE:FREQ=WEEKLY;COUNT=3\r\nSUMMARY:Long calen\r\n dar title\r\nDESCRIPTION:Line one\\nLine two'), now);
  expect(events).toHaveLength(3); expect(events.map(event => event.start)).toEqual(['2026-10-13T10:00:00.000Z','2026-10-20T10:00:00.000Z','2026-10-27T11:00:00.000Z']);
  expect(events[0]).toMatchObject({ title: 'Long calendar title', description: 'Line one\nLine two', end: '2026-10-13T11:00:00.000Z' });
 });
 it('preserves all-day dates, exclusive ends and excludes cancelled exceptions', () => {
  const events = parseCalendarIcs(wrap('DTSTART;VALUE=DATE:20261013\r\nDTEND;VALUE=DATE:20261014\r\nSUMMARY:All day'), now);
  expect(events[0]).toMatchObject({ start: '2026-10-13T00:00:00.000Z', end: '2026-10-14T00:00:00.000Z', isAllDay: true });
 });
 it('uses embedded VTIMEZONE without a global timezone registry', () => {
  const zone = 'BEGIN:VTIMEZONE\r\nTZID:Audit/Fixed\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0200\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n';
  const text = wrap('DTSTART;TZID=Audit/Fixed:20261013T120000\r\nSUMMARY:Custom zone').replace('BEGIN:VEVENT', zone+'BEGIN:VEVENT');
  expect(parseCalendarIcs(text, now)[0].start).toBe('2026-10-13T10:00:00.000Z');
 });
 it('refuses invalid calendars and resource-exhausting recurrence without silently truncating', () => {
  expect(() => parseCalendarIcs('<html>error</html>', now)).toThrow('calendar.invalidFeed');
  expect(() => parseCalendarIcs(wrap('DTSTART:20261013T000000Z\r\nRRULE:FREQ=SECONDLY\r\nSUMMARY:Busy'), now)).toThrow('calendar.tooManyEvents');
 });
});
